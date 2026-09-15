import { randomUUID } from "node:crypto";
import { BEER_STYLE_OPTIONS, findBeerStyle } from "@/app/(dashboard)/inhalte-erstellen/lib/beer-styles";
import {
  MAX_MY_BEERS,
  sanitizeDashboardBeers,
  type DashboardBeer,
} from "@/lib/dashboard/metadata";
import { uploadUserImageToStorage } from "@/lib/supabase/storage";
import { assertSafePublicUrl, BROWSER_USER_AGENT, resolveAbsoluteUrl, URL_FETCH_TIMEOUT_MS } from "@/lib/brand/url-intake";
import {
  isProductCatalogImage,
  type DownloadedImage,
  type ImageCandidate,
  type ParsedWebsitePage,
} from "@/lib/brand/website-intake";

export type SuggestedBeerVariety = {
  name: string;
  bierstil: string;
  flaschenTyp: string;
  flaschenfarbe: "braun" | "gruen" | "klar";
  glasTyp: string;
  etikettUrl: string;
};

const FILENAME_SKIP_SLUGS = new Set([
  "euro",
  "euro-flaschne",
  "lkw",
  "festhalle",
  "historie",
  "logo",
  "wappen",
  "gebaeude",
]);

const HTML_NAME_SKIP = /festhalle|kontakt|newsletter|historie|über uns|ueber uns|impressum/i;
const HTML_NAME_BEER_SIGNAL =
  /\b(bier|pils|hell|bock|weizen|weiss|dunkel|sorte|lager|radler|ipa|stout|oktoberfest|edelstoff|maximator|alkoholfrei|keller|kölsch|koelsch|märzen|maerzen)\b/i;

const NAME_STYLE_HINTS: Array<{ pattern: RegExp; bierstil: string }> = [
  { pattern: /alkoholfrei/, bierstil: "alkoholfrei_pilsner" },
  { pattern: /kristallweizen/, bierstil: "kristallweizen" },
  { pattern: /hefeweizen|weissbier|weizen/, bierstil: "hefeweizen" },
  { pattern: /pils/, bierstil: "pils" },
  { pattern: /koelsch|kölsch/, bierstil: "koelsch" },
  { pattern: /altbier/, bierstil: "altbier" },
  { pattern: /radler/, bierstil: "radler" },
  { pattern: /bock|maximator|doppelbock/, bierstil: "bock" },
  { pattern: /oktoberfest|festbier|maerzen|märzen/, bierstil: "maerzen" },
  { pattern: /kellerbier|keller/, bierstil: "kellerbier" },
  { pattern: /ipa|india pale/, bierstil: "ipa" },
  { pattern: /neipa|hazy/, bierstil: "neipa" },
  { pattern: /stout/, bierstil: "stout" },
  { pattern: /porter/, bierstil: "porter" },
  { pattern: /saison/, bierstil: "saison" },
  { pattern: /dunkel/, bierstil: "helles" },
  { pattern: /hell|edelstoff|lager/, bierstil: "helles" },
];

