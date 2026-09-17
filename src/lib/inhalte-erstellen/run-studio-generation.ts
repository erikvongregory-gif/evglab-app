import { after, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireImageGenerationUser } from "@/app/(dashboard)/inhalte-erstellen/lib/api-guards";
import { applyClientIntentOverrides, buildProductPlacementPrompt } from "@/app/(dashboard)/inhalte-erstellen/lib/prompt-builders/hyperrealistic";
import { ensureClosureLogic } from "@/app/(dashboard)/inhalte-erstellen/lib/prompt-builders/hyperrealism-blocks";
import { hyperrealisticSchema, socialPostSchema, type HyperrealisticInput, type SocialPostInput } from "@/app/(dashboard)/inhalte-erstellen/lib/schemas";
import { FLASCHEN_TYPEN } from "@/app/(dashboard)/inhalte-erstellen/lib/brewing-knowledge";
import { resolveReferenceImageForVision } from "@/lib/brand/reference-image-bytes";
import {
  buildBrandProfilePromptContext,
  canUseCampaignWithTextProfile,
  getBrandProfileFromMetadata,
} from "@/lib/dashboard/brandProfile";
import {
  calculateGenerationTokenCost,
  calculatePerVariantTokenCost,
  resolveImageBillingResolution,
} from "@/lib/billing/generationTokenCost";
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
import {
  assembleGenerationReferences,
  buildCharacterIdentityPrompt,
  cropBufferFaceSafe,
  generateCharacterIdentityImage,
} from "@/lib/kie/nanoBananaCharacterGenerate";
import { withAdultSceneContext } from "@/lib/prompts/imageSceneContext";
import {
  ProviderError,
  isProviderError,
  logProviderFailure,
  providerErrorResponse,
} from "@/lib/ai/providerRequest";
import {
  buildGenerationBillingSnapshot,
  finishGeneration,
  linkProviderTask,
  reserveGeneration,
  resumeGenerationIfPresent,
  saveGenerationProgress,
  type GenerationJob,
} from "@/lib/billing/generationJobs";
import {
  effectiveAspectRatio,
  resolveLabelIntent,
  snapshotFromPayload,
  type Aspect,
  type GenerationSnapshot,
  type StudioMode,
} from "@/lib/inhalte-erstellen/studio-config";

const MAX_PROMPT_CHARS = 12_000;
const OUTPUT_FORMAT = "png" as const;
const DEFAULT_IMAGE_MODEL = "gpt-image-2.5-sunburst";
const DEFAULT_VARIANT_COUNT = 3;

type StudioInput = HyperrealisticInput | SocialPostInput;

type PreparedGeneration = {
  input: StudioInput;
  snapshot: GenerationSnapshot;
  prompt: string;
  referenceImages: OpenAiReferenceImage[];
  useCharacterIdentity: boolean;
  openAiKey: string;
  model: string;
  aspectRatio: GenerationSnapshot["aspectRatio"];
  size: ReturnType<typeof mapAspectRatioToOpenAiSize>;
  outputDimensions: { width: number; height: number };
  billingResolution: "1K" | "2K";
  openAiQuality: "low" | "medium" | "high";
  perVariantCost: number;
  variantsToCreate: number;
  headline?: string;
  subline?: string;
  ctaText?: string;
  brandAccent: string;
  mediaTitle: string;
};

