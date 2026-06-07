import { uploadImagesToKie } from "@/lib/brand/kie-upload";
import { prepareReferenceImagePayloads } from "@/lib/brand/reference-image-store";

export type BrandReferenceImageInput = {
  base64: string;
  mime: string;
  /** Original-URL (z. B. von der Brauerei-Website) — nur https/http. */
  sourceUrl?: string;
};

function filterPublicHttpUrls(urls: Array<string | undefined>): string[] {
  const out: string[] = [];
  for (const raw of urls) {
    const trimmed = raw?.trim();
    if (!trimmed) continue;
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
      out.push(parsed.toString());
      if (out.length >= 5) break;
    } catch {
      /* skip */
    }
  }
  return out;
}

/**
 * Speichert Marken-Referenzen als kurze HTTPS-URLs (KIE oder Website),
 * niemals als Base64 in user_metadata (JWT/Cookie-Limit).
 */
export async function storeBrandReferenceImagesAsUrls(
  images: BrandReferenceImageInput[],
  options: { preferSourceUrls?: boolean } = {},
): Promise<string[]> {
  if (images.length === 0) return [];

  const payloads = await prepareReferenceImagePayloads(
    images.map((image) => ({ base64: image.base64, mime: image.mime })),
  );

  const kieKey = process.env.KIE_API_KEY?.trim();
  if (kieKey && payloads.length > 0) {
    const kieUrls = await uploadImagesToKie(kieKey, payloads);
    if (kieUrls.length > 0) return kieUrls.slice(0, 5);
  }

  if (options.preferSourceUrls) {
    const sourceUrls = filterPublicHttpUrls(images.map((image) => image.sourceUrl));
    if (sourceUrls.length > 0) return sourceUrls;
  }

  return [];
}
