import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  ProviderError,
  isProviderError,
  logProviderFailure,
  providerErrorResponse,
} from "@/lib/ai/providerRequest";
import { requireImageGenerationUser } from "@/app/(dashboard)/inhalte-erstellen/lib/api-guards";
import { buildHyperrealisticPrompt, buildProductPlacementPrompt } from "@/app/(dashboard)/inhalte-erstellen/lib/prompt-builders/hyperrealistic";
import {
  enforceHyperrealisticPromptConstraints,
  shouldUseImageReferenceForGeneration,
} from "@/app/(dashboard)/inhalte-erstellen/lib/prompt-builders/enforce-prompt-constraints";
import { hyperrealisticSchema } from "@/app/(dashboard)/inhalte-erstellen/lib/schemas";
import { resolveReferenceImageForVision } from "@/lib/brand/reference-image-bytes";
import { buildBrandProfilePromptContext, getBrandProfileFromMetadata } from "@/lib/dashboard/brandProfile";
import { calculateGenerationTokenCost, calculatePerVariantTokenCost } from "@/lib/billing/generationTokenCost";
import { consumeTokens, ensureBillingRow, getEffectiveBillingRow } from "@/lib/billing/store";
import { requireActiveSubscription } from "@/lib/billing/access";
import { generateBrauereiBildPrompt } from "@/lib/prompts/brauerei-bild/generate-prompt";
import { buildHyperrealisticClaudeUserMessage } from "@/lib/prompts/brauerei-bild/map-hyperrealistic-brief";
import { applyContentPresetPrompt } from "@/lib/image-types/policy";
import {
  generateOpenAiImage,
  mapAspectRatioToOpenAiSize,
  type OpenAiReferenceImage,
} from "@/lib/openai/generateImage";
import { loadBottleShapeReference } from "@/lib/openai/bottleShapeReference";
import { uploadGeneratedImageToStorage } from "@/lib/supabase/storage";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_PROMPT_CHARS = 12_000;
const DEFAULT_VARIANT_COUNT = 3;
const OUTPUT_FORMAT = "png" as const;

