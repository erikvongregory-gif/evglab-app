const FONT_MIME_BY_EXT: Record<string, string> = {
  woff2: "font/woff2",
  woff: "font/woff",
  ttf: "font/ttf",
  otf: "font/otf",
};

function mimeFromUrl(url: string): string {
  const lower = url.toLowerCase();
  for (const [ext, mime] of Object.entries(FONT_MIME_BY_EXT)) {
    if (lower.includes(`.${ext}`)) return mime;
  }
  return "font/woff2";
}

export async function fetchBrandFontBuffer(
  url: string,
): Promise<{ buffer: Buffer; mime: string } | null> {
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const res = await publicFetch(trimmed, {
      maxBytes: 8 * 1024 * 1024,
      timeoutMs: 8_000,
      headers: { Accept: "font/woff2,font/woff,font/ttf,font/otf,application/octet-stream" },
    });
    if (res.status < 200 || res.status >= 300 || !res.body.byteLength) return null;
    const responseMime = res.headers["content-type"]?.split(";")[0]?.trim();
    return {
      buffer: res.body,
      mime: responseMime && Object.values(FONT_MIME_BY_EXT).includes(responseMime)
        ? responseMime
        : mimeFromUrl(res.finalUrl),
    };
  } catch {
    return null;
  }
}
import { publicFetch } from "@/lib/security/public-fetch";
