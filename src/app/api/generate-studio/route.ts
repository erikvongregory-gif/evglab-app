import { NextResponse } from "next/server";
import { requireImageGenerationUser } from "@/app/(dashboard)/inhalte-erstellen/lib/api-guards";
import { aspectRatioToImageSize, generateProductStudio } from "@/app/(dashboard)/inhalte-erstellen/lib/image-clients/openai-image";
import { buildProductStudioPrompt } from "@/app/(dashboard)/inhalte-erstellen/lib/prompt-builders/product-studio";
import { productStudioSchema } from "@/app/(dashboard)/inhalte-erstellen/lib/schemas";
import { createReferenceResolverFromMetadata, assertResolvableReferenceUrls, resolveReferenceUrlsForGeneration } from "@/lib/brand/resolve-reference-for-generation";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const guard = await requireImageGenerationUser(req, "generate-studio");
    if (!guard.ok) return guard.response;

    const parsed = productStudioSchema.safeParse(await req.json());
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const detail = issue ? `${issue.path.join(".")}: ${issue.message}` : "Payload validation failed.";
      return NextResponse.json({ error: `Ungültige Anfrage. ${detail}` }, { status: 400 });
    }

    const input = parsed.data;
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

    return NextResponse.json({
      mode: "product_studio",
      prompt,
      images,
      model: "gpt-image-2-2026-04-21",
      userId: guard.userId,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Studio-Generierung fehlgeschlagen." },
      { status: 500 },
    );
  }
}
