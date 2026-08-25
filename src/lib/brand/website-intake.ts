import sharp from "sharp";
import {
  assertSafePublicUrl,
  BROWSER_USER_AGENT,
  resolveAbsoluteUrl,
  URL_FETCH_TIMEOUT_MS,
} from "@/lib/brand/url-intake";

const MAX_TEXT_BLOCKS = 24;
const MAX_TEXT_CHARS = 6_000;
const MERGED_MAX_TEXT_BLOCKS = 48;
const MERGED_MAX_TEXT_CHARS = 9_000;
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

/** Hinweise auf freigestellte Produktfotos (Packshots) — fuer den Markenstil kaum brauchbar. */
const PACKSHOT_URL_SIGNALS = [
  "freigestellt",
  "packshot",
  "cutout",
  "produktbild",
  "transparent",
  "/shop",
  "_shop",
  "artikel",
];

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

/** Unterseiten, die die Markenidentitaet vertiefen (Ueber uns, Sortiment, Brauerei …). */
const SUBPAGE_LINK_SIGNALS: Array<{ signal: string; weight: number }> = [
  { signal: "ueber-uns", weight: 30 },
  { signal: "ueberuns", weight: 30 },
  { signal: "unsere-biere", weight: 30 },
  { signal: "geschichte", weight: 28 },
  { signal: "sortiment", weight: 28 },
  { signal: "braukunst", weight: 26 },
  { signal: "philosophie", weight: 26 },
  { signal: "familienbrauerei", weight: 26 },
  { signal: "historie", weight: 26 },
  { signal: "about", weight: 26 },
  { signal: "brauerei", weight: 24 },
  { signal: "tradition", weight: 24 },
  { signal: "biere", weight: 22 },
  { signal: "produkte", weight: 22 },
  { signal: "spezialitaeten", weight: 20 },
  { signal: "marken", weight: 16 },
  { signal: "story", weight: 12 },
  { signal: "werte", weight: 12 },
  { signal: "ueber", weight: 12 },
  { signal: "heimat", weight: 10 },
  { signal: "marke", weight: 10 },
  { signal: "bier", weight: 8 },
];

const SUBPAGE_NOISE_SIGNALS = [
  "impressum",
  "datenschutz",
  "agb",
  "kontakt",
  "job",
  "karriere",
  "presse",
  "news",
  "blog",
  "shop",
  "warenkorb",
  "cart",
  "checkout",
  "login",
  "logout",
  "konto",
  "account",
  "haendler",
  "standorte",
  "faq",
  "cookie",
  "sitemap",
  "download",
  "veranstaltung",
  "event",
  "gewinnspiel",
  "newsletter",
  "suche",
  "search",
  "widerruf",
  "versand",
  "zahlung",
  "sponsoring",
  "ticket",
];

const SUBPAGE_SKIP_EXTENSIONS = /\.(pdf|jpe?g|png|webp|gif|svg|zip|rar|mp[34]|webm|avi|ico|css|js|json|xml|txt|docx?|xlsx?)($|\?)/i;

export type WebsiteIntakeResult = {
  pageUrl: string;
  title: string;
  textBlocks: string[];
  textExcerpt: string;
  imageCandidates: ImageCandidate[];
  downloadedImages: DownloadedImage[];
};

export type ParsedWebsitePage = Omit<WebsiteIntakeResult, "downloadedImages">;

export type SubpageLink = {
  url: string;
  score: number;
  label: string;
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
  productScore: number;
  lifestyleScore: number;
  /** Freigestelltes Produktfoto (weisser/transparenter Hintergrund) — kein Markenwelt-Motiv. */
  isPackshot: boolean;
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
  // Freigestellte Packshots taugen fuers Etikett, aber nicht fuer die Bildsprache.
  if (countSignals(combined, PACKSHOT_URL_SIGNALS) > 0) lifestyleScore -= 30;

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

/**
 * Erkennt freigestellte Produktfotos (Packshots): Der Bildrand ist fast komplett
 * weiss oder transparent. Szenische Fotos haben praktisch nie einen uniformen Rand.
 */
export async function detectPackshotFromBuffer(raw: Buffer): Promise<boolean> {
  try {
    const size = 24;
    const { data, info } = await sharp(raw)
      .ensureAlpha()
      .resize(size, size, { fit: "fill" })
      .raw()
      .toBuffer({ resolveWithObject: true });

    let borderPixels = 0;
    let plainPixels = 0;
    for (let y = 0; y < info.height; y += 1) {
      for (let x = 0; x < info.width; x += 1) {
        const isBorder = x === 0 || y === 0 || x === info.width - 1 || y === info.height - 1;
        if (!isBorder) continue;
        borderPixels += 1;
        const offset = (y * info.width + x) * info.channels;
        const r = data[offset] ?? 0;
        const g = data[offset + 1] ?? 0;
        const b = data[offset + 2] ?? 0;
        const a = info.channels >= 4 ? (data[offset + 3] ?? 255) : 255;
        const nearWhite = r >= 238 && g >= 238 && b >= 238;
        const transparent = a <= 16;
        if (nearWhite || transparent) plainPixels += 1;
      }
    }
    return borderPixels > 0 && plainPixels / borderPixels >= 0.88;
  } catch {
    return false;
  }
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

    const isPackshot = await detectPackshotFromBuffer(raw);

    // Transparente Bilder auf Weiss legen — sonst macht die JPEG-Konvertierung den Hintergrund schwarz.
    const compressed = await sharp(raw)
      .rotate()
      .flatten({ background: "#ffffff" })
      .resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();

    return {
      url: candidate.url,
      alt: candidate.alt,
      score: candidate.score,
      productScore: candidate.productScore,
      lifestyleScore: candidate.lifestyleScore,
      isPackshot,
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

function normalizeForSignals(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[\s_/]+/g, "-");
}

/**
 * Findet interne Links auf Marken-relevante Unterseiten (Ueber uns, Sortiment, Brauerei …),
 * damit die Analyse mehr als nur die Startseite sieht.
 */
export function extractRelevantInternalLinks(html: string, pageUrl: string, maxLinks = 2): SubpageLink[] {
  let baseHost: string;
  let basePath: string;
  try {
    const base = new URL(pageUrl);
    baseHost = base.hostname.replace(/^www\./, "").toLowerCase();
    basePath = base.pathname.replace(/\/+$/, "");
  } catch {
    return [];
  }

  const byUrl = new Map<string, SubpageLink>();

  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]{0,300}?)<\/a>/gi)) {
    const href = match[1]?.trim() ?? "";
    if (!href || /^(javascript|mailto|tel|data):/i.test(href)) continue;

    const abs = resolveAbsoluteUrl(pageUrl, href);
    if (!abs) continue;

    let resolved: URL;
    try {
      resolved = new URL(abs);
    } catch {
      continue;
    }
    if (resolved.hostname.replace(/^www\./, "").toLowerCase() !== baseHost) continue;

    const path = resolved.pathname.replace(/\/+$/, "");
    if (!path || path === basePath) continue;
    if (SUBPAGE_SKIP_EXTENSIONS.test(path)) continue;

    let decodedPath = path;
    try {
      decodedPath = decodeURIComponent(path);
    } catch {
      /* Pfad unveraendert matchen */
    }
    const label = normalizeWhitespace(stripTags(match[2] ?? "")).slice(0, 80);
    const haystack = normalizeForSignals(`${decodedPath} ${label}`);
    if (SUBPAGE_NOISE_SIGNALS.some((noise) => haystack.includes(noise))) continue;

    let score = 0;
    for (const { signal, weight } of SUBPAGE_LINK_SIGNALS) {
      if (haystack.includes(signal)) score += weight;
    }
    if (score <= 0) continue;

    // Flache Pfade bevorzugen (z.B. /brauerei vor /de/x/y/brauerei).
    score -= Math.max(0, path.split("/").length - 2) * 4;

    resolved.hash = "";
    resolved.search = "";
    const key = resolved.toString();
    const existing = byUrl.get(key);
    if (!existing || score > existing.score) byUrl.set(key, { url: key, score, label });
  }

  return [...byUrl.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, maxLinks);
}