function normalizeToken(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleCaseWords(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function inferBierstilFromName(name: string): string {
  const normalized = name.toLowerCase();
  for (const hint of NAME_STYLE_HINTS) {
    if (hint.pattern.test(normalized)) return hint.bierstil;
  }
  for (const option of BEER_STYLE_OPTIONS) {
    const label = option.label.toLowerCase();
    if (normalized.includes(label) || normalized.includes(option.bierstil.replace(/_/g, " "))) {
      return option.bierstil;
    }
  }
  return "helles";
}

function breweryShortName(breweryName: string): string {
  const firstToken = breweryName.split(/\s+/)[0]?.trim() ?? breweryName.trim();
  if (/bräu|braeu|brauerei|brewery|brewing/i.test(firstToken)) {
    return firstToken.split(/[-_]/)[0]?.trim() || firstToken;
  }
  return firstToken;
}

export function humanizeBeerSlug(slug: string, breweryName: string): string {
  const cleaned = titleCaseWords(slug.replace(/-/g, " ").replace(/_/g, " ").trim());
  if (!cleaned) return "";
  const short = breweryShortName(breweryName).toLowerCase();
  if (short && cleaned.toLowerCase().startsWith(short)) return cleaned;
  if (short && cleaned.split(" ").length === 1) return `${breweryShortName(breweryName)} ${cleaned}`;
  return cleaned;
}

function extractSlugFromImageUrl(url: string): string | null {
  const filename = url.split("/").pop()?.split("?")[0] ?? "";
  const decoded = decodeURIComponent(filename);
  const csmMatch = decoded.match(/csm_(?:[A-Za-z][A-Za-z0-9]*-)?([A-Za-z0-9-]+?)_[a-f0-9]{6,}\./i);
  if (!csmMatch?.[1]) return null;
  const token = normalizeToken(csmMatch[1]);
  if (!token || token.length < 3 || FILENAME_SKIP_SLUGS.has(token)) return null;
  if (FILENAME_SKIP_SLUGS.has(token.split("-")[0] ?? "")) return null;
  if (/festhalle|historie|gebaeude|portrait|portraet|\d{4}-\d{2}-\d{2}/.test(token)) return null;
  return token;
}

function stripTags(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function extractBeerNamesFromHtml(html: string): string[] {
  const names: string[] = [];
  const patterns = [
    /<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi,
    /<(?:strong|b)[^>]*class=["'][^"']*product[^"']*["'][^>]*>([\s\S]*?)<\/(?:strong|b)>/gi,
    /<(?:li|p)[^>]*class=["'][^"']*(?:product|bier|sorte)[^"']*["'][^>]*>([\s\S]*?)<\/(?:li|p)>/gi,
  ];
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const text = decodeHtmlEntities(stripTags(match[1] ?? "")).replace(/\s+/g, " ").trim();
      if (text.length < 3 || text.length > 80) continue;
      if (/impressum|datenschutz|newsletter|kontakt|cookie|menü|menu/i.test(text)) continue;
      if (HTML_NAME_SKIP.test(text)) continue;
      if (HTML_NAME_BEER_SIGNAL.test(text) || /\b(bier|sorte|sortiment)\b/i.test(text)) {
        names.push(text);
      }
    }
  }
  return names;
}

function isCatalogPage(page: ParsedWebsitePage): boolean {
  try {
    return isProductCatalogImage(page.pageUrl);
  } catch {
    return false;
  }
}

function collectProductImageUrls(
  downloadedImages: DownloadedImage[],
  imageCandidates: ImageCandidate[],
  htmlImageUrls: string[],
): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  const add = (url: string) => {
    const trimmed = url.trim();
    if (!trimmed || seen.has(trimmed)) return;
    if (!extractSlugFromImageUrl(trimmed)) return;
    seen.add(trimmed);
    urls.push(trimmed);
  };
  for (const image of downloadedImages) add(image.url);
  for (const candidate of imageCandidates) add(candidate.url);
  for (const url of htmlImageUrls) add(url);
  return urls;
}

function styleTokenScore(token: string): number {
  let score = token.length;
  if (NAME_STYLE_HINTS.some((hint) => hint.pattern.test(token))) score += 8;
  return score;
}

function findBestMatchingImageSlug(nameSlug: string, imageSlugs: string[]): string | null {
  const token = normalizeToken(nameSlug);
  if (!token) return null;
  if (imageSlugs.includes(token)) return token;

  const nameTokens = token.split("-").filter((part) => part.length >= 3);
  let bestTokenMatch: string | null = null;
  let bestTokenScore = 0;
  for (const part of nameTokens) {
    if (!imageSlugs.includes(part)) continue;
    const score = styleTokenScore(part);
    if (score > bestTokenScore) {
      bestTokenScore = score;
      bestTokenMatch = part;
    }
  }
  if (bestTokenMatch) return bestTokenMatch;

  let bestPartial: string | null = null;
  let bestPartialScore = 0;
  for (const imageSlug of imageSlugs) {
    if (!token.includes(imageSlug) && !imageSlug.includes(token)) continue;
    const score = styleTokenScore(imageSlug);
    if (score > bestPartialScore) {
      bestPartialScore = score;
      bestPartial = imageSlug;
    }
  }
  if (bestPartial) return bestPartial;

  for (const imageSlug of imageSlugs) {
    if (token.startsWith(imageSlug) || imageSlug.startsWith(token)) return imageSlug;
  }

  return null;
}

function pickEtikettUrl(slug: string, productImageUrls: string[]): string {
  const imageSlugs = productImageUrls
    .map((url) => extractSlugFromImageUrl(url))
    .filter((value): value is string => Boolean(value));
  const matched = findBestMatchingImageSlug(slug, imageSlugs);
  if (!matched) return "";
  return productImageUrls.find((url) => extractSlugFromImageUrl(url) === matched) ?? "";
}

function extractAttr(tag: string, name: string): string {
  const re = new RegExp(`${name}=["']([^"']*)["']`, "i");
  return tag.match(re)?.[1]?.trim() ?? "";
}

function extractCatalogImageUrlsFromHtml(html: string, pageUrl: string): string[] {
  const urls: string[] = [];
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0] ?? "";
    const src = extractAttr(tag, "src") || extractAttr(tag, "data-src");
    if (!src || src.startsWith("data:")) continue;
    const abs = resolveAbsoluteUrl(pageUrl, src);
    if (abs && extractSlugFromImageUrl(abs)) urls.push(abs);
  }
  return urls;
}

