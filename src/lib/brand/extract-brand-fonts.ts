import { publicFetch } from "@/lib/security/public-fetch";
import { BROWSER_USER_AGENT, resolveAbsoluteUrl } from "@/lib/brand/url-intake";
import { uploadBrandFontToStorage } from "@/lib/supabase/storage";

const GENERIC_FAMILIES = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-sans-serif",
  "ui-serif",
  "ui-monospace",
  "ui-rounded",
  "emoji",
  "math",
  "fangsong",
  "inherit",
  "initial",
  "unset",
  "revert",
  "arial",
  "helvetica",
  "helvetica neue",
  "times",
  "times new roman",
  "courier",
  "courier new",
  "georgia",
  "verdana",
  "tahoma",
  "trebuchet ms",
  "geneva",
  "palatino",
  "garamond",
  "bookman",
  "avant garde",
  "comic sans ms",
  "impact",
  "lucida console",
  "lucida sans unicode",
  "ms sans serif",
  "ms serif",
  "-apple-system",
  "blinkmacsystemfont",
  "segoe ui",
]);

const MAX_FONT_BYTES = 2 * 1024 * 1024;

export type BrandFontHint = {
  family: string;
  googleCssUrls: string[];
  faceSrcUrls: string[];
};

function normalizeFamily(raw: string): string {
  return raw
    .replace(/^["']+|["']+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isUsableFamily(family: string): boolean {
  if (!family || family.length < 2 || family.length > 80) return false;
  const key = family.toLowerCase();
  if (GENERIC_FAMILIES.has(key)) return false;
  if (key.startsWith("var(")) return false;
  return true;
}

function decodeGoogleFamilyParam(raw: string): string {
  const primary = raw.split(":")[0] ?? raw;
  return normalizeFamily(decodeURIComponent(primary.replace(/\+/g, " ")));
}

function collectGoogleCssUrls(html: string): string[] {
  const urls: string[] = [];
  const linkRe =
    /<link[^>]+href=["'](https?:\/\/fonts\.googleapis\.com\/css2?[^"']+)["'][^>]*>/gi;
  for (const match of html.matchAll(linkRe)) {
    if (match[1]) urls.push(match[1]);
  }
  const importRe = /@import\s+url\(["']?(https?:\/\/fonts\.googleapis\.com\/css2?[^"')]+)["']?\)/gi;
  for (const match of html.matchAll(importRe)) {
    if (match[1]) urls.push(match[1]);
  }
  return urls;
}

function familiesFromGoogleCssUrl(cssUrl: string): string[] {
  try {
    const url = new URL(cssUrl);
    const families: string[] = [];
    for (const [key, value] of url.searchParams.entries()) {
      if (key === "family" || key.startsWith("family")) {
        families.push(decodeGoogleFamilyParam(value));
      }
    }
    // css?family=Name|Other+Name legacy format
    const legacy = url.searchParams.get("family");
    if (legacy?.includes("|")) {
      for (const part of legacy.split("|")) {
        families.push(decodeGoogleFamilyParam(part));
      }
    }
    return [...new Set(families.filter(isUsableFamily))];
  } catch {
    return [];
  }
}

function collectFontFaceBlocks(html: string, pageUrl: string): Array<{ family: string; srcUrls: string[] }> {
  const blocks: Array<{ family: string; srcUrls: string[] }> = [];
  const faceRe = /@font-face\s*\{([^}]+)\}/gi;
  for (const match of html.matchAll(faceRe)) {
    const body = match[1] ?? "";
    const familyMatch = body.match(/font-family\s*:\s*([^;]+)/i);
    if (!familyMatch?.[1]) continue;
    const family = normalizeFamily(familyMatch[1]);
    if (!isUsableFamily(family)) continue;

    const srcUrls: string[] = [];
    for (const srcMatch of body.matchAll(/url\(["']?([^"')]+)["']?\)/gi)) {
      const raw = srcMatch[1]?.trim();
      if (!raw || raw.startsWith("data:")) continue;
      const absolute = resolveAbsoluteUrl(pageUrl, raw) ?? (/^https?:\/\//i.test(raw) ? raw : null);
      if (!absolute) continue;
      if (/\.(woff2|woff|ttf|otf)(\?|#|$)/i.test(absolute) || absolute.includes("fonts.gstatic.com")) {
        srcUrls.push(absolute.slice(0, 1200));
      }
    }
    blocks.push({ family, srcUrls });
  }
  return blocks;
}

function collectCssFamilyMentions(html: string): Map<string, number> {
  const counts = new Map<string, number>();
  const re = /font-family\s*:\s*([^;}{"']+)/gi;
  for (const match of html.matchAll(re)) {
    const stack = match[1] ?? "";
    const first = normalizeFamily(stack.split(",")[0] ?? "");
    if (!isUsableFamily(first)) continue;
    counts.set(first, (counts.get(first) ?? 0) + 1);
  }
  return counts;
}

/** Erkennt die wahrscheinlichste Markenschrift aus Website-HTML. */
export function extractBrandFontHint(htmlList: string[], pageUrl: string): BrandFontHint | null {
  const googleCssUrls: string[] = [];
  const faceByFamily = new Map<string, string[]>();
  const mentionCounts = new Map<string, number>();

  for (const html of htmlList) {
    for (const cssUrl of collectGoogleCssUrls(html)) {
      googleCssUrls.push(cssUrl);
      for (const family of familiesFromGoogleCssUrl(cssUrl)) {
        mentionCounts.set(family, (mentionCounts.get(family) ?? 0) + 5);
      }
    }
    for (const face of collectFontFaceBlocks(html, pageUrl)) {
      const prev = faceByFamily.get(face.family) ?? [];
      faceByFamily.set(face.family, [...prev, ...face.srcUrls]);
      mentionCounts.set(face.family, (mentionCounts.get(face.family) ?? 0) + 4);
    }
    for (const [family, count] of collectCssFamilyMentions(html)) {
      mentionCounts.set(family, (mentionCounts.get(family) ?? 0) + count);
    }
  }

  if (mentionCounts.size === 0 && faceByFamily.size === 0 && googleCssUrls.length === 0) {
    return null;
  }

  const ranked = [...mentionCounts.entries()].sort((a, b) => b[1] - a[1]);
  const family =
    ranked.find(([name]) => faceByFamily.has(name) || googleCssUrls.some((u) => familiesFromGoogleCssUrl(u).includes(name)))?.[0] ??
    ranked[0]?.[0] ??
    [...faceByFamily.keys()][0] ??
    familiesFromGoogleCssUrl(googleCssUrls[0] ?? "")[0];

  if (!family || !isUsableFamily(family)) return null;

  const relatedGoogle = googleCssUrls.filter((u) => {
    const families = familiesFromGoogleCssUrl(u);
    return families.length === 0 || families.includes(family);
  });

  return {
    family,
    googleCssUrls: [...new Set(relatedGoogle.length ? relatedGoogle : googleCssUrls)].slice(0, 4),
    faceSrcUrls: [...new Set(faceByFamily.get(family) ?? [])].slice(0, 6),
  };
}

function pickWoff2UrlFromCss(cssText: string, family: string): string | null {
  const faceRe = /@font-face\s*\{([^}]+)\}/gi;
  const target = family.toLowerCase();
  for (const match of cssText.matchAll(faceRe)) {
    const body = match[1] ?? "";
    const familyMatch = body.match(/font-family\s*:\s*([^;]+)/i);
    const faceFamily = normalizeFamily(familyMatch?.[1] ?? "").toLowerCase();
    if (faceFamily !== target) continue;
    const urls = [...body.matchAll(/url\(["']?([^"')]+)["']?\)/gi)].map((m) => m[1]?.trim() ?? "");
    const woff2 = urls.find((u) => /\.woff2(\?|#|$)/i.test(u) || u.includes("fonts.gstatic.com"));
    if (woff2) return woff2;
    if (urls[0]) return urls[0];
  }
  // Fallback: first woff2 in file
  const any = cssText.match(/url\(["']?(https?:\/\/[^"')]+\.woff2[^"')]*)["']?\)/i);
  return any?.[1] ?? null;
}

function extFromFontUrl(url: string): "woff2" | "woff" | "ttf" | "otf" | null {
  const match = url.toLowerCase().match(/\.(woff2|woff|ttf|otf)(\?|#|$)/);
  if (match?.[1] === "woff2" || match?.[1] === "woff" || match?.[1] === "ttf" || match?.[1] === "otf") {
    return match[1];
  }
  if (url.includes("fonts.gstatic.com")) return "woff2";
  return null;
}

async function downloadFontBuffer(url: string): Promise<{ buffer: Buffer; ext: "woff2" | "woff" | "ttf" | "otf" } | null> {
  const ext = extFromFontUrl(url);
  if (!ext) return null;
  try {
    const res = await publicFetch(url, {
      maxBytes: MAX_FONT_BYTES,
      timeoutMs: 12_000,
      headers: {
        "User-Agent": BROWSER_USER_AGENT,
        Accept: "font/woff2,font/woff,application/font-woff,*/*",
      },
    });
    if (res.status < 200 || res.status >= 300 || res.body.byteLength < 64) return null;
    return { buffer: res.body, ext };
  } catch {
    return null;
  }
}

async function resolveFontFileUrl(hint: BrandFontHint): Promise<{ buffer: Buffer; ext: "woff2" | "woff" | "ttf" | "otf" } | null> {
  for (const cssUrl of hint.googleCssUrls) {
    try {
      const cssRes = await publicFetch(cssUrl, {
        maxBytes: 256_000,
        timeoutMs: 10_000,
        headers: {
          "User-Agent": BROWSER_USER_AGENT,
          Accept: "text/css,*/*;q=0.1",
        },
      });
      if (cssRes.status < 200 || cssRes.status >= 300) continue;
      const cssText = cssRes.body.toString("utf8");
      const fontUrl = pickWoff2UrlFromCss(cssText, hint.family);
      if (!fontUrl) continue;
      const downloaded = await downloadFontBuffer(fontUrl);
      if (downloaded) return downloaded;
    } catch {
      /* next */
    }
  }

  for (const src of hint.faceSrcUrls) {
    const downloaded = await downloadFontBuffer(src);
    if (downloaded) return downloaded;
  }

  return null;
}

/** Erkennt Schrift aus HTML und lädt woff2 nach Möglichkeit in Storage. */
export async function ingestBrandFontFromHtml(args: {
  userId: string;
  htmlList: string[];
  pageUrl: string;
}): Promise<{ brandHeadlineFontName: string; brandFontFileUrl: string } | null> {
  const hint = extractBrandFontHint(args.htmlList, args.pageUrl);
  if (!hint) return null;

  let brandFontFileUrl = "";
  try {
    const file = await resolveFontFileUrl(hint);
    if (file) {
      brandFontFileUrl = await uploadBrandFontToStorage({
        userId: args.userId,
        buffer: file.buffer,
        ext: file.ext,
      });
    }
  } catch (error) {
    console.warn("[brand/fonts] upload failed:", error);
  }

  return {
    brandHeadlineFontName: hint.family.slice(0, 80),
    brandFontFileUrl,
  };
}