export async function handleStudioGenerationRequest(req: Request, mode: StudioMode): Promise<NextResponse> {
  try {
    const guard = await requireImageGenerationUser(
      req,
      mode === "social" ? "inhalte-erstellen-social-post" : "inhalte-erstellen-create-task",
    );
    if (!guard.ok) return guard.response;

    const subscriptionError = await requireActiveSubscription(guard.userId);
    if (subscriptionError) return subscriptionError;

    await ensureBillingRow(guard.userId);
    const currentState = await getEffectiveBillingRow(guard.userId);

    const schema = mode === "social" ? socialPostSchema : hyperrealisticSchema;
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const detail = issue ? `${issue.path.join(".")}: ${issue.message}` : "Payload validation failed.";
      return NextResponse.json({ error: `Ungültige Anfrage. ${detail}` }, { status: 400 });
    }

    const raw = parsed.data as StudioInput;
    const input = applyClientIntentOverrides(raw);
    const resumed = await resumeGenerationIfPresent(req, guard.userId, input);
    if (resumed) return resumed;

    const prepared = await prepareStudioGeneration({
      mode,
      input,
      userMetadata: guard.userMetadata,
      remainingTokens: Math.max((currentState?.monthly_tokens ?? 0) - (currentState?.used_tokens ?? 0), 0),
    });
    if (prepared instanceof NextResponse) return prepared;

    const job = await reserveGeneration(req, guard.userId, prepared.perVariantCost * prepared.variantsToCreate, input);
    if (job instanceof NextResponse) return job;

    await saveGenerationProgress(job, {
      snapshot: prepared.snapshot,
      phase: "queued",
      expectedVariants: prepared.variantsToCreate,
      completedVariants: 0,
      images: [],
      overlay:
        mode === "social"
          ? { headline: prepared.headline, subline: prepared.subline, ctaText: prepared.ctaText }
          : undefined,
    });

    const work = executeStudioGeneration({
      job,
      prepared,
      mode,
      userId: guard.userId,
    }).catch(async (error) => {
      if (isProviderError(error)) return;
      const message = error instanceof Error ? error.message : "Bildgenerierung fehlgeschlagen.";
      try {
        await finishGeneration(job, 0, {
          error: message,
          images: [],
          snapshot: prepared.snapshot,
          phase: "failed",
          billing: { consumed: 0 },
        });
      } catch {
        /* Abschluss folgt über Statusprüfung */
      }
    });

    after(() => work);
    // ponytail: Vitest awaits the same promise so route tests still see settlement
    if (process.env.VITEST) await work;

    return NextResponse.json(
      {
        jobId: job.id,
        status: "accepted",
        phase: "queued",
        snapshot: prepared.snapshot,
        expectedVariants: prepared.variantsToCreate,
        aspectRatio: prepared.aspectRatio,
        outputDimensions: prepared.outputDimensions,
        resolution: prepared.billingResolution,
      },
      { status: 202 },
    );
  } catch (error) {
    if (isProviderError(error)) {
      logProviderFailure(error.classified, {
        label: mode === "social" ? "inhalte-erstellen-social-post" : "inhalte-erstellen-create-task",
      });
      return providerErrorResponse(error.classified);
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bildgenerierung fehlgeschlagen." },
      { status: 500 },
    );
  }
}