/** Fuehrt Startseite + Unterseiten zu einem Analyse-Kontext zusammen (Texte dedupliziert, Bilder gepoolt). */
export function mergeParsedWebsitePages(pages: ParsedWebsitePage[]): ParsedWebsitePage {
  const first = pages[0];
  if (!first) {
    throw new Error("mergeParsedWebsitePages: keine Seiten uebergeben.");
  }
  if (pages.length === 1) return first;

  const blocks: string[] = [];
  const seenBlocks = new Set<string>();
  for (const page of pages) {
    if (page !== first) {
      try {
        blocks.push(`— Unterseite ${new URL(page.pageUrl).pathname || "/"} —`);
      } catch {
        /* Seiten ohne parsebare URL ohne Label mergen */
      }
    }
    for (const block of page.textBlocks) {
      if (seenBlocks.has(block)) continue;
      seenBlocks.add(block);
      blocks.push(block);
    }
  }
  const mergedBlocks = blocks.slice(0, MERGED_MAX_TEXT_BLOCKS);

  const byUrl = new Map<string, ImageCandidate>();
  for (const page of pages) {
    for (const candidate of page.imageCandidates) {
      const existing = byUrl.get(candidate.url);
      if (!existing || candidate.score > existing.score) byUrl.set(candidate.url, candidate);
    }
  }

  return {
    pageUrl: first.pageUrl,
    title: first.title,
    textBlocks: mergedBlocks,
    textExcerpt: mergedBlocks.join("\n\n").slice(0, MERGED_MAX_TEXT_CHARS),
    imageCandidates: [...byUrl.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_IMAGE_CANDIDATES),
  };
}

/** Waehlt die besten Kandidaten aus und laedt sie herunter (Produkt + Lifestyle, Kampagnen raus). */
export async function downloadCandidateImages(candidates: ImageCandidate[]): Promise<DownloadedImage[]> {
  const downloadQueue = selectCandidatesForDownload(candidates);
  return downloadImagesWithConcurrency(downloadQueue, MAX_IMAGES_TO_DOWNLOAD);
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

/**
 * Waehlt Referenzbilder fuer den Markenstil: Szenen mit echtem Hintergrund zuerst
 * (Biergarten, Menschen, Ambiente — daraus lernt die Bild-KI den Look). Freigestellte
 * Packshots kommen nur als Notloesung dazu: max 1, wenn genug Szenen da sind.
 */
export function pickBrandReferenceImages(
  images: DownloadedImage[],
  opts?: { minScore?: number },
): DownloadedImage[] {
  const minScore = opts?.minScore ?? 20;
  const eligible = images.filter((image) => image.score >= minScore);
  const scenes = eligible
    .filter((image) => !image.isPackshot)
    .sort((a, b) => b.lifestyleScore - a.lifestyleScore || b.score - a.score);
  const packshots = eligible
    .filter((image) => image.isPackshot)
    .sort((a, b) => b.productScore - a.productScore || b.score - a.score);

  const picked = scenes.slice(0, MAX_REFERENCE_IMAGES);
  if (picked.length < MAX_REFERENCE_IMAGES && packshots.length > 0) {
    const packshotBudget = picked.length >= 2 ? 1 : 2;
    picked.push(...packshots.slice(0, Math.min(MAX_REFERENCE_IMAGES - picked.length, packshotBudget)));
  }
  return picked;
}
