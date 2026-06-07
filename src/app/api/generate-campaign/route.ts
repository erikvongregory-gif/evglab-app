import { NextResponse } from "next/server";
import { requireImageGenerationUser } from "@/app/(dashboard)/inhalte-erstellen/lib/api-guards";
import { aspectRatioToImageSize, generateCampaignImage } from "@/app/(dashboard)/inhalte-erstellen/lib/image-clients/openai-image";
import { buildCampaignTextPrompt } from "@/app/(dashboard)/inhalte-erstellen/lib/prompt-builders/campaign-text";
import { campaignTextSchema } from "@/app/(dashboard)/inhalte-erstellen/lib/schemas";
import { createReferenceResolverFromMetadata, assertResolvableReferenceUrls, resolveReferenceUrlsForGeneration } from "@/lib/brand/resolve-reference-for-generation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { canUseCampaignWithTextProfile, getBrandProfileFromMetadata } from "@/lib/dashboard/brandProfile";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const guard = await requireImageGenerationUser(req, "generate-campaign");
    if (!guard.ok) return guard.response;

    if (isSupabaseConfigured()) {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const profile = getBrandProfileFromMetadata(user.user_metadata);
        if (!canUseCampaignWithTextProfile(profile)) {
          return NextResponse.json(
            {
              error:
                "Kampagnenbild mit Text ist nur mit einem angelegten Markenprofil moeglich. Bitte lege zuerst dein Markenprofil im Dashboard an.",
              code: "campaign_requires_guided_brand_profile",
            },
            { status: 403 },
          );
        }
      }
    }

    const parsed = campaignTextSchema.safeParse(await req.json());
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const detail = issue ? `${issue.path.join(".")}: ${issue.message}` : "Payload validation failed.";
      return NextResponse.json({ error: `Ungültige Anfrage. ${detail}` }, { status: 400 });
    }

    const input = parsed.data;
    const prompt = buildCampaignTextPrompt(input);
    const origin = new URL(req.url).origin;
    assertResolvableReferenceUrls(guard.userMetadata, origin, input.referenzBilder);
    const referenzBilder = resolveReferenceUrlsForGeneration(guard.userMetadata, origin, input.referenzBilder);
    const images = await generateCampaignImage({
      prompt,
      feedReferenzen: referenzBilder,
      size: aspectRatioToImageSize(input.aspectRatio),
      quality: input.quality,
      resolveReferenceUrl: createReferenceResolverFromMetadata(guard.userMetadata),
    });

    return NextResponse.json({
      mode: "campaign_text",
      prompt,
      images,
      model: "gpt-image-2-2026-04-21",
      userId: guard.userId,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Kampagnen-Generierung fehlgeschlagen." },
      { status: 500 },
    );
  }
}