async function prepareStudioGeneration(args: {
  mode: StudioMode;
  input: StudioInput;
  userMetadata: unknown;
  remainingTokens: number;
}): Promise<PreparedGeneration | NextResponse> {
  const { mode, input } = args;
  const brandProfile = getBrandProfileFromMetadata(args.userMetadata);
  if (mode === "social" && !canUseCampaignWithTextProfile(brandProfile)) {
    return NextResponse.json(
      {
        error: "Social-Posts mit Text brauchen ein aktives Markenprofil. Lege es unter „Markenprofil“ an.",
        code: "campaign_requires_guided_brand_profile",
      },
      { status: 403 },
    );
  }

  const labelIntent = resolveLabelIntent(input);
  const wantsBrandLabel = labelIntent.keepLabel;
  const applyBrandLook = labelIntent.applyBrandLook;
  const brandProfileContext = applyBrandLook ? buildBrandProfilePromptContext(brandProfile) : "";
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
      visionReference = await resolveReferenceImageForVision(effectiveEtikettBild, args.userMetadata);
    } catch (visionError) {
      console.warn("[studio-generation] vision reference resolve failed:", visionError);
    }
    if (!visionReference) {
      return NextResponse.json(
        { error: "Das Produktfoto konnte nicht geladen werden. Bitte das Foto unter Meine Biere ersetzen." },
        { status: 422 },
      );
    }
  }

  const extraRefs: OpenAiReferenceImage[] = [];
  for (const raw of input.extraReferenceImages ?? []) {
    try {
      const resolved = await resolveReferenceImageForVision(raw, args.userMetadata);
      if (!resolved) {
        return NextResponse.json(
          { error: "Eine Zusatzreferenz konnte nicht geladen werden. Bitte ersetzen oder entfernen." },
          { status: 422 },
        );
      }
      extraRefs.push(resolved);
    } catch {
      return NextResponse.json(
        { error: "Eine Zusatzreferenz konnte nicht geladen werden. Bitte ersetzen oder entfernen." },
        { status: 422 },
      );
    }
  }

  const characterRefs: OpenAiReferenceImage[] = [];
  if (input.characterName?.trim()) {
    for (const raw of input.characterReferenceImages ?? []) {
      if (characterRefs.length >= 3) break;
      try {
        const resolved = await resolveReferenceImageForVision(raw, args.userMetadata);
        if (resolved) characterRefs.push(resolved);
      } catch {
        /* einzelne kaputte Charakterfotos überspringen */
      }
    }
  }
  const useCharacterIdentity = Boolean(input.characterName?.trim()) && characterRefs.length > 0;

  if (input.characterName?.trim()) {
    if (characterRefs.length === 0) {
      return NextResponse.json(
        { error: "Charakter-Fotos konnten nicht geladen werden. Bitte unter Markenprofil neu hochladen." },
        { status: 422 },
      );
    }
    if (!visionReference) {
      return NextResponse.json(
        {
          error:
            "Ein Charakter braucht ein Produktfoto. „Etikett erhalten“ eingeschaltet lassen und eine Sorte mit Foto wählen.",
        },
        { status: 422 },
      );
    }
  }

  let openAiKey = "";
  if (!useCharacterIdentity) {
    try {
      openAiKey = requireOpenAiImageApiKey();
    } catch {
      return NextResponse.json({ error: "Bilddienst ist nicht konfiguriert." }, { status: 500 });
    }
  } else if (!process.env.KIE_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "Charakter-Identität ist gerade nicht verfügbar. Bitte später erneut versuchen." },
      { status: 500 },
    );
  }

  const hasProductPhoto = Boolean(visionReference) && input.behaelter !== "G";
  const bottle = FLASCHEN_TYPEN[input.flaschenTyp];
  const shapeReference =
    input.behaelter === "G" || hasProductPhoto ? null : await loadBottleShapeReference(input.flaschenTyp);
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
    prompt = buildProductPlacementPrompt({
      ...input,
      zusatzWunsch: briefParts.join(". ").slice(0, 800) || input.zusatzWunsch,
    });
    if (brandProfileContext) prompt = `${prompt} ${brandProfileContext.replace(/\n+/g, " ")}`;
    if (labelIntent.stiltreue === "hoch" && wantsBrandLabel) {
      prompt = `${prompt} LABEL FIDELITY: Keep Image 1 label identical — every letter, logo, crest. Change only the environment.`;
    }
  } else {
    prompt = compiled.image_prompt;
  }
  if (input.hyperreal === true || input.contentPreset === "hyperreal") {
    prompt = applyContentPresetPrompt(prompt, "hyperreal");
  }
  prompt = withAdultSceneContext(prompt, MAX_PROMPT_CHARS);

  const assembled = assembleGenerationReferences({
    useCharacterIdentity,
    characterRefs,
    visionReference,
    extraRefs,
    shapeReference,
  });
  if ((input.extraReferenceImages?.length ?? 0) > assembled.extraRefCount) {
    return NextResponse.json(
      {
        error:
          "Zusätzliche Referenzbilder passen mit dieser Produkt- und Personenauswahl nicht ins Motiv. Bitte welche entfernen.",
        code: "extra_refs_overflow",
      },
      { status: 422 },
    );
  }

  if (useCharacterIdentity) {
    prompt = withAdultSceneContext(
      buildCharacterIdentityPrompt({
        szene: input.szene,
        zusatzWunsch: input.zusatzWunsch,
        characterName: input.characterName,
        characterRole: input.characterRole,
        appearanceLock: input.characterAppearanceLock,
        characterRefCount: characterRefs.length,
        extraRefCount: assembled.extraRefCount,
        brandContext: brandProfileContext || undefined,
      }),
      MAX_PROMPT_CHARS,
    );
  }

  prompt = ensureClosureLogic(prompt, input);
  if (mode === "social") prompt = appendCopySpaceDirective(prompt);

  const qualityEnv = process.env.OPENAI_IMAGE_QUALITY?.trim().toLowerCase();
  const requestedQuality = input.quality === "high" ? "high" : "medium";
  const billingResolution = resolveImageBillingResolution({
    hasProductPhoto: hasProductPhoto || useCharacterIdentity,
    qualityEnv,
    compiledOrRequestedQuality: requestedQuality,
  });
  const openAiQuality: "low" | "medium" | "high" =
    qualityEnv === "low" || qualityEnv === "medium" || qualityEnv === "high"
      ? qualityEnv
      : billingResolution === "2K"
        ? "high"
        : "medium";
  const hasReferenceForBilling = assembled.references.length > 0;
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
  if (args.remainingTokens < expectedTotalCost) {
    return NextResponse.json(
      { error: `Nicht genug Tokens. Benötigt: ${expectedTotalCost}, verfügbar: ${args.remainingTokens}.` },
      { status: 402 },
    );
  }

  const hasCharacter = Boolean(input.characterName?.trim());
  const compiledAspect = compiled.generation_settings.aspectRatio || input.aspectRatio;
  const aspectRatio = effectiveAspectRatio(compiledAspect as Aspect, hasCharacter);
  const social = mode === "social" ? (input as SocialPostInput) : null;
  const extraRoles = (input.extraReferenceImages ?? []).map((_, index) => ({
    role: (input.extraReferenceRoles?.[index] ?? "scene") as "scene" | "look",
    label: input.extraReferenceRoles?.[index] === "look" ? "Look" : "Umgebung",
  }));
  const snapshot = snapshotFromPayload({
    mode,
    payload: { ...input, aspectRatio, ...labelIntent },
    beerId: null,
    characterId: null,
    extraRoles,
    beerName: input.beerName,
    characterName: input.characterName,
  });

  return {
    input,
    snapshot,
    prompt,
    referenceImages: assembled.references,
    useCharacterIdentity,
    openAiKey,
    model: useCharacterIdentity
      ? process.env.KIE_NANOBANANA_IMAGE_MODEL?.trim() || "nano-banana-pro"
      : process.env.OPENAI_IMAGE_MODEL?.trim() || DEFAULT_IMAGE_MODEL,
    aspectRatio,
    size: mapAspectRatioToOpenAiSize(aspectRatio),
    outputDimensions: aspectRatioToOutputDimensions(aspectRatio),
    billingResolution,
    openAiQuality,
    perVariantCost,
    variantsToCreate,
    headline: social?.headline,
    subline: social?.subline,
    ctaText: social?.ctaText,
    brandAccent: parsePrimaryBrandColor(brandProfile.brandColors),
    mediaTitle: (
      social?.headline?.trim() ||
      input.zusatzWunsch?.trim() ||
      input.beerName?.trim() ||
      brandProfile.breweryName.trim() ||
      "Motiv"
    ).slice(0, 120),
  };
}

