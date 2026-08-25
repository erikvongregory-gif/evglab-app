import { NextResponse } from "next/server";
import { requireBillableImageGenerationUser } from "@/app/(dashboard)/inhalte-erstellen/lib/api-guards";
import { aspectRatioToImageSize, generateCampaignImage } from "@/app/(dashboard)/inhalte-erstellen/lib/image-clients/openai-image";
import { buildCampaignTextPrompt } from "@/app/(dashboard)/inhalte-erstellen/lib/prompt-builders/campaign-text";
import { campaignTextSchema } from "@/app/(dashboard)/inhalte-erstellen/lib/schemas";
import { createReferenceResolverFromMetadata, assertResolvableReferenceUrls, resolveReferenceUrlsForGeneration } from "@/lib/brand/resolve-reference-for-generation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { canUseCampaignWithTextProfile, getBrandProfileFromMetadata } from "@/lib/dashboard/brandProfile";
import { chargeGeneratedTokens, requireTokenBudget } from "@/lib/billing/generationBilling";
import { calculatePerVariantTokenCost } from "@/lib/billing/generationTokenCost";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const guard = await requireBillableImageGenerationUser(req, "generate-campaign");
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
                "Kampagnenbild mit Text ist nur mit aktivem Markenprofil möglich. Lege es im Dashboard unter „Markenprofil“ an — ein Website-Link genügt.",
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
    const perImageCost = calculatePerVariantTokenCost({
      resolution: input.quality === "high" ? "2K" : "1K",
      hasReferenceImage: (input.referenzBilder?.length ?? 0) > 0,
    });
    const budgetError = await requireTokenBudget(guard.userId, perImageCost);
    if (budgetError) return budgetError;

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

    const charge = await chargeGeneratedTokens(guard.userId, perImageCost * Math.max(images.length, 1));
    if (!charge.ok) return charge.response;

    return NextResponse.json({
      mode: "campaign_text",
      prompt,
      images,
      model: "gpt-image-2-2026-04-21",
      userId: guard.userId,
      billing: charge.billing,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Kampagnen-Generierung fehlgeschlagen." },
      { status: 500 },
    );
  }
}
