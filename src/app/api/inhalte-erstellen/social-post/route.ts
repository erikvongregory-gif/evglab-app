import { reserveGeneration, finishGeneration, saveGenerationProgress, resumeGenerationIfPresent, buildGenerationBillingSnapshot } from "@/lib/billing/generationJobs";
import { NextResponse } from "next/server";
import { withAdultSceneContext } from "@/lib/prompts/imageSceneContext";
import Anthropic from "@anthropic-ai/sdk";
import {
  ProviderError,
  isProviderError,
  logProviderFailure,
  providerErrorResponse,
} from "@/lib/ai/providerRequest";
import { requireImageGenerationUser } from "@/app/(dashboard)/inhalte-erstellen/lib/api-guards";
import { applyClientIntentOverrides, buildProductPlacementPrompt } from "@/app/(dashboard)/inhalte-erstellen/lib/prompt-builders/hyperrealistic";
import { socialPostSchema } from "@/app/(dashboard)/inhalte-erstellen/lib/schemas";
import { FLASCHEN_TYPEN } from "@/app/(dashboard)/inhalte-erstellen/lib/brewing-knowledge";
import { resolveReferenceImageForVision } from "@/lib/brand/reference-image-bytes";
import {
  buildBrandProfilePromptContext,
  canUseCampaignWithTextProfile,
  getBrandProfileFromMetadata,
} from "@/lib/dashboard/brandProfile";
import { calculateGenerationTokenCost, calculatePerVariantTokenCost, resolveImageBillingResolution } from "@/lib/billing/generationTokenCost";
import { ensureBillingRow, getEffectiveBillingRow } from "@/lib/billing/store";
import { requireActiveSubscription } from "@/lib/billing/access";
import { compileBrief } from "@/lib/prompts/prompt-compiler";
import { applyContentPresetPrompt } from "@/lib/image-types/policy";
import { appendCopySpaceDirective } from "@/lib/social/copy-space-prompt";
import { composeSocialTextOverlay, parsePrimaryBrandColor } from "@/lib/social/text-overlay";
import { applyAiWatermark } from "@/lib/openai/aiWatermark";
import {
  cropImageBufferToAspectRatio,
  generateOpenAiImage,
  mapAspectRatioToOpenAiSize,
  type OpenAiReferenceImage,
} from "@/lib/openai/generateImage";
import { aspectRatioToOutputDimensions } from "@/lib/openai/imageAspectRatio";
import { loadBottleShapeReference } from "@/lib/openai/bottleShapeReference";
import { requireOpenAiImageApiKey } from "@/lib/openai/imageApiKey";
import { uploadGeneratedImageToStorage } from "@/lib/supabase/storage";
import { persistGeneratedMediaItems } from "@/lib/dashboard/persistGeneratedMedia";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_PROMPT_CHARS = 12_000;
const OUTPUT_FORMAT = "png" as const;
const DEFAULT_IMAGE_MODEL = "gpt-image-2.5-sunburst";