async function executeStudioGeneration(args: {
  job: GenerationJob;
  prepared: PreparedGeneration;
  mode: StudioMode;
  userId: string;
}): Promise<void> {
  const { job, prepared, mode } = args;
  await saveGenerationProgress(job, { phase: "generating", snapshot: prepared.snapshot });

  const images: string[] = [];
  const backgroundImages: string[] = [];
  const errors: string[] = [];
  const providerFailures: ProviderError[] = [];
  let linkedProvider = false;

  const recordProgress = async (imageUrl: string, backgroundUrl?: string) => {
    images.push(imageUrl);
    if (backgroundUrl) backgroundImages.push(backgroundUrl);
    await saveGenerationProgress(job, {
      phase: "generating",
      snapshot: prepared.snapshot,
      expectedVariants: prepared.variantsToCreate,
      completedVariants: images.length,
      images: images.map((url) => ({ imageUrl: url })),
      backgroundImages: backgroundImages.length ? backgroundImages.map((url) => ({ imageUrl: url })) : undefined,
      perVariantCost: prepared.perVariantCost,
    });
  };

  const renderOne = async (): Promise<void> => {
    const rawBuffer = prepared.useCharacterIdentity
      ? await generateCharacterIdentityImage({
          prompt: prepared.prompt,
          references: prepared.referenceImages,
          aspectRatio: prepared.aspectRatio,
          resolution: prepared.billingResolution === "2K" ? "2K" : "1K",
          onTaskId: async (taskId) => {
            if (linkedProvider) return;
            linkedProvider = true;
            await linkProviderTask(job, taskId);
          },
        })
      : await generateOpenAiImage({
          apiKey: prepared.openAiKey,
          model: prepared.model,
          prompt: prepared.prompt,
          size: prepared.size,
          outputFormat: OUTPUT_FORMAT,
          quality: prepared.openAiQuality,
          referenceImages: prepared.referenceImages,
        });

    const cropped = prepared.useCharacterIdentity
      ? await cropBufferFaceSafe(rawBuffer, prepared.aspectRatio, OUTPUT_FORMAT)
      : await cropImageBufferToAspectRatio(rawBuffer, prepared.aspectRatio, OUTPUT_FORMAT);

    if (mode === "social" && prepared.headline) {
      const backgroundUrl = await uploadGeneratedImageToStorage({
        userId: args.userId,
        buffer: cropped,
        outputFormat: OUTPUT_FORMAT,
      });
      const composited = await composeSocialTextOverlay({
        imageBuffer: cropped,
        overlay: {
          width: prepared.outputDimensions.width,
          height: prepared.outputDimensions.height,
          headline: prepared.headline,
          subline: prepared.subline,
          ctaText: prepared.ctaText,
          textColor: "#FFFFFF",
          ctaBackground: prepared.brandAccent,
        },
      });
      const finalBuffer = prepared.input.aiWatermark
        ? await applyAiWatermark(composited, OUTPUT_FORMAT)
        : composited;
      const imageUrl = await uploadGeneratedImageToStorage({
        userId: args.userId,
        buffer: finalBuffer,
        outputFormat: OUTPUT_FORMAT,
      });
      await recordProgress(imageUrl, backgroundUrl);
      return;
    }

    const finalBuffer = prepared.input.aiWatermark ? await applyAiWatermark(cropped, OUTPUT_FORMAT) : cropped;
    const imageUrl = await uploadGeneratedImageToStorage({
      userId: args.userId,
      buffer: finalBuffer,
      outputFormat: OUTPUT_FORMAT,
    });
    await recordProgress(imageUrl);
  };

  for (let index = 0; index < prepared.variantsToCreate; index += 1) {
    try {
      await renderOne();
    } catch (reason) {
      if (isProviderError(reason)) {
        providerFailures.push(reason);
        errors.push(reason.classified.userMessage);
        if (reason.classified.code === "provider_content_rejected") break;
        continue;
      }
      errors.push(reason instanceof Error ? reason.message : `Variante ${index + 1}: Unbekannter Fehler.`);
    }
  }

  if (images.length === 0) {
    const [providerFailure] = providerFailures;
    const failure = providerFailure?.classified;
    const message =
      failure?.code === "provider_content_rejected"
        ? `${failure.userMessage} Für diesen Auftrag wurden keine Tokens berechnet.`
        : errors[0] ?? "Generierung fehlgeschlagen.";
    await finishGeneration(job, 0, {
      error: message,
      code: failure?.code,
      images: [],
      snapshot: prepared.snapshot,
      phase: "failed",
      billing: { consumed: 0 },
    });
    if (providerFailure) {
      logProviderFailure(providerFailure.classified, {
        label: mode === "social" ? "inhalte-erstellen-social-post" : "inhalte-erstellen-create-task",
        userId: args.userId,
      });
      throw providerFailure;
    }
    throw new Error(message);
  }

  await saveGenerationProgress(job, { phase: "persisting", snapshot: prepared.snapshot });
  const totalConsumed = prepared.perVariantCost * images.length;
  const mediaItems = await persistGeneratedMediaItems({
    userId: args.userId,
    jobId: job.id,
    images,
    title: prepared.mediaTitle,
    prompt: prepared.mediaTitle,
    aspectRatio: prepared.aspectRatio,
    resolution: prepared.billingResolution === "2K" ? "2K" : "1K",
    outputFormat: OUTPUT_FORMAT,
  });
  const responseBody = {
    images: images.map((imageUrl) => ({ imageUrl })),
    backgroundImages: backgroundImages.length ? backgroundImages.map((imageUrl) => ({ imageUrl })) : undefined,
    overlay:
      mode === "social"
        ? { headline: prepared.headline, subline: prepared.subline, ctaText: prepared.ctaText }
        : undefined,
    variantCount: images.length,
    expectedVariants: prepared.variantsToCreate,
    completedVariants: images.length,
    partial: images.length < prepared.variantsToCreate,
    partialErrors: errors.length > 0 ? errors : undefined,
    snapshot: prepared.snapshot,
    phase: images.length < prepared.variantsToCreate ? "partial" : "completed",
    aspectRatio: prepared.aspectRatio,
    outputDimensions: prepared.outputDimensions,
    outputFormat: OUTPUT_FORMAT,
    resolution: prepared.billingResolution === "2K" ? "2K" : "1K",
    jobId: job.id,
    mediaPersisted: mediaItems.length > 0,
    billing: buildGenerationBillingSnapshot({
      state: null,
      charged: totalConsumed,
      perVariant: prepared.perVariantCost,
      owner: Boolean(job.owner),
    }),
  };
  const finished = await finishGeneration(job, totalConsumed, responseBody);
  responseBody.billing = buildGenerationBillingSnapshot({
    state: finished.state,
    charged: totalConsumed,
    perVariant: prepared.perVariantCost,
    owner: Boolean(job.owner),
  });
}

export { composeSocialTextOverlay };
