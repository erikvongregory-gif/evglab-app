import { reserveGeneration } from "@/lib/billing/generationJobs";
import { NextResponse } from "next/server";
import { requireBillableImageGenerationUser } from "@/app/(dashboard)/inhalte-erstellen/lib/api-guards";
import { aspectRatioToImageSize, generateHyperrealistic, toOpenAiApiQuality } from "@/app/(dashboard)/inhalte-erstellen/lib/image-clients/openai-image";
import { buildImagePromptV3, normalizeV3Input } from "@/lib/inhalte-erstellen/image-prompt-v3";
import { hyperrealisticSchema } from "@/app/(dashboard)/inhalte-erstellen/lib/schemas";
import { resolveReferenceImageForVision } from "@/lib/brand/reference-image-bytes";
import { createReferenceResolverFromMetadata, assertResolvableReferenceUrls, resolveReferenceUrlsForGeneration } from "@/lib/brand/resolve-reference-for-generation";
import { getBrandProfileFromMetadata } from "@/lib/dashboard/brandProfile";
import { chargeGeneratedTokens, requireTokenBudget } from "@/lib/billing/generationBilling";
import { calculatePerVariantTokenCost, resolveImageBillingResolution } from "@/lib/billing/generationTokenCost";

export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(req: Request) {
  try {
    const guard = await requireBillableImageGenerationUser(req, "generate-hyperrealistic");
    if (!guard.ok) return guard.response;

    const parsed = hyperrealisticSchema.safeParse(await req.json());
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const detail = issue ? `${issue.path.join(".")}: ${issue.message}` : "Payload validation failed.";
      return NextResponse.json({ error: `Ungültige Anfrage. ${detail}` }, { status: 400 });
    }

    const input = normalizeV3Input(parsed.data);
    const hasReferenceImage = input.etikettModus !== "generisch" && Boolean(input.etikettBild);
    const perImageCost = calculatePerVariantTokenCost({
      resolution: resolveImageBillingResolution({
        hasProductPhoto: hasReferenceImage,
        compiledOrRequestedQuality: input.quality,
      }),
      hasReferenceImage,
      strictLabelMode: input.etikettModus === "marke" && hasReferenceImage,
    });
    const budgetError = await requireTokenBudget(guard.userId, perImageCost);
    if (budgetError) return budgetError;
    const job = await reserveGeneration(req,guard.userId,perImageCost * 2,input);
    if(job instanceof NextResponse)return job;

    const origin = new URL(req.url).origin;
    assertResolvableReferenceUrls(guard.userMetadata, origin, [input.etikettBild]);
    const etikettUrl = resolveReferenceUrlsForGeneration(guard.userMetadata, origin, [input.etikettBild])[0] ?? input.etikettBild;

    const brandProfile = getBrandProfileFromMetadata(guard.userMetadata);

    // Referenzbild als Vision-Input fuer Claude vorbereiten (Skill-Schritt A–D).
    let visionReference = null as Awaited<ReturnType<typeof resolveReferenceImageForVision>>;
    if (input.etikettModus !== "generisch" && input.etikettBild) {
      try {
        visionReference = await resolveReferenceImageForVision(input.etikettBild, guard.userMetadata);
      } catch (visionError) {
        console.warn("[generate-hyperrealistic] vision reference resolve failed:", visionError);
      }
    }

    const prompt = buildImagePromptV3({ input, references: visionReference ? [{ index: 1, role: "product" }] : [], breweryName: brandProfile.breweryName });

    const images = await generateHyperrealistic({
      prompt,
      etikettUrl,
      size: aspectRatioToImageSize(input.aspectRatio),
      quality: toOpenAiApiQuality(input.quality),
      resolveReferenceUrl: createReferenceResolverFromMetadata(guard.userMetadata),
    });

    const charge = await chargeGeneratedTokens(job, perImageCost * images.length, {images,prompt});

    return NextResponse.json({
      mode: "hyperrealistic",
      prompt,
      images,
      model: "gpt-image-2.5-sunburst",
      userId: guard.userId,
      billing: charge.billing,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Hyperrealistische Generierung fehlgeschlagen." },
      { status: 500 },
    );
  }
}