export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  try {
    const guard = await requireImageGenerationUser(req, "inhalte-erstellen-social-post");
    if (!guard.ok) return guard.response;

    const subscriptionError = await requireActiveSubscription(guard.userId);
    if (subscriptionError) return subscriptionError;

    await ensureBillingRow(guard.userId);
    const currentState = await getEffectiveBillingRow(guard.userId);

    let openAiKey: string;
    try {
      openAiKey = requireOpenAiImageApiKey();
    } catch {
      return NextResponse.json({ error: "OPENAI_IMAGE_API_KEY fehlt." }, { status: 500 });
    }

    const parsed = socialPostSchema.safeParse(await req.json());
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const detail = issue ? `${issue.path.join(".")}: ${issue.message}` : "Payload validation failed.";
      return NextResponse.json({ error: `Ungueltige Anfrage. ${detail}` }, { status: 400 });
    }

    const { headline, subline, ctaText } = parsed.data;
    const input = applyClientIntentOverrides(parsed.data);
    const resumed = await resumeGenerationIfPresent(req, guard.userId, input);
    if (resumed) return resumed;

    const brandProfile = getBrandProfileFromMetadata(guard.userMetadata);
    if (!canUseCampaignWithTextProfile(brandProfile)) {
      return NextResponse.json(
        {
          error:
            "Social-Posts mit Text brauchen ein aktives Markenprofil. Lege es unter „Markenprofil“ an.",
          code: "campaign_requires_guided_brand_profile",
        },
        { status: 403 },
      );
    }

    const brandProfileContext = buildBrandProfilePromptContext(brandProfile);
    const wantsBrandLabel = input.etikettModus !== "generisch";
    const profileLabelUrl = brandProfile.brandLabelReferenceUrl.trim();
    let effectiveEtikettBild = input.etikettBild?.trim() ?? "";
    if (
      wantsBrandLabel &&
      (!effectiveEtikettBild || effectiveEtikettBild.includes("example.com/placeholder")) &&
      profileLabelUrl
    ) {
      effectiveEtikettBild = profileLabelUrl;
    }
    const hasEtikettInput =
      Boolean(effectiveEtikettBild) && !effectiveEtikettBild.includes("example.com/placeholder");

    let visionReference = null as Awaited<ReturnType<typeof resolveReferenceImageForVision>>;
    if (hasEtikettInput && input.behaelter !== "G" && wantsBrandLabel) {
      try {
        visionReference = await resolveReferenceImageForVision(effectiveEtikettBild, guard.userMetadata);
      } catch (visionError) {
        console.warn("[inhalte-erstellen/social-post] vision reference resolve failed:", visionError);
      }
    }

    const extraRefs: OpenAiReferenceImage[] = [];
    for (const raw of input.extraReferenceImages ?? []) {
      if (extraRefs.length >= 3) break;
      try {
        const resolved = await resolveReferenceImageForVision(raw, guard.userMetadata);
        if (resolved) extraRefs.push(resolved);
      } catch {
        /* ignore */
      }
    }

    const hasProductPhoto = Boolean(visionReference) && input.behaelter !== "G";
    const bottle = FLASCHEN_TYPEN[input.flaschenTyp];
    const shapeReference =
      input.behaelter === "G" || hasProductPhoto
        ? null
        : await loadBottleShapeReference(input.flaschenTyp);
    const hasShapeReference = Boolean(shapeReference) || bottle.hasShapeReference;

    const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
    const anthropic = anthropicKey ? new Anthropic({ apiKey: anthropicKey }) : null;

    const compiled = await compileBrief({
      anthropic: hasProductPhoto ? null : anthropic,
      input,
      breweryName: brandProfile.breweryName,
      brandProfileContext,
      hasProductPhoto,
      hasShapeReference,
      referenceImages: visionReference ? [visionReference] : undefined,
    });

    if (compiled.blocking_issues.length > 0) {
      return NextResponse.json(
        {
          error: compiled.blocking_issues[0],
          blocking_issues: compiled.blocking_issues,
          missing_information: compiled.missing_information,
        },
        { status: 422 },
      );
    }

    let prompt: string;
    if (hasProductPhoto) {
      const briefParts = [
        compiled.normalized_brief.scene,
        compiled.normalized_brief.action,
        compiled.normalized_brief.people,
        input.zusatzWunsch?.trim(),
      ].filter((part, index, arr) => Boolean(part) && arr.indexOf(part) === index);
      const placementInput = {
        ...input,
        zusatzWunsch: briefParts.join(". ").slice(0, 800) || input.zusatzWunsch,
      };
      prompt = appendCopySpaceDirective(buildProductPlacementPrompt(placementInput));
      if (brandProfileContext) {
        prompt = `${prompt} ${brandProfileContext.replace(/\n+/g, " ")}`;
      }
      if (input.stiltreue === "hoch" && wantsBrandLabel) {
        prompt = `${prompt} LABEL FIDELITY: Keep Image 1 label identical — every letter, logo, crest. Change only the environment.`;
      }
    } else {
      prompt = appendCopySpaceDirective(compiled.image_prompt);
    }
    if (input.hyperreal === true) {
      prompt = applyContentPresetPrompt(prompt, "hyperreal");
    }
    prompt = withAdultSceneContext(prompt, MAX_PROMPT_CHARS);

    const referenceImages = [visionReference, ...extraRefs, shapeReference].filter(
      (ref): ref is OpenAiReferenceImage => Boolean(ref),
    );

    const qualityEnv = process.env.OPENAI_IMAGE_QUALITY?.trim().toLowerCase();
    const requestedQuality = input.quality === "high" ? "high" : "medium";
    const billingResolution = resolveImageBillingResolution({
      hasProductPhoto,
      qualityEnv,
      compiledOrRequestedQuality: requestedQuality,
    });
    const openAiQuality: "low" | "medium" | "high" =
      qualityEnv === "low" || qualityEnv === "medium" || qualityEnv === "high"
        ? qualityEnv
        : billingResolution === "2K"
          ? "high"
          : "medium";
    const hasReferenceForBilling = referenceImages.length > 0;
    const strictLabelMode = wantsBrandLabel && hasProductPhoto;
    const perVariantCost = calculatePerVariantTokenCost({
      resolution: billingResolution,
      hasReferenceImage: hasReferenceForBilling,
      strictLabelMode,
    });
    const variantsToCreate = input.variantCount ?? 1;
    const expectedTotalCost = calculateGenerationTokenCost({
      resolution: billingResolution,
      hasReferenceImage: hasReferenceForBilling,
      strictLabelMode,
      variantCount: variantsToCreate,
    });

    const remainingTokens = Math.max((currentState?.monthly_tokens ?? 0) - (currentState?.used_tokens ?? 0), 0);
    if (remainingTokens < expectedTotalCost) {
      return NextResponse.json(
        { error: `Nicht genug Tokens. Benötigt: ${expectedTotalCost}, verfügbar: ${remainingTokens}.` },
        { status: 402 },
      );
    }

    const model = process.env.OPENAI_IMAGE_MODEL?.trim() || DEFAULT_IMAGE_MODEL;
    const aspectRatio = compiled.generation_settings.aspectRatio || input.aspectRatio;
    const size = mapAspectRatioToOpenAiSize(aspectRatio);
    const outputDimensions = aspectRatioToOutputDimensions(aspectRatio);

    const brandAccent = parsePrimaryBrandColor(brandProfile.brandColors);

    const renderOne = async (variantIndex: number): Promise<string> => {
      const rawBuffer = await generateOpenAiImage({
        apiKey: openAiKey,
        model,
        prompt,
        size,
        outputFormat: OUTPUT_FORMAT,
        quality: openAiQuality,
        referenceImages,
      });

      const cropped = await cropImageBufferToAspectRatio(rawBuffer, aspectRatio, OUTPUT_FORMAT);

      const composited = await composeSocialTextOverlay({
        imageBuffer: cropped,
        overlay: {
          width: outputDimensions.width,
          height: outputDimensions.height,
          headline,
          subline,
          ctaText,
          textColor: "#FFFFFF",
          ctaBackground: brandAccent,
        },
      });

      const finalBuffer = input.aiWatermark
        ? await applyAiWatermark(composited, OUTPUT_FORMAT)
        : composited;

      try {
        return await uploadGeneratedImageToStorage({
          userId: guard.userId,
          buffer: finalBuffer,
          outputFormat: OUTPUT_FORMAT,
        });
      } catch (uploadError) {
        throw uploadError instanceof Error
          ? new Error(`Variante ${variantIndex + 1}: ${uploadError.message}`)
          : new Error(`Variante ${variantIndex + 1}: Upload fehlgeschlagen.`);
      }
    };

    const job = await reserveGeneration(req, guard.userId, perVariantCost * variantsToCreate, input);
    if (job instanceof NextResponse) return job;
    const images: string[] = [];
    const errors: string[] = [];
    const providerFailures: ProviderError[] = [];
    for (let i = 0; i < variantsToCreate; i += 1) {
      try {
        images.push(await renderOne(i));
        await saveGenerationProgress(job, images, perVariantCost);
      } catch (reason) {
        if (isProviderError(reason)) {
          providerFailures.push(reason);
          errors.push(reason.classified.userMessage);
          if (!reason.classified.retryable) break;
          continue;
        }
        errors.push(reason instanceof Error ? reason.message : `Variante ${i + 1}: Unbekannter Fehler.`);
      }
    }

    if (images.length === 0) {
      const failure = providerFailures[0]?.classified;
      const message = failure?.code === "provider_content_rejected"
        ? `${failure.userMessage} Für diesen Auftrag wurden keine Tokens berechnet.`
        : errors[0] ?? "Generierung fehlgeschlagen.";
      await finishGeneration(job, 0, { error: message, code: failure?.code, images: [], billing: { consumed: 0 } });
      if (providerFailures.length > 0) {
        logProviderFailure(providerFailures[0].classified, { label: "inhalte-erstellen-social-post" });
        return providerErrorResponse({ ...providerFailures[0].classified, userMessage: message });
      }
      return NextResponse.json(
        { error: errors[0] ?? "Social-Post konnte nicht generiert werden." },
        { status: 500 },
      );
    }

    const mediaTitle = (headline.trim() || input.beerName?.trim() || brandProfile.breweryName.trim() || "Social-Post").slice(
      0,
      120,
    );
    const mediaItems = await persistGeneratedMediaItems({
      userId: guard.userId,
      jobId: job.id,
      images,
      title: mediaTitle,
      prompt: mediaTitle,
      aspectRatio,
      resolution: billingResolution === "2K" ? "2K" : "1K",
      outputFormat: OUTPUT_FORMAT,
    });
    const mediaPersisted = mediaItems.length > 0;
    const totalConsumed = perVariantCost * images.length;
    const billing = buildGenerationBillingSnapshot({
      state: currentState,
      charged: totalConsumed,
      perVariant: perVariantCost,
      owner: Boolean(job.owner),
    });
    const responseBody = {
      mode: "social_post_overlay" as const,
      images: images.map((imageUrl) => ({ imageUrl })),
      partial: images.length < variantsToCreate,
      expectedVariants: variantsToCreate,
      partialErrors: errors.length ? errors : undefined,
      usedBrandFont: false,
      fontName: "Work Sans",
      outputFormat: OUTPUT_FORMAT,
      jobId: job.id,
      mediaPersisted,
      billing: {
        remainingTokens: billing.remainingTokens,
        consumed: billing.consumed,
        perVariant: billing.perVariant,
        plan: billing.plan,
        monthlyTokens: billing.monthlyTokens,
        usedTokens: billing.usedTokens,
        freeTrial: billing.freeTrial,
      },
    };
    const finished = await finishGeneration(job, totalConsumed, responseBody);
    responseBody.billing = buildGenerationBillingSnapshot({
      state: finished.state,
      charged: totalConsumed,
      perVariant: perVariantCost,
      owner: Boolean(job.owner),
    });
    return NextResponse.json(responseBody);
  } catch (error) {
    if (isProviderError(error)) {
      logProviderFailure(error.classified, { label: "inhalte-erstellen-social-post" });
      return providerErrorResponse(error.classified);
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Social-Post-Generierung fehlgeschlagen." },
      { status: 500 },
    );
  }
}