export function extractBeerVarietiesFromIntake(params: {
  pages: ParsedWebsitePage[];
  downloadedImages: DownloadedImage[];
  imageCandidates?: ImageCandidate[];
  breweryName: string;
  rawHtmlByUrl?: Record<string, string>;
}): SuggestedBeerVariety[] {
  const bySlug = new Map<string, { name: string; etikettUrl: string }>();
  const brewery = params.breweryName.trim() || "Brauerei";
  const htmlImageUrls = params.pages.flatMap((page) => {
    if (!isCatalogPage(page)) return [];
    const html = params.rawHtmlByUrl?.[page.pageUrl] ?? "";
    return html ? extractCatalogImageUrlsFromHtml(html, page.pageUrl) : [];
  });
  const productImageUrls = collectProductImageUrls(
    params.downloadedImages,
    params.imageCandidates ?? params.pages.flatMap((page) => page.imageCandidates),
    htmlImageUrls,
  );

  const htmlNames: string[] = [];
  for (const page of params.pages) {
    if (!isCatalogPage(page)) continue;
    const html = params.rawHtmlByUrl?.[page.pageUrl] ?? "";
    if (html) htmlNames.push(...extractBeerNamesFromHtml(html));
  }

  const imageSlugs = productImageUrls
    .map((url) => extractSlugFromImageUrl(url))
    .filter((value): value is string => Boolean(value));

  for (const url of productImageUrls) {
    const slug = extractSlugFromImageUrl(url);
    if (!slug) continue;
    bySlug.set(slug, {
      name: humanizeBeerSlug(slug, brewery),
      etikettUrl: url,
    });
  }

  for (const rawName of htmlNames) {
    const stripped = rawName.replace(new RegExp(`^${breweryShortName(brewery)}`, "i"), "").trim();
    const nameSlug = normalizeToken(stripped || rawName);
    if (!nameSlug || nameSlug.length < 3) continue;
    const imageSlug = findBestMatchingImageSlug(nameSlug, imageSlugs);
    if (imageSlug && bySlug.has(imageSlug)) {
      const entry = bySlug.get(imageSlug)!;
      entry.name = rawName.trim();
      if (!entry.etikettUrl) entry.etikettUrl = pickEtikettUrl(nameSlug, productImageUrls);
      continue;
    }
    if (!bySlug.has(nameSlug)) {
      bySlug.set(nameSlug, {
        name: rawName.trim(),
        etikettUrl: pickEtikettUrl(nameSlug, productImageUrls),
      });
    }
  }

  const varieties: SuggestedBeerVariety[] = [];
  for (const [slug, entry] of bySlug) {
    const bierstil = inferBierstilFromName(`${slug} ${entry.name}`);
    const style = findBeerStyle(bierstil);
    varieties.push({
      name: entry.name.slice(0, 80),
      bierstil,
      flaschenTyp: "nrw_500",
      flaschenfarbe: slug.includes("pils") ? "braun" : "braun",
      glasTyp: style?.glasTyp ?? "willibecher",
      etikettUrl: entry.etikettUrl.slice(0, 1200),
    });
    if (varieties.length >= MAX_MY_BEERS) break;
  }

  return varieties.sort((a, b) => a.name.localeCompare(b.name, "de"));
}

