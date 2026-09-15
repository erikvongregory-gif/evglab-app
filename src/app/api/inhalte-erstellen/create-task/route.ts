import { reserveGeneration, finishGeneration, saveGenerationProgress } from "@/lib/billing/generationJobs";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  ProviderError,
  isProviderError,
  logProviderFailure,
  providerErrorResponse,
} from "@/lib/ai/providerRequest";
import { requireImageGenerationUser } from "@/app/(dashboard)/inhalte-erstellen/lib/api-guards";
import { applyClientIntentOverrides, buildProductPlacementPrompt } from "@/app/(dashboard)/inhalte-erstellen/lib/prompt-builders/hyperrealistic";
import { hyperrealisticSchema } from "@/app/(dashboard)/inhalte-erstellen/lib/schemas";
import { FLASCHEN_TYPEN } from "@/app/(dashboard)/inhalte-erstellen/lib/brewing-knowledge";
import { resolveReferenceImageForVision } from "@/lib/brand/reference-image-bytes";
import { buildBrandProfilePromptContext, getBrandProfileFromMetadata } from "@/lib/dashboard/brandProfile";
import { calculateGenerationTokenCost, calculatePerVariantTokenCost } from "@/lib/billing/generationTokenCost";
import { ensureBillingRow, getEffectiveBillingRow } from "@/lib/billing/store";
import { requireActiveSubscription } from "@/lib/billing/access";
import { compileBrief } from "@/lib/prompts/prompt-compiler";
import { applyContentPresetPrompt } from "@/lib/image-types/policy";
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

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_PROMPT_CHARS = 12_000;
const DEFAULT_VARIANT_COUNT = 3;
const OUTPUT_FORMAT = "png" as const;
const DEFAULT_IMAGE_MODEL = "gpt-image-2.5-sunburst";

