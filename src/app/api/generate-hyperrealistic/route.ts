import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireBillableImageGenerationUser } from "@/app/(dashboard)/inhalte-erstellen/lib/api-guards";
import { aspectRatioToImageSize, generateHyperrealistic } from "@/app/(dashboard)/inhalte-erstellen/lib/image-clients/openai-image";
import { buildHyperrealisticPrompt } from "@/app/(dashboard)/inhalte-erstellen/lib/prompt-builders/hyperrealistic";
import { hyperrealisticSchema } from "@/app/(dashboard)/inhalte-erstellen/lib/schemas";
import { resolveReferenceImageForVision } from "@/lib/brand/reference-image-bytes";
import { createReferenceResolverFromMetadata, assertResolvableReferenceUrls, resolveReferenceUrlsForGeneration } from "@/lib/brand/resolve-reference-for-generation";
import { buildBrandProfilePromptContext, getBrandProfileFromMetadata } from "@/lib/dashboard/brandProfile";
import { buildHyperrealisticClaudeUserMessage } from "@/lib/prompts/brauerei-bild/map-hyperrealistic-brief";
import { generateBrauereiBildPrompt } from "@/lib/prompts/brauerei-bild/generate-prompt";
import { applyContentPresetPrompt } from "@/lib/image-types/policy";
import {
  enforceHyperrealisticPromptConstraints,
} from "@/app/(dashboard)/inhalte-erstellen/lib/prompt-builders/enforce-prompt-constraints";

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

    const input = parsed.data;
    const origin = new URL(req.url).origin;
    assertResolvableReferenceUrls(guard.userMetadata, origin, [input.etikettBild]);
    const etikettUrl = resolveReferenceUrlsForGeneration(guard.userMetadata, origin, [input.etikettBild])[0] ?? input.etikettBild;

    const brandProfile = getBrandProfileFromMetadata(guard.userMetadata);
    const brandProfileContext = buildBrandProfilePromptContext(brandProfile);

    // Referenzbild als Vision-Input fuer Claude vorbereiten (Skill-Schritt A–D).
    let visionReference = null as Awaited<ReturnType<typeof resolveReferenceImageForVision>>;
    if (input.etikettModus !== "generisch" && input.etikettBild) {
      try {
        visionReference = await resolveReferenceImageForVision(input.etikettBild, guard.userMetadata);
      } catch (visionError) {
        console.warn("[generate-hyperrealistic] vision reference resolve failed:", visionError);
      }
    }

    let prompt = buildHyperrealisticPrompt(input);
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (apiKey) {
      try {
        const anthropic = new Anthropic({ apiKey });
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
        console.warn("[generate-hyperrealistic] brauerei-bild skill fallback:", skillError);
      }
    }

    prompt = enforceHyperrealisticPromptConstraints(prompt, input, brandProfile.breweryName);
    prompt = applyContentPresetPrompt(prompt, "hyperreal");

    const images = await generateHyperrealistic({
      prompt,
      etikettUrl,
      size: aspectRatioToImageSize(input.aspectRatio),
      quality: input.quality,
      resolveReferenceUrl: createReferenceResolverFromMetadata(guard.userMetadata),
    });

    return NextResponse.json({
      mode: "hyperrealistic",
      prompt,
      images,
      model: "gpt-image-2-2026-04-21",
      userId: guard.userId,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Hyperrealistische Generierung fehlgeschlagen." },
      { status: 500 },
    );
  }
}