export function mergeSuggestedBeers(existing: DashboardBeer[], suggested: SuggestedBeerVariety[]): DashboardBeer[] {
  const out = [...sanitizeDashboardBeers(existing)];
  const seen = new Set(out.map((beer) => beer.name.trim().toLowerCase()));

  for (const suggestion of suggested) {
    if (out.length >= MAX_MY_BEERS) break;
    const name = suggestion.name.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const existingBeer = out.find((beer) => beer.name.trim().toLowerCase() === key);
    if (existingBeer) {
      if (!existingBeer.etikettUrl.trim() && suggestion.etikettUrl.trim()) {
        existingBeer.etikettUrl = suggestion.etikettUrl.trim().slice(0, 1200);
      }
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: `beer-${randomUUID()}`,
      name,
      bierstil: suggestion.bierstil,
      flaschenTyp: suggestion.flaschenTyp,
      flaschenfarbe: suggestion.flaschenfarbe,
      glasTyp: suggestion.glasTyp,
      etikettUrl: suggestion.etikettUrl,
      createdAt: new Date().toISOString(),
    });
  }

  return sanitizeDashboardBeers(out);
}

const ALLOWED_LABEL_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_LABEL_BYTES = 4 * 1024 * 1024;

function isAlreadyPersistedLabelUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.pathname.includes("/beer-labels/");
  } catch {
    return false;
  }
}

/** Laedt Sortenfoto von der Brauerei-Website und speichert es dauerhaft in Supabase Storage. */
export async function persistBeerLabelFromUrl(userId: string, sourceUrl: string): Promise<string> {
  const trimmed = sourceUrl.trim();
  if (!trimmed) return "";
  if (isAlreadyPersistedLabelUrl(trimmed)) return trimmed;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
    assertSafePublicUrl(parsed);
  } catch {
    return "";
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), URL_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: { "User-Agent": BROWSER_USER_AGENT, Accept: "image/*" },
      cache: "no-store",
    });
    if (!response.ok) return trimmed;

    const contentType = (response.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
    if (!ALLOWED_LABEL_MIME.has(contentType)) return trimmed;

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength < 32 || buffer.byteLength > MAX_LABEL_BYTES) return trimmed;

    return await uploadUserImageToStorage({
      userId,
      buffer,
      mime: contentType,
      folder: "beer-labels",
    });
  } catch {
    return trimmed;
  } finally {
    clearTimeout(timeout);
  }
}

export async function persistSuggestedBeerLabels(
  userId: string,
  suggested: SuggestedBeerVariety[],
): Promise<SuggestedBeerVariety[]> {
  const out: SuggestedBeerVariety[] = [];
  for (const beer of suggested) {
    const etikettUrl = beer.etikettUrl.trim()
      ? await persistBeerLabelFromUrl(userId, beer.etikettUrl)
      : "";
    out.push({ ...beer, etikettUrl: etikettUrl.slice(0, 1200) });
  }
  return out;
}