/** Leichtgewichtiger Warm-up — kompiliert die Route, ohne Bild zu erzeugen. */
export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  try {
    const guard = await requireImageGenerationUser(req, "inhalte-erstellen-create-task");
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

    const parsed = hyperrealisticSchema.safeParse(await req.json());
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const detail = issue ? `${issue.path.join(".")}: ${issue.message}` : "Payload validation failed.";
      return NextResponse.json({ error: `Ungueltige Anfrage. ${detail}` }, { status: 400 });
    }
    const input = applyClientIntentOverrides(parsed.data);

    const brandProfile = getBrandProfileFromMetadata(guard.userMetadata);
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
    if (hasEtikettInput && input.behaelter !== "G") {
      try {
        visionReference = await resolveReferenceImageForVision(effectiveEtikettBild, guard.userMetadata);
      } catch (visionError) {
        console.warn("[inhalte-erstellen/create-task] vision reference resolve failed:", visionError);
      }
    }

    const extraRefs: OpenAiReferenceImage[] = [];
    for (const raw of input.extraReferenceImages ?? []) {
      if (extraRefs.length >= 3) break;
      try {
        const resolved = await resolveReferenceImageForVision(raw, guard.userMetadata);
        if (resolved) extraRefs.push(resolved);
      } catch {
        /* ignore bad extra */
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

    // Mit Produktfoto: Compiler nur für Validierung + Brief-Normalisierung.
    // Der Bild-Prompt bleibt kurz (i2i Placement) — lange Master-Prompts zerstören Etikett-Treue.
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
          compiled: {
            normalized_brief: compiled.normalized_brief,
            reference_roles: compiled.reference_roles,
          },
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
      prompt = buildProductPlacementPrompt(placementInput);
      if (input.stiltreue === "hoch" && wantsBrandLabel) {
        prompt = `${prompt} LABEL FIDELITY: Keep Image 1 label identical — every letter, logo, crest. Change only the environment.`;
      }
    } else {
      prompt = applyContentPresetPrompt(compiled.image_prompt, input.contentPreset ?? "hyperreal");
    }
    if (prompt.length > MAX_PROMPT_CHARS) prompt = prompt.slice(0, MAX_PROMPT_CHARS);

    const referenceImages = [visionReference, ...extraRefs, shapeReference].filter(
      (ref): ref is OpenAiReferenceImage => Boolean(ref),
    );

    console.info("[inhalte-erstellen/create-task] compiled", {
      szene: input.szene,
      personenModus: input.personenModus,
      zusatzWunsch: input.zusatzWunsch?.slice(0, 120) ?? null,
      hasProductPhoto,
      hasShapeReference,
      promptMode: hasProductPhoto ? "placement-i2i" : "master-prompt",
      blocking: compiled.blocking_issues.length,
      promptStart: prompt.slice(0, 160),
    });

    const qualityEnv = process.env.OPENAI_IMAGE_QUALITY?.trim().toLowerCase();
    // Hyperreal-Finals mit Produktfoto: high, sofern nicht per Env anders gesetzt.
    const openAiQuality: "low" | "medium" | "high" =
      qualityEnv === "low" || qualityEnv === "medium" || qualityEnv === "high"
        ? qualityEnv
        : hasProductPhoto
          ? "high"
          : compiled.generation_settings.quality === "high"
            ? "high"
            : "medium";
    const billingResolution = (openAiQuality === "high" ? "2K" : "1K") as "1K" | "2K";
    const hasReferenceForBilling = referenceImages.length > 0;
    const strictLabelMode = wantsBrandLabel && hasProductPhoto;
    const perVariantCost = calculatePerVariantTokenCost({
      resolution: billingResolution,
      hasReferenceImage: hasReferenceForBilling,
      strictLabelMode,
    });
    const variantsToCreate = input.variantCount ?? DEFAULT_VARIANT_COUNT;
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
      let buffer = await cropImageBufferToAspectRatio(rawBuffer, aspectRatio, OUTPUT_FORMAT);
      if (input.aiWatermark) {
        buffer = await applyAiWatermark(buffer, OUTPUT_FORMAT);
      }
      try {
        return await uploadGeneratedImageToStorage({
          userId: guard.userId,
          buffer,
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
          if (!reason.classified.retryable && reason.classified.providerFault) break;
          continue;
        }
        errors.push(reason instanceof Error ? reason.message : `Variante ${i + 1}: Unbekannter Fehler.`);
      }
    }

    if (images.length === 0) {
      await finishGeneration(job, 0, { error: errors[0] ?? "Generierung fehlgeschlagen.", images: [] });
      const [providerFailure] = providerFailures;
      if (providerFailure) {
        logProviderFailure(providerFailure.classified, {
          label: "inhalte-erstellen-create-task",
          userId: guard.userId,
        });
        return providerErrorResponse(providerFailure.classified);
      }
      return NextResponse.json(
        { error: errors[0] ?? "Keine Variante konnte generiert werden.", details: errors },
        { status: 502 },
      );
    }

    const totalConsumed = perVariantCost * images.length;
    const consumeResult = await finishGeneration(job, totalConsumed, { images: images.map(imageUrl => ({ imageUrl })), jobId: job.id });

    return NextResponse.json({
      images: images.map((imageUrl) => ({ imageUrl })),
      variantCount: images.length,
      expectedVariants: variantsToCreate,
      partial: images.length < variantsToCreate,
      partialErrors: errors.length > 0 ? errors : undefined,
      model,
      prompt,
      hasReference: hasReferenceForBilling,
      size,
      aspectRatio,
      outputDimensions,
      outputFormat: OUTPUT_FORMAT,
      compiled: {
        normalized_brief: compiled.normalized_brief,
        missing_information: compiled.missing_information,
        reference_roles: compiled.reference_roles,
      },
      billing: {
        freeTrial: false,
        consumed: totalConsumed,
        perVariant: perVariantCost,
        plan: consumeResult.state.plan,
        monthlyTokens: consumeResult.state.monthly_tokens,
        usedTokens: consumeResult.state.used_tokens,
        remainingTokens: Math.max(consumeResult.state.monthly_tokens - consumeResult.state.used_tokens, 0),
      },
    });
  } catch (error) {
    if (isProviderError(error)) {
      logProviderFailure(error.classified, { label: "inhalte-erstellen-create-task" });
      return providerErrorResponse(error.classified);
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bildgenerierung fehlgeschlagen." },
      { status: 500 },
    );
  }
}
