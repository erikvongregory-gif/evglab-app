import sharp from "sharp";
import {
  assertSafePublicUrl,
  BROWSER_USER_AGENT,
  resolveAbsoluteUrl,
  URL_FETCH_TIMEOUT_MS,
} from "@/lib/brand/url-intake";

const MAX_TEXT_BLOCKS = 24;
const MAX_TEXT_CHARS = 6_000;
const MAX_IMAGE_CANDIDATES = 60;
const MAX_IMAGES_TO_DOWNLOAD = 10;
const IMAGE_DOWNLOAD_CONCURRENCY = 5;
const MAX_REFERENCE_IMAGES = 5;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const BEER_PRODUCT_SIGNALS = [
  "bier",
  "beer",
  "flasche",
  "bottle",
  "produkt",
  "product",
  "sortiment",
  "etikett",
  "label",
  "glas",
  "glass",
  "maß",
  "mass",
  "krug",
  "stein",
  "dose",
  "can",
  "brauerei",
  "brewery",
  "hopfen",
  "hefe",
  "pils",
  "weizen",
  "lager",
  "ipa",
  "stout",
  "dunkel",
  "helles",
  "marzen",
  "märzen",
  "keller",
  "radler",
  "alkoholfrei",
];

const BRAND_LIFESTYLE_SIGNALS = [
  "social_wall",
  "social wall",
  "social-wall",
  "socialwall",
  "biergarten",
  "genuss",
  "geniessen",
  "stimmung",
  "erlebnis",
  "community",
  "freunde",
  "friends",
  "prost",
  "toast",
  "cheers",
  "lifestyle",
  "mood",
  "terrasse",
  "outdoor",
  "sommer",
  "summer",
  "gruppe",
  "people",
  "genussmoment",
  "convivial",
  "zusammen",
  "anstoss",
  "maßkrug",
  "weissbierglas",
  "picknick",
  "picknick",
];

const MUST_INCLUDE_SIGNALS = ["social_wall", "social wall", "social-wall", "socialwall"];

const CAMPAIGN_NOISE_SIGNALS = [
  "wm-",
  "wm_",
  "wm202",
  "weltmeister",
  "world-cup",
  "worldcup",
  "world_cup",
  "fifa",
  "euro202",
  "em202",
  "olymp",
  "campaign",
  "kampagn",
  "promo",
  "promotion",
  "teaser",
  "banner",
  "slider",
  "hero-banner",
  "event",
  "sponsor",
  "partner",
  "news",
  "presse",
  "press",
  "aktion",
  "gewinn",
  "contest",
  "ticket",
  "festival",
  "konzert",
  "sport",
  "fussball",
  "football",
  "soccer",
  "celebr",
  "prominent",
  "billboard",
  "billb",
  "key-visual",
  "keyvisual",
  "landing",
  "homepage-stage",
];

export type WebsiteIntakeResult = {
  pageUrl: string;
  title: string;
  textBlocks: string[];
  textExcerpt: string;
  imageCandidates: ImageCandidate[];
  downloadedImages: DownloadedImage[];
};

export type ImageCandidate = {
  url: string;
  alt: string;
  score: number;
  productScore: number;
  lifestyleScore: number;
};

export type DownloadedImage = {
  url: string;
  alt: string;
  score: number;
  base64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  mime: string;
  sizeBytes: number;
};

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "));
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function extractMetaContent(html: string, attr: "name" | "property", key: string): string {
  const re = new RegExp(`<meta[^>]+${attr}=["']${key}["'][^>]+content=["']([^"']+)["']`, "i");
  const altRe = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${key}["']`, "i");
  const match = html.match(re) ?? html.match(altRe);
  return match?.[1] ? normalizeWhitespace(decodeHtmlEntities(match[1])) : "";
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1] ? normalizeWhitespace(stripTags(match[1])) : "";
}

function extractHeadingAndParagraphs(html: string): string[] {
  const blocks: string[] = [];
  const patterns = [/<h1[^>]*>([\s\S]*?)<\/h1>/gi, /<h2[^>]*>([\s\S]*?)<\/h2>/gi, /<h3[^>]*>([\s\S]*?)<\/h3>/gi, /<p[^>]*>([\s\S]*?)<\/p>/gi];
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const text = normalizeWhitespace(stripTags(match[1] ?? ""));
      if (text.length >= 12) blocks.push(text);
    }
  }
  return blocks;
}

function extractAttr(tag: string, name: string): string {
  const re = new RegExp(`${name}=["']([^"']*)["']`, "i");
  return normalizeWhitespace(decodeHtmlEntities(tag.match(re)?.[1] ?? ""));
}

function countSignals(text: string, signals: string[]): number {
  const lower = text.toLowerCase();
  return signals.reduce((count, signal) => (lower.includes(signal) ? count + 1 : count), 0);
}

function combinedText(url: string, alt: string): string {
  return `${url} ${alt}`.toLowerCase();
}

