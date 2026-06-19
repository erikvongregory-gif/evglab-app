import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireImageGenerationUser } from "@/app/(dashboard)/inhalte-erstellen/lib/api-guards";
import { buildHyperrealisticPrompt } from "@/app/(dashboard)/inhalte-erstellen/lib/prompt-builders/hyperrealistic";
import {
  enforceHyperrealisticPromptConstraints,
  shouldUseImageReferenceForGeneration,
} from "@/app/(dashboard)/inhalte-erstellen/lib/prompt-builders/enforce-prompt-constraints";
import { hyperrealisticSchema } from "@/app/(dashboard)/inhalte-erstellen/lib/schemas";
import { resolveReferenceImageForVision } from "@/lib/brand/reference-image-bytes";
import { buildBrandProfilePromptContext, getBrandProfileFromMetadata } from "@/lib/dashboard/brandProfile";
import { calculateGenerationTokenCost, calculatePerVariantTokenCost } from "@/lib/billing/generationTokenCost";
import { consumeTokens, ensureBillingRow, getBillingRow } from "@/lib/billing/store";
import { requireActiveSubscription } from "@/lib/billing/access";
import { generateBrauereiBildPrompt } from "@/lib/prompts/brauerei-bild/generate-prompt";
import { buildHyperrealisticClaudeUserMessage } from "@/lib/prompts/brauerei-bild/map-hyperrealistic-brief";
import { applyContentPresetPrompt } from "@/lib/image-types/policy";
import { generateOpenAiImage, mapAspectRatioToOpenAiSize } from "@/lib/openai/generateImage";
import { uploadGeneratedImageToStorage } from "@/lib/supabase/storage";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_PROMPT_CHARS = 12_000;
const DEFAULT_VARIANT_COUNT = 3;
const OUTPUT_FORMAT: "png" = "png";

export async function POST(req: Request) {
  try {
    const guard = await requireImageGenerationUser(req, "inhalte-erstellen-create-task");
    if (!guard.ok) return guard.response;

    const subscriptionError = await requireActiveSubscription(guard.userId);
    if (subscriptionError) return subscriptionError;

    await ensureBillingRow(guard.userId);
    const currentState = await getBillingRow(guard.userId);

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
    const wantsBrandLabel = input.etikettModus !== "generisch";
    const profileReferenceUrl = brandProfile.brandReferenceImageUrls[0]?.trim() || "";
    let effectiveEtikettBild = input.etikettBild?.trim() ?? "";
    if (
      wantsBrandLabel &&
      (!effectiveEtikettBild || effectiveEtikettBild.includes("example.com/placeholder")) &&
      profileReferenceUrl
    ) {
      effectiveEtikettBild = profileReferenceUrl;
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

    // 1) Prompt via Claude (Skill) erzeugen — Fallback: lokaler Builder.
    let prompt = buildHyperrealisticPrompt(input, { breweryName: brandProfile.breweryName });
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
    if (prompt.length > MAX_PROMPT_CHARS) prompt = prompt.slice(0, MAX_PROMPT_CHARS);
    prompt = enforceHyperrealisticPromptConstraints(prompt, input, brandProfile.breweryName);
    prompt = applyContentPresetPrompt(prompt, "hyperreal");
    if (prompt.length > MAX_PROMPT_CHARS) prompt = prompt.slice(0, MAX_PROMPT_CHARS);

    // 2) Referenz fuer OpenAI image-to-image — NICHT bei „Nur Glas" / generisch.
    const useImageReference = shouldUseImageReferenceForGeneration(input) && hasEtikettInput;
    const editReference = useImageReference ? visionReference : null;

    // 3) Billing vorbereiten.
    const billingResolution = (input.quality === "high" ? "2K" : "1K") as "1K" | "2K";
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
        quality: "high",
        referenceImage: editReference,
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
    settled.forEach((result, index) => {
      if (result.status === "fulfilled") {
        images.push(result.value);
      } else {
        const reason = result.reason;
        errors.push(
          reason instanceof Error ? reason.message : `Variante ${index + 1}: Unbekannter Fehler.`,
        );
      }
    });

    if (images.length === 0) {
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bildgenerierung fehlgeschlagen." },
      { status: 500 },
    );
  }
}
