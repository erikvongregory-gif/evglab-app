import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { enforceRateLimitPersistent, enforceSameOrigin } from "@/lib/security/requestGuards";
import { analyzeWebsiteBrand, computeAnalysisConfidence, selectBeerProductImageIndices } from "@/lib/brand/brand-analysis";
import { storeBrandReferenceImagesAsUrls } from "@/lib/brand/persist-reference-urls";
import { isInstagramUrl, normalizeWebsiteUrl, safeFetchHtml } from "@/lib/brand/url-intake";
import {
  intakeWebsiteFromHtml,
  pickImagesByIndices,
  pickTopProductImagesHeuristic,
} from "@/lib/brand/website-intake";

export const runtime = "nodejs";
export const maxDuration = 120;

const bodySchema = z.object({
  websiteUrl: z.string().min(4).max(1200),
});

export async function POST(req: Request) {
  try {
    const rateError = await enforceRateLimitPersistent(req, {
      keyPrefix: "brand-analyze-url",
      limit: 8,
      windowMs: 60_000,
    });
    if (rateError) return rateError;
    const originError = enforceSameOrigin(req);
    if (originError) return originError;

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase ist nicht konfiguriert." }, { status: 500 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Ungueltige Website-URL." }, { status: 400 });
    }

    const normalizedUrl = normalizeWebsiteUrl(parsed.data.websiteUrl);
    if (!normalizedUrl) {
      return NextResponse.json({ error: "Bitte eine gueltige Website-URL eingeben (https://…)." }, { status: 400 });
    }

    if (isInstagramUrl(normalizedUrl)) {
      return NextResponse.json(
        {
          error: "Instagram-Links kommen bald. Bitte nutze vorerst die Website deiner Brauerei oder den manuellen Upload.",
          code: "instagram_not_supported_v1",
        },
        { status: 400 },
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY fehlt." }, { status: 500 });
    }

    let fetched;
    try {
      fetched = await safeFetchHtml(normalizedUrl);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Website konnte nicht geladen werden.";
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const intake = await intakeWebsiteFromHtml(fetched.html, fetched.finalUrl);
    const heuristicReferences = pickTopProductImagesHeuristic(intake.downloadedImages);
    const needsVisionFilter = intake.downloadedImages.length > 8 && heuristicReferences.length < 3;

    const visionIndices = needsVisionFilter
      ? await selectBeerProductImageIndices({
          apiKey,
          images: intake.downloadedImages.map((image) => ({
            base64: image.base64,
            mediaType: image.mediaType,
          })),
          imageHints: intake.downloadedImages.map((image) => ({ alt: image.alt, url: image.url })),
        })
      : [];

    const referenceImages =
      visionIndices.length > 0
        ? pickImagesByIndices(intake.downloadedImages, visionIndices)
        : heuristicReferences.length > 0
          ? heuristicReferences
          : intake.downloadedImages.slice(0, 5);

    let scan;
    try {
      scan = await analyzeWebsiteBrand({
        apiKey,
        websiteUrl: fetched.finalUrl,
        textExcerpt: intake.textExcerpt,
        images: referenceImages.map((image) => ({
          base64: image.base64,
          mediaType: image.mediaType,
        })),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "KI-Analyse fehlgeschlagen.";
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    let referenceImageUrls: string[] = [];
    if (referenceImages.length > 0) {
      try {
        referenceImageUrls = await storeBrandReferenceImagesAsUrls(
          referenceImages.map((image) => ({
            base64: image.base64,
            mime: image.mime,
            sourceUrl: image.url,
          })),
          { preferSourceUrls: true },
        );
      } catch (persistError) {
        console.warn("[brand/analyze-url] reference URL storage failed:", persistError);
      }
    }

    const confidence = computeAnalysisConfidence({
      textExcerpt: intake.textExcerpt,
      imageCount: referenceImages.length,
    });

    return NextResponse.json({
      ok: true,
      suggestion: {
        ...scan,
        referenceImageUrls,
        ...(referenceImageUrls.length === 0
          ? {
              referenceImagePayloads: referenceImages.map((image) => ({
                base64: image.base64,
                mime: image.mime,
              })),
            }
          : {}),
        brandInstagramUrl: "",
        brandWebsiteUrl: fetched.finalUrl,
        brandProfileSource: "url" as const,
      },
      sourceMeta: {
        pagesFetched: 1,
        imagesScanned: intake.downloadedImages.length,
        imagesAnalyzed: referenceImages.length,
        textExcerpt: intake.textExcerpt.slice(0, 500),
        confidence,
        pageTitle: intake.title,
        imageSelection: visionIndices.length > 0 ? "vision" : referenceImages.length > 0 ? "heuristic" : "text_only",
      },
    });
  } catch (e) {
    console.error("[brand/analyze-url]", e);
    const msg = e instanceof Error ? e.message : "Website-Analyse fehlgeschlagen.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