function isMustIncludeCandidate(url: string, alt: string): boolean {
  const text = combinedText(url, alt);
  return MUST_INCLUDE_SIGNALS.some((signal) => text.includes(signal));
}

function isHardCampaignCandidate(url: string, alt: string): boolean {
  const text = combinedText(url, alt);
  return countSignals(text, CAMPAIGN_NOISE_SIGNALS) >= 2 || (text.includes("teaser") && !text.includes("social"));
}

/** Bewertet Bild-URLs und Alt-Texte: Produkt + Lifestyle hoch, Kampagnen/Events runter. */
export function scoreImageCandidate(url: string, alt: string, source: "img" | "og"): ImageCandidate {
  const combined = combinedText(url, alt);
  let productScore = source === "img" ? 40 : 15;
  let lifestyleScore = source === "img" ? 35 : 12;

  productScore += countSignals(combined, BEER_PRODUCT_SIGNALS) * 16;
  lifestyleScore += countSignals(combined, BRAND_LIFESTYLE_SIGNALS) * 20;

  if (isMustIncludeCandidate(url, alt)) lifestyleScore += 80;
  if (combined.includes("logo")) productScore += 10;

  const campaignPenalty = countSignals(combined, CAMPAIGN_NOISE_SIGNALS) * 26;
  productScore -= campaignPenalty;
  lifestyleScore -= campaignPenalty;

  if (combined.includes("thumb") || combined.includes("icon") || combined.includes("favicon")) {
    productScore -= 40;
    lifestyleScore -= 40;
  }
  if (combined.includes(".svg")) {
    productScore -= 60;
    lifestyleScore -= 60;
  }
  if (source === "og" && countSignals(combined, CAMPAIGN_NOISE_SIGNALS) > 0) {
    productScore -= 30;
    lifestyleScore -= 30;
  }

  const score = Math.max(productScore, lifestyleScore);
  return { url, alt, score, productScore, lifestyleScore };
}

function pickLargestFromSrcset(srcset: string): string {
  const parts = srcset
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  let bestUrl = "";
  let bestWidth = 0;
  for (const part of parts) {
    const [url, descriptor] = part.split(/\s+/);
    if (!url || url.startsWith("data:")) continue;
    const widthMatch = descriptor?.match(/(\d+)w/i);
    const width = widthMatch ? Number(widthMatch[1]) : 0;
    if (width >= bestWidth) {
      bestWidth = width;
      bestUrl = url;
    }
  }
  return bestUrl || parts[0]?.split(/\s+/)[0] || "";
}

function extractLazySrc(tag: string): string {
  for (const attr of ["data-src", "data-lazy-src", "data-original", "data-image", "data-src-mobile"]) {
    const value = extractAttr(tag, attr);
    if (value && !value.startsWith("data:")) return value;
  }
  return "";
}

function extractBackgroundImageUrls(html: string): string[] {
  const urls: string[] = [];
  for (const match of html.matchAll(/background-image:\s*url\(["']?([^"')]+)["']?\)/gi)) {
    const url = match[1]?.trim();
    if (url && !url.startsWith("data:")) urls.push(url);
  }
  return urls;
}

/** Mischt Produkt- und Lifestyle-Kandidaten — Social Wall etc. wird erzwungen. */
export function selectCandidatesForDownload(candidates: ImageCandidate[]): ImageCandidate[] {
  const eligible = candidates.filter((c) => !isHardCampaignCandidate(c.url, c.alt));
  const forced = eligible.filter((c) => isMustIncludeCandidate(c.url, c.alt));
  const productTop = [...eligible].sort((a, b) => b.productScore - a.productScore).slice(0, 8);
  const lifestyleTop = [...eligible].sort((a, b) => b.lifestyleScore - a.lifestyleScore).slice(0, 10);
  const overallTop = [...eligible].sort((a, b) => b.score - a.score).slice(0, 8);

  const byUrl = new Map<string, ImageCandidate>();
  for (const candidate of [...forced, ...lifestyleTop, ...productTop, ...overallTop]) {
    const existing = byUrl.get(candidate.url);
    if (!existing || candidate.score > existing.score) byUrl.set(candidate.url, candidate);
  }

  return [...byUrl.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_IMAGES_TO_DOWNLOAD);
}

