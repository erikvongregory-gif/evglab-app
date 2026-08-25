import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { enforceRateLimitPersistent, enforceSameOrigin } from "@/lib/security/requestGuards";
import { analyzeWebsiteBrand, computeAnalysisConfidence, selectBeerProductImageIndices } from "@/lib/brand/brand-analysis";
import { storeBrandReferenceImagesAsUrls } from "@/lib/brand/persist-reference-urls";
import { isInstagramUrl, normalizeWebsiteUrl, safeFetchHtml } from "@/lib/brand/url-intake";
import {
  downloadCandidateImages,
  extractRelevantInternalLinks,
  mergeParsedWebsitePages,
  parseWebsiteHtml,
  pickBrandReferenceImages,
  pickImagesByIndices,
  type ParsedWebsitePage,
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

    // Startseite + bis zu 2 marken-relevante Unterseiten (Ueber uns, Sortiment …) analysieren.
    const homepage = parseWebsiteHtml(fetched.html, fetched.finalUrl);
    const subpageLinks = extractRelevantInternalLinks(fetched.html, fetched.finalUrl, 2);
    const subpages = (
      await Promise.all(
        subpageLinks.map(async (link) => {
          try {
            const sub = await safeFetchHtml(link.url);
            return parseWebsiteHtml(sub.html, sub.finalUrl);
          } catch {
            return null;
          }
        }),
      )
    ).filter((page): page is ParsedWebsitePage => page !== null);

    const intake = mergeParsedWebsitePages([homepage, ...subpages]);
    const downloadedImages = await downloadCandidateImages(intake.imageCandidates);

    // Referenzbilder = Markenwelt: Szenen mit echtem Hintergrund zuerst, Packshots nur als Notloesung.
    const heuristicReferences = pickBrandReferenceImages(downloadedImages);
    const heuristicSceneCount = heuristicReferences.filter((image) => !image.isPackshot).length;
    const needsVisionFilter = downloadedImages.length > 4 && heuristicSceneCount < 2;

    const visionIndices = needsVisionFilter
      ? await selectBeerProductImageIndices({
          apiKey,
          images: downloadedImages.map((image) => ({
            base64: image.base64,
            mediaType: image.mediaType,
          })),
          imageHints: downloadedImages.map((image) => ({ alt: image.alt, url: image.url })),
        })
      : [];
    const visionReferences =
      visionIndices.length > 0
        ? pickBrandReferenceImages(pickImagesByIndices(downloadedImages, visionIndices), {
            minScore: Number.NEGATIVE_INFINITY,
          })
        : [];

    const referenceImages =
      visionReferences.length > 0
        ? visionReferences
        : heuristicReferences.length > 0
          ? heuristicReferences
          : pickBrandReferenceImages(downloadedImages, { minScore: Number.NEGATIVE_INFINITY });

    // Die KI-Analyse sieht Szenen (Bildsprache) + bis zu 2 Packshots (nur Farbpalette/Etikett).
    const analysisScenes = referenceImages.filter((image) => !image.isPackshot);
    const analysisPackshots = downloadedImages
      .filter((image) => image.isPackshot)
      .sort((a, b) => b.productScore - a.productScore)
      .slice(0, 2);
    // Bester Packshot = Etikett-Traeger: wird separat gespeichert und dient der
    // Generierung als Etikett-Referenz (die Referenzbilder selbst sind Szenen).
    const brandLabelReferenceUrl = analysisPackshots[0]?.url ?? "";
    const analysisImages = [...analysisScenes, ...analysisPackshots].slice(0, 6);
    const analysisPackshotCount = analysisImages.filter((image) => image.isPackshot).length;

    let scan;
    try {
      scan = await analyzeWebsiteBrand({
        apiKey,
        websiteUrl: fetched.finalUrl,
        textExcerpt: intake.textExcerpt,
        images: analysisImages.map((image) => ({
          base64: image.base64,
          mediaType: image.mediaType,
        })),
        packshotImageCount: analysisPackshotCount,
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
      imageCount: analysisImages.length,
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
        brandLabelReferenceUrl,
      },
      sourceMeta: {
        pagesFetched: 1 + subpages.length,
        imagesScanned: downloadedImages.length,
        imagesAnalyzed: analysisImages.length,
        sceneImages: analysisScenes.length,
        packshotImages: analysisPackshotCount,
        textExcerpt: intake.textExcerpt.slice(0, 500),
        confidence,
        pageTitle: intake.title,
        imageSelection: visionReferences.length > 0 ? "vision" : referenceImages.length > 0 ? "heuristic" : "text_only",
      },
    });
  } catch (e) {
    console.error("[brand/analyze-url]", e);
    const msg = e instanceof Error ? e.message : "Website-Analyse fehlgeschlagen.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