export async function POST(req: Request) {
  try {
    const guard = await requireImageGenerationUser(req, "inhalte-erstellen-create-task");
    if (!guard.ok) return guard.response;

    const subscriptionError = await requireActiveSubscription(guard.userId);
    if (subscriptionError) return subscriptionError;

    await ensureBillingRow(guard.userId);
    const currentState = await getEffectiveBillingRow(guard.userId);

    const openAiKey = process.env.OPENAI_API_KEY?.trim();
    if (!openAiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY fehlt." }, { status: 500 });
    }

    const parsed = hyperrealisticSchema.safeParse(await req.json());
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const detail = issue ? `${issue.path.join(".")}: ${issue.message}` : "Payload validation failed.";
      return NextResponse.json({ error: `Ungueltige Anfrage. ${detail}` }, { status: 400 });
    }
    const input = parsed.data;

    const brandProfile = getBrandProfileFromMetadata(guard.userMetadata);
    const brandProfileContext = buildBrandProfilePromptContext(brandProfile);

    // Referenzbild (Etikett) aufloesen — wird sowohl fuer Claude-Vision (Prompt)
    // als auch fuer OpenAI image-to-image (Etikett-Treue) genutzt.
    // Fallback ist der gespeicherte Etikett-Traeger (bester Packshot der Analyse),
    // NICHT brandReferenceImageUrls[0] — das sind seit der Szenen-zuerst-Auswahl
    // Stimmungsbilder ohne verlaessliches Etikett.
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
    if (wantsBrandLabel && hasEtikettInput) {
      try {
        visionReference = await resolveReferenceImageForVision(effectiveEtikettBild, guard.userMetadata);
      } catch (visionError) {
        console.warn("[inhalte-erstellen/create-task] vision reference resolve failed:", visionError);
      }
    }

    const useProductPhoto =
      wantsBrandLabel && input.behaelter !== "G" && Boolean(visionReference);

    if (wantsBrandLabel && input.behaelter !== "G" && !visionReference) {
      console.warn(
        "[inhalte-erstellen/create-task] Etikett-Foto nicht aufloesbar:",
        effectiveEtikettBild.slice(0, 120),
      );
      return NextResponse.json(
        {
          error:
            "Das Etikett-Foto konnte nicht geladen werden. Bitte das Flaschenfoto der Sorte erneut hochladen — ohne dieses Bild kann das Etikett nicht 1:1 übernommen werden.",
        },
        { status: 422 },
      );
    }

    // Mit Produktfoto: kurzen i2i-Prompt, kein Claude-Rewrite.
    // Claude hat das Etikett aus dem Markennamen nachgebaut — die Bild-KI folgt dann dem Text, nicht dem Foto.
    let prompt: string;
    if (useProductPhoto) {
      prompt = buildProductPlacementPrompt(input);
    } else {
      prompt = buildHyperrealisticPrompt(input, { breweryName: brandProfile.breweryName });
      const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
      if (anthropicKey) {
        try {
          const anthropic = new Anthropic({ apiKey: anthropicKey });
          prompt = await generateBrauereiBildPrompt({
            anthropic,
            userMessage: buildHyperrealisticClaudeUserMessage(input, {
              breweryName: brandProfile.breweryName,
              hasReferenceImage: Boolean(visionReference),
            }),
            brandProfileContext,
            maxTokens: 1400,
            temperature: 0.35,
            referenceImages: visionReference ? [visionReference] : undefined,
          });
        } catch (skillError) {
          console.warn("[inhalte-erstellen/create-task] brauerei-bild skill fallback:", skillError);
        }
      }
      prompt = enforceHyperrealisticPromptConstraints(prompt, input, brandProfile.breweryName);
      prompt = applyContentPresetPrompt(prompt, "hyperreal");
    }
    if (prompt.length > MAX_PROMPT_CHARS) prompt = prompt.slice(0, MAX_PROMPT_CHARS);

    const useImageReference = shouldUseImageReferenceForGeneration(input) && hasEtikettInput;
    const editReference = useProductPhoto ? visionReference : useImageReference ? visionReference : null;

    const shapeReference =
      input.behaelter === "G" || editReference
        ? null
        : await loadBottleShapeReference(input.flaschenTyp);
    const referenceImages = [editReference, shapeReference].filter(
      (ref): ref is OpenAiReferenceImage => Boolean(ref),
    );
    if (editReference && !useProductPhoto) {
      prompt = `${prompt}\n\nREFERENCE IMAGE (MANDATORY, 1:1): This photo is the exact product. Keep the printed label identical. Do not invent a different label.`;
      if (prompt.length > MAX_PROMPT_CHARS) prompt = prompt.slice(0, MAX_PROMPT_CHARS);
    } else if (shapeReference) {
      prompt = `${prompt}\n\nREFERENCE IMAGE: This studio photo defines the bottle SHAPE only. Ignore its background. Do not copy any label from it.`;
      if (prompt.length > MAX_PROMPT_CHARS) prompt = prompt.slice(0, MAX_PROMPT_CHARS);
    }

    // 3) Bild-Qualitaet + Billing vorbereiten.
    // gpt-image-2 "high" ist sehr langsam (~120s/Bild). "medium" (~40s) ist der
    // Standard-Kompromiss; per Env uebersteuerbar.
    const qualityEnv = process.env.OPENAI_IMAGE_QUALITY?.trim().toLowerCase();
    const openAiQuality: "low" | "medium" | "high" =
      qualityEnv === "low" || qualityEnv === "high" ? qualityEnv : "medium";
    const billingResolution = (openAiQuality === "high" ? "2K" : "1K") as "1K" | "2K";
    const hasReferenceForBilling = Boolean(editReference);
    const strictLabelMode = input.etikettModus === "marke" && hasReferenceForBilling;
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

    // 4) N Varianten synchron via OpenAI rendern, Ergebnis in Supabase Storage ablegen.
    const model = process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-2";
    const size = mapAspectRatioToOpenAiSize(input.aspectRatio);

    const renderOne = async (variantIndex: number): Promise<string> => {
      const buffer = await generateOpenAiImage({
        apiKey: openAiKey,
        model,
        prompt,
        size,
        outputFormat: OUTPUT_FORMAT,
        quality: openAiQuality,
        referenceImages,
      });
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

    const settled = await Promise.allSettled(
      Array.from({ length: variantsToCreate }, (_, i) => renderOne(i)),
    );
    const images: string[] = [];
    const errors: string[] = [];
    const providerFailures: ProviderError[] = [];
    for (const [index, result] of settled.entries()) {
      if (result.status === "fulfilled") {
        images.push(result.value);
        continue;
      }
      const reason = result.reason;
      if (isProviderError(reason)) {
        providerFailures.push(reason);
        errors.push(reason.classified.userMessage);
        continue;
      }
      errors.push(reason instanceof Error ? reason.message : `Variante ${index + 1}: Unbekannter Fehler.`);
    }

    if (images.length === 0) {
      // Kein Token-Abzug: `consumeTokens` laeuft erst nach erfolgreichen Bildern.
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

    // 5) Tokens NUR fuer erfolgreich gelieferte Bilder verbuchen (eine atomare Buchung).
    const totalConsumed = perVariantCost * images.length;
    const consumeResult = await consumeTokens(guard.userId, totalConsumed);
    if (!consumeResult.ok) {
      return NextResponse.json({ error: consumeResult.error }, { status: 402 });
    }

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
      outputFormat: OUTPUT_FORMAT,
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