function extractImageCandidates(html: string, pageUrl: string): ImageCandidate[] {
  const byUrl = new Map<string, ImageCandidate>();

  const addCandidate = (url: string, alt: string, source: "img" | "og") => {
    const abs = resolveAbsoluteUrl(pageUrl, url);
    if (!abs) return;
    const scored = scoreImageCandidate(abs, alt, source);
    const existing = byUrl.get(abs);
    if (!existing || scored.score > existing.score) {
      byUrl.set(abs, scored);
    }
  };

  const ogImage = extractMetaContent(html, "property", "og:image");
  if (ogImage) addCandidate(ogImage, extractMetaContent(html, "property", "og:title"), "og");

  for (const match of html.matchAll(/<picture\b[\s\S]*?<\/picture>/gi)) {
    const block = match[0] ?? "";
    for (const sourceMatch of block.matchAll(/<source\b[^>]*>/gi)) {
      const srcset = extractAttr(sourceMatch[0] ?? "", "srcset");
      const picked = pickLargestFromSrcset(srcset);
      if (picked) addCandidate(picked, extractAttr(block, "alt"), "img");
    }
  }

  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0] ?? "";
    const alt = extractAttr(tag, "alt") || extractAttr(tag, "title");
    const src = extractAttr(tag, "src") || extractLazySrc(tag);
    if (src && !src.startsWith("data:")) addCandidate(src, alt, "img");

    const srcset = extractAttr(tag, "srcset") || extractAttr(tag, "data-srcset");
    const picked = pickLargestFromSrcset(srcset);
    if (picked && !picked.startsWith("data:")) addCandidate(picked, alt, "img");
  }

  for (const url of extractBackgroundImageUrls(html)) {
    addCandidate(url, "", "img");
  }

  return [...byUrl.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_IMAGE_CANDIDATES);
}

async function downloadImage(candidate: ImageCandidate): Promise<DownloadedImage | null> {
  try {
    const parsed = new URL(candidate.url);
    assertSafePublicUrl(parsed);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), URL_FETCH_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(candidate.url, {
        signal: controller.signal,
        headers: { "User-Agent": BROWSER_USER_AGENT, Accept: "image/*" },
        cache: "no-store",
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) return null;

    const contentType = (response.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
    if (!ALLOWED_IMAGE_TYPES.has(contentType)) return null;

    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength === 0 || raw.byteLength > MAX_IMAGE_BYTES) return null;

    const compressed = await sharp(raw)
      .rotate()
      .resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();

    return {
      url: candidate.url,
      alt: candidate.alt,
      score: candidate.score,
      base64: compressed.toString("base64"),
      mediaType: "image/jpeg",
      mime: "image/jpeg",
      sizeBytes: compressed.byteLength,
    };
  } catch {
    return null;
  }
}

export function parseWebsiteHtml(html: string, pageUrl: string): Omit<WebsiteIntakeResult, "downloadedImages"> {
  const title = extractTitle(html);
  const description = extractMetaContent(html, "name", "description") || extractMetaContent(html, "property", "og:description");
  const ogTitle = extractMetaContent(html, "property", "og:title");
  const siteName = extractMetaContent(html, "property", "og:site_name");

  const textBlocks = [
    title ? `Seitentitel: ${title}` : "",
    siteName ? `Site-Name: ${siteName}` : "",
    ogTitle && ogTitle !== title ? `OG-Titel: ${ogTitle}` : "",
    description ? `Beschreibung: ${description}` : "",
    ...extractHeadingAndParagraphs(html),
  ]
    .map(normalizeWhitespace)
    .filter(Boolean)
    .filter((block, index, arr) => arr.indexOf(block) === index)
    .slice(0, MAX_TEXT_BLOCKS);

  const textExcerpt = textBlocks.join("\n\n").slice(0, MAX_TEXT_CHARS);
  const imageCandidates = extractImageCandidates(html, pageUrl);

  return {
    pageUrl,
    title,
    textBlocks,
    textExcerpt,
    imageCandidates,
  };
}

async function downloadImagesWithConcurrency(
  candidates: ImageCandidate[],
  maxCount: number,
): Promise<DownloadedImage[]> {
  const downloadedImages: DownloadedImage[] = [];

  for (let offset = 0; offset < candidates.length && downloadedImages.length < maxCount; offset += IMAGE_DOWNLOAD_CONCURRENCY) {
    const batch = candidates.slice(offset, offset + IMAGE_DOWNLOAD_CONCURRENCY);
    const results = await Promise.all(batch.map((candidate) => downloadImage(candidate)));
    for (const image of results) {
      if (image && downloadedImages.length < maxCount) downloadedImages.push(image);
    }
  }

  return downloadedImages;
}

export async function intakeWebsiteFromHtml(html: string, pageUrl: string): Promise<WebsiteIntakeResult> {
  const parsed = parseWebsiteHtml(html, pageUrl);
  const downloadQueue = selectCandidatesForDownload(parsed.imageCandidates);
  const downloadedImages = await downloadImagesWithConcurrency(downloadQueue, MAX_IMAGES_TO_DOWNLOAD);

  return {
    ...parsed,
    downloadedImages,
  };
}

export function pickImagesByIndices(images: DownloadedImage[], indices: number[]): DownloadedImage[] {
  const picked: DownloadedImage[] = [];
  for (const index of indices) {
    const image = images[index];
    if (image) picked.push(image);
    if (picked.length >= MAX_REFERENCE_IMAGES) break;
  }
  return picked;
}

export function pickTopProductImagesHeuristic(images: DownloadedImage[]): DownloadedImage[] {
  return [...images]
    .filter((image) => image.score >= 20)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_REFERENCE_IMAGES);
}
