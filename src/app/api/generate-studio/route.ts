import { NextResponse } from "next/server";
import { requireBillableImageGenerationUser } from "@/app/(dashboard)/inhalte-erstellen/lib/api-guards";
import { aspectRatioToImageSize, generateProductStudio } from "@/app/(dashboard)/inhalte-erstellen/lib/image-clients/openai-image";
import { buildProductStudioPrompt } from "@/app/(dashboard)/inhalte-erstellen/lib/prompt-builders/product-studio";
import { productStudioSchema } from "@/app/(dashboard)/inhalte-erstellen/lib/schemas";
import { createReferenceResolverFromMetadata, assertResolvableReferenceUrls, resolveReferenceUrlsForGeneration } from "@/lib/brand/resolve-reference-for-generation";
import { chargeGeneratedTokens, requireTokenBudget } from "@/lib/billing/generationBilling";
import { calculatePerVariantTokenCost } from "@/lib/billing/generationTokenCost";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const guard = await requireBillableImageGenerationUser(req, "generate-studio");
    if (!guard.ok) return guard.response;

    const parsed = productStudioSchema.safeParse(await req.json());
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const detail = issue ? `${issue.path.join(".")}: ${issue.message}` : "Payload validation failed.";
      return NextResponse.json({ error: `Ungültige Anfrage. ${detail}` }, { status: 400 });
    }

    const input = parsed.data;
    const perImageCost = calculatePerVariantTokenCost({
      resolution: input.quality === "high" ? "2K" : "1K",
      hasReferenceImage: true,
    });
    const budgetError = await requireTokenBudget(guard.userId, perImageCost);
    if (budgetError) return budgetError;

    const prompt = buildProductStudioPrompt(input);
    const origin = new URL(req.url).origin;
    assertResolvableReferenceUrls(guard.userMetadata, origin, [input.referenzBild]);
    const referenzBildUrl = resolveReferenceUrlsForGeneration(guard.userMetadata, origin, [input.referenzBild])[0] ?? input.referenzBild;
    const images = await generateProductStudio({
      prompt,
      referenzBildUrl,
      size: aspectRatioToImageSize(input.aspectRatio),
      quality: input.quality,
      resolveReferenceUrl: createReferenceResolverFromMetadata(guard.userMetadata),
    });

    const charge = await chargeGeneratedTokens(guard.userId, perImageCost * Math.max(images.length, 1));
    if (!charge.ok) return charge.response;

    return NextResponse.json({
      mode: "product_studio",
      prompt,
      images,
      model: "gpt-image-2-2026-04-21",
      userId: guard.userId,
      billing: charge.billing,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Studio-Generierung fehlgeschlagen." },
      { status: 500 },
    );
  }
}
