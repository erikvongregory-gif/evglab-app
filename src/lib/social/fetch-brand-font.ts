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
    const res = await fetch(trimmed, { cache: "no-store" });
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    if (!arrayBuffer.byteLength) return null;
    return {
      buffer: Buffer.from(arrayBuffer),
      mime: res.headers.get("content-type")?.split(";")[0]?.trim() || mimeFromUrl(trimmed),
    };
  } catch {
    return null;
  }
}
