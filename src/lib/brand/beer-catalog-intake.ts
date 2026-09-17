import { randomUUID } from "node:crypto";
import { BEER_STYLE_OPTIONS, findBeerStyle } from "@/app/(dashboard)/inhalte-erstellen/lib/beer-styles";
import {
  MAX_MY_BEERS,
  sanitizeDashboardBeers,
  sanitizeProduktKategorie,
  type DashboardBeer,
  type ProduktKategorie,
} from "@/lib/dashboard/metadata";
import { uploadUserImageToStorage } from "@/lib/supabase/storage";
import { assertSafePublicUrl, BROWSER_USER_AGENT, resolveAbsoluteUrl, URL_FETCH_TIMEOUT_MS } from "@/lib/brand/url-intake";
import { publicFetch } from "@/lib/security/public-fetch";
import {
  type DownloadedImage,
  type ImageCandidate,
  type ParsedWebsitePage,
} from "@/lib/brand/website-intake";

export type SuggestedBeerVariety = {
  name: string;
  produktKategorie?: ProduktKategorie;
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
// Product evidence must come from the item itself, never its domain or parent
// directory (a brewery's /bier/ shop can also contain glasses and merchandise).
const BEER_PRODUCT_SIGNAL = /\b(?:bier|beer|pils(?:ner|ener)?|hell(?:es|er)?|dunkel(?:es|er)?|(?:hefe|kristall)?weizen|weissbier|weizenbier|lager(?:bier)?|(?:doppel|eis|weizen)?bock|bockbier|radler|(?:ne|double-)?ipa|stout|porter|saison|koelsch|maerzen|kellerbier|zwickl|zwickelbier|altbier|festbier|oktoberfestbier|edelstoff|maximator|pale-ale)\b/;
const LIMONADE_SIGNAL = /\b(?:limonade|limo|cola|spezi|brause|orangeade|orangenlimonade|zitronenlimonade)\b/;
const TAFELWASSER_SIGNAL = /\btafel(?:-)?wasser\b/;
const MINERALWASSER_SIGNAL = /\b(?:mineral(?:-)?wasser|quell(?:-)?wasser)\b/;
const NON_CATALOG_PRODUCT = /\b(?:saft|saefte|schorle|energy|gin|whisk(?:e)?y|rum|vodka|wodka|schnaps|likoer|brand|braende|wein|sekt|cider|glas|glaeser|bierglas|bierglaeser|pilsglas|weizenglas|krug|kruege|bierkrug|masskrug|tasse\w*|becher|flaschenoeffner|oeffner|bierdeckel|untersetzer|shirt\w*|hoodie\w*|muetze\w*|cap|caps|kleidung|merch\w*|gutschein\w*|geschenk\w*|probierpaket\w*|bierpaket\w*|set|sets|paket\w*|fuehrung\w*|verkostung\w*|bierprobe\w*|tonic(?:-)?wasser)\b/;
const GENERIC_CATALOG_HEADING = /\b(?:unsere?|sortiment|biere|biersorten|sorten|entdecken|entdecke|welt|geschichte|braukunst|brauen|erleben|qualitaet|angebote|produkte|shop|zubehoer|verkauf|getraenke)\b/;

export function detectProduktKategorie(value: string): ProduktKategorie | null {
  const token = normalizeToken(value);
  if (!token || NON_CATALOG_PRODUCT.test(token) || GENERIC_CATALOG_HEADING.test(token)) return null;
  if (/^(?:wasser|water)$/.test(token)) return null;
  if (BEER_PRODUCT_SIGNAL.test(token)) return "bier";
  if (TAFELWASSER_SIGNAL.test(token)) return "tafelwasser";
  if (MINERALWASSER_SIGNAL.test(token)) return "mineralwasser";
  if (LIMONADE_SIGNAL.test(token)) return "limonade";
  return null;
}

function imageFilename(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "");
  } catch {
    return "";
  }
}

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

export function inferProduktBezeichnung(name: string, kategorie: ProduktKategorie): string {
  if (kategorie === "bier") return inferBierstilFromName(name);
  const normalized = name.toLowerCase();
  if (kategorie === "limonade") {
    if (/\bspezi\b/.test(normalized)) return "spezi";
    if (/\bcola\b/.test(normalized)) return "cola";
  }
  return kategorie;
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

function extractContaoSlugFromImageUrl(url: string): string | null {
  const decoded = imageFilename(url);
  const csmMatch = decoded.match(/csm_(?:[A-Za-z][A-Za-z0-9]*-)?([A-Za-z0-9-]+?)_[a-f0-9]{6,}\./i);
  if (!csmMatch?.[1]) return null;
  const token = normalizeToken(csmMatch[1]);
  if (!token || token.length < 3 || FILENAME_SKIP_SLUGS.has(token)) return null;
  if (FILENAME_SKIP_SLUGS.has(token.split("-")[0] ?? "")) return null;
  if (/festhalle|historie|gebaeude|portrait|portraet|\d{4}-\d{2}-\d{2}/.test(token)) return null;
  return token;
}

const PRODUCT_IMAGE_NOISE =
  /logo|banner|hero|slider|thumb|icon|favicon|social|partner|sponsor|historie|gebaeude|portrait|portraet|team|event|news|cookie|gate|wm-|euro|lkw|festhalle|placeholder|spacer|loader|tracking|pixel|1x1|svg/i;

/** Filename identifier only. collectProductImages separately verifies beer evidence. */
export function extractProductSlugFromImageUrl(url: string): string | null {
  const contao = extractContaoSlugFromImageUrl(url);
  if (contao) return contao;

  const filename = imageFilename(url);
  let base = filename.replace(/\.(jpe?g|png|webp|avif)$/i, "");
  base = base.replace(/[-_][a-f0-9]{6,}$/i, "").replace(/^csm[-_]?/i, "");
  const slug = normalizeToken(base);
  if (slug.length < 3 || FILENAME_SKIP_SLUGS.has(slug)) return null;
  if (PRODUCT_IMAGE_NOISE.test(slug) || PRODUCT_IMAGE_NOISE.test(url)) return null;

  return slug;
}

type CatalogImageRef = { url: string; alt: string; kategorie?: ProduktKategorie };

function scoreImageForBeerName(name: string, image: CatalogImageRef, breweryName: string): number {
  const combined = `${image.url} ${image.alt}`.toLowerCase();
  const nameNorm = name.toLowerCase();
  const nameSlug = normalizeToken(name.replace(new RegExp(`^${breweryShortName(breweryName)}`, "i"), "").trim() || name);
  const nameTokens = nameSlug.split("-").filter((part) => part.length >= 3);
  let score = 0;

  for (const token of nameTokens) {
    if (combined.includes(token)) score += 14;
  }
  if (nameNorm.length >= 4 && combined.includes(nameNorm.replace(/\s+/g, ""))) score += 10;
  if (NAME_STYLE_HINTS.some((hint) => hint.pattern.test(name) && hint.pattern.test(combined))) score += 8;

  const imageSlug = extractProductSlugFromImageUrl(image.url);
  if (imageSlug && findBestMatchingImageSlug(nameSlug, [imageSlug])) score += 20;
  if (image.alt.trim().length >= 3) score += 4;
  if (/\.(jpe?g|png|webp|avif)(\?|$)/i.test(image.url)) score += 2;
  if (PRODUCT_IMAGE_NOISE.test(combined)) score -= 80;
  return score;
}

function findBestEtikettUrlForBeerName(
  name: string,
  images: CatalogImageRef[],
  breweryName: string,
  kategorie?: ProduktKategorie,
): string {
  const pool = kategorie ? images.filter((image) => image.kategorie === kategorie) : images;
  const search = pool.length ? pool : images;
  let bestUrl = "";
  let bestScore = 0;
  for (const image of search) {
    const score = scoreImageForBeerName(name, image, breweryName);
    if (score > bestScore) {
      bestScore = score;
      bestUrl = image.url;
    }
  }
  return bestScore >= 12 ? bestUrl : "";
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

function extractCatalogNamesFromHtml(html: string): Array<{ name: string; kategorie: ProduktKategorie }> {
  const names: Array<{ name: string; kategorie: ProduktKategorie }> = [];
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
      const kategorie = detectProduktKategorie(text);
      if (kategorie) names.push({ name: text, kategorie });
    }
  }
  return names;
}

function collectProductImages(
  downloadedImages: DownloadedImage[],
  imageCandidates: ImageCandidate[],
  htmlImages: CatalogImageRef[],
  beerNames: string[],
): CatalogImageRef[] {
  const seen = new Set<string>();
  const out: CatalogImageRef[] = [];
  const add = (url: string, alt: string) => {
    const trimmed = url.trim();
    if (!trimmed || seen.has(trimmed)) return;
    if (PRODUCT_IMAGE_NOISE.test(trimmed)) return;
    const slug = extractProductSlugFromImageUrl(trimmed);
    const itemText = `${imageFilename(trimmed)} ${alt}`;
    if (NON_CATALOG_PRODUCT.test(normalizeToken(itemText))) return;
    const matchesBeerName = slug && /\balkoholfrei\b/.test(slug) && beerNames.some((name) =>
      findBestMatchingImageSlug(normalizeToken(name), [slug]),
    );
    const kategorie = detectProduktKategorie(itemText) ?? (matchesBeerName ? "bier" : null);
    if (!kategorie) return;
    seen.add(trimmed);
    out.push({ url: trimmed, alt: alt.trim(), kategorie });
  };

  for (const image of downloadedImages) add(image.url, image.alt);
  for (const candidate of imageCandidates) add(candidate.url, candidate.alt);
  for (const image of htmlImages) add(image.url, image.alt);
  return out;
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

function pickEtikettUrl(slug: string, productImages: CatalogImageRef[], kategorie?: ProduktKategorie): string {
  const pool = kategorie ? productImages.filter((image) => image.kategorie === kategorie) : productImages;
  const images = pool.length ? pool : productImages;
  const imageSlugs = images
    .map((image) => extractProductSlugFromImageUrl(image.url))
    .filter((value): value is string => Boolean(value));
  const matched = findBestMatchingImageSlug(slug, imageSlugs);
  if (!matched) return "";
  return images.find((image) => extractProductSlugFromImageUrl(image.url) === matched)?.url ?? "";
}

function extractAttr(tag: string, name: string): string {
  const re = new RegExp(`${name}=["']([^"']*)["']`, "i");
  return tag.match(re)?.[1]?.trim() ?? "";
}

function extractCatalogImagesFromHtml(html: string, pageUrl: string): CatalogImageRef[] {
  const images: CatalogImageRef[] = [];
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0] ?? "";
    const src =
      extractAttr(tag, "src") ||
      extractAttr(tag, "data-src") ||
      extractAttr(tag, "data-lazy-src") ||
      extractAttr(tag, "data-original");
    if (!src || src.startsWith("data:")) continue;
    const abs = resolveAbsoluteUrl(pageUrl, src);
    if (!abs) continue;
    const alt = decodeHtmlEntities(extractAttr(tag, "alt"));
    images.push({ url: abs, alt });
  }
  return images;
}

export function extractBeerVarietiesFromIntake(params: {
  pages: ParsedWebsitePage[];
  downloadedImages: DownloadedImage[];
  imageCandidates?: ImageCandidate[];
  breweryName: string;
  rawHtmlByUrl?: Record<string, string>;
}): SuggestedBeerVariety[] {
  const byKey = new Map<string, { name: string; etikettUrl: string; kategorie: ProduktKategorie }>();
  const brewery = params.breweryName.trim() || "Brauerei";
  const htmlNames = params.pages.flatMap((page) =>
    extractCatalogNamesFromHtml(params.rawHtmlByUrl?.[page.pageUrl] ?? ""),
  );
  const htmlImages = params.pages.flatMap((page) => {
    const html = params.rawHtmlByUrl?.[page.pageUrl] ?? "";
    if (!html) return [];
    return extractCatalogImagesFromHtml(html, page.pageUrl);
  });
  const productImages = collectProductImages(
    params.downloadedImages,
    params.imageCandidates ?? params.pages.flatMap((page) => page.imageCandidates),
    htmlImages,
    htmlNames.map((item) => item.name),
  );

  const slugsFor = (kategorie: ProduktKategorie) =>
    productImages
      .filter((image) => image.kategorie === kategorie)
      .map((image) => extractProductSlugFromImageUrl(image.url))
      .filter((value): value is string => Boolean(value));

  for (const image of productImages) {
    const slug = extractProductSlugFromImageUrl(image.url);
    if (!slug) continue;
    const kategorie = image.kategorie ?? detectProduktKategorie(`${imageFilename(image.url)} ${image.alt}`);
    if (!kategorie) continue;
    byKey.set(`${kategorie}:${slug}`, {
      name: detectProduktKategorie(image.alt) ? image.alt : humanizeBeerSlug(slug, brewery),
      etikettUrl: image.url,
      kategorie,
    });
  }

  for (const { name: rawName, kategorie } of htmlNames) {
    const stripped = rawName.replace(new RegExp(`^${breweryShortName(brewery)}`, "i"), "").trim();
    const nameSlug = normalizeToken(stripped || rawName);
    if (!nameSlug || nameSlug.length < 3) continue;
    const imageSlug = findBestMatchingImageSlug(nameSlug, slugsFor(kategorie));
    const matchedKey = imageSlug ? `${kategorie}:${imageSlug}` : "";
    if (matchedKey && byKey.has(matchedKey)) {
      const entry = byKey.get(matchedKey)!;
      entry.name = rawName.trim();
      if (!entry.etikettUrl) entry.etikettUrl = pickEtikettUrl(nameSlug, productImages, kategorie);
      continue;
    }
    const nameKey = `${kategorie}:${nameSlug}`;
    if (!byKey.has(nameKey)) {
      byKey.set(nameKey, {
        name: rawName.trim(),
        kategorie,
        etikettUrl:
          pickEtikettUrl(nameSlug, productImages, kategorie) ||
          findBestEtikettUrlForBeerName(rawName.trim(), productImages, brewery, kategorie),
      });
    }
  }

  const varieties: SuggestedBeerVariety[] = [];
  const seenNames = new Set<string>();
  for (const [key, entry] of byKey) {
    const nameKey = `${entry.kategorie}:${normalizeToken(entry.name)}`;
    if (seenNames.has(nameKey)) continue;
    seenNames.add(nameKey);
    const slug = key.slice(key.indexOf(":") + 1);
    const bierstil = inferProduktBezeichnung(`${slug} ${entry.name}`, entry.kategorie);
    const style = entry.kategorie === "bier" ? findBeerStyle(bierstil) : undefined;
    const etikettUrl =
      entry.etikettUrl ||
      findBestEtikettUrlForBeerName(entry.name, productImages, brewery, entry.kategorie);
    varieties.push({
      name: entry.name.slice(0, 80),
      produktKategorie: entry.kategorie,
      bierstil,
      flaschenTyp: "nrw_500",
      flaschenfarbe: entry.kategorie === "bier" ? "braun" : "klar",
      glasTyp: style?.glasTyp ?? "willibecher",
      etikettUrl: etikettUrl.slice(0, 1200),
    });
    if (varieties.length >= MAX_MY_BEERS) break;
  }

  return varieties.sort((a, b) => a.name.localeCompare(b.name, "de"));
}

export function suggestedBeersToDashboard(suggested: SuggestedBeerVariety[]): DashboardBeer[] {
  return replaceSuggestedBeers([], suggested);
}

/**
 * Ersetzt das Sortiment durch die Scan-Treffer.
 * Gleichnamige Einträge behalten id + vorhandenes Etikettfoto.
 * Fremde Marken-Sorten (nicht im Scan) fallen weg.
 */
export function replaceSuggestedBeers(
  existing: DashboardBeer[],
  suggested: SuggestedBeerVariety[],
): DashboardBeer[] {
  const byName = new Map(
    sanitizeDashboardBeers(existing).map((beer) => [beer.name.trim().toLowerCase(), beer] as const),
  );
  const out: DashboardBeer[] = [];
  const seen = new Set<string>();

  for (const suggestion of suggested) {
    if (out.length >= MAX_MY_BEERS) break;
    const name = suggestion.name.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const prev = byName.get(key);
    const etikettUrl = (suggestion.etikettUrl.trim() || prev?.etikettUrl || "").slice(0, 1200);
    out.push({
      id: prev?.id ?? `beer-${randomUUID()}`,
      name,
      produktKategorie: sanitizeProduktKategorie(suggestion.produktKategorie),
      bierstil: suggestion.bierstil,
      flaschenTyp: suggestion.flaschenTyp,
      flaschenfarbe: suggestion.flaschenfarbe,
      glasTyp: suggestion.glasTyp,
      etikettUrl,
      createdAt: prev?.createdAt || new Date().toISOString(),
    });
  }

  return sanitizeDashboardBeers(out);
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
      existingBeer.produktKategorie = sanitizeProduktKategorie(
        suggestion.produktKategorie || existingBeer.produktKategorie,
      );
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: `beer-${randomUUID()}`,
      name,
      produktKategorie: sanitizeProduktKategorie(suggestion.produktKategorie),
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

  try {
    const response = await publicFetch(parsed.toString(), {
      maxBytes: MAX_LABEL_BYTES,
      timeoutMs: URL_FETCH_TIMEOUT_MS,
      headers: { "User-Agent": BROWSER_USER_AGENT, Accept: "image/*" },
    });
    if (response.status < 200 || response.status >= 300) return trimmed;

    const contentType = (response.headers["content-type"] ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
    if (!ALLOWED_LABEL_MIME.has(contentType)) return trimmed;

    const buffer = response.body;
    if (buffer.byteLength < 32 || buffer.byteLength > MAX_LABEL_BYTES) return trimmed;

    return await uploadUserImageToStorage({
      userId,
      buffer,
      mime: contentType,
      folder: "beer-labels",
    });
  } catch {
    return trimmed;
  }
}

const LABEL_PERSIST_CONCURRENCY = 6;
/** Gesamtes Zeitbudget — Onboarding darf nicht an 64 sequentiellen Downloads scheitern (Vercel 60s). */
const LABEL_PERSIST_BUDGET_MS = 18_000;

export async function persistSuggestedBeerLabels(
  userId: string,
  suggested: SuggestedBeerVariety[],
  options?: { budgetMs?: number; concurrency?: number },
): Promise<SuggestedBeerVariety[]> {
  const budgetMs = options?.budgetMs ?? LABEL_PERSIST_BUDGET_MS;
  const concurrency = Math.max(1, options?.concurrency ?? LABEL_PERSIST_CONCURRENCY);
  const deadline = Date.now() + budgetMs;

  const out: SuggestedBeerVariety[] = suggested.map((beer) => ({
    ...beer,
    etikettUrl: beer.etikettUrl.trim().slice(0, 1200),
  }));

  const pending = out
    .map((beer, index) => ({ index, url: beer.etikettUrl }))
    .filter((item) => item.url && !isAlreadyPersistedLabelUrl(item.url));

  let cursor = 0;
  async function worker() {
    while (cursor < pending.length) {
      if (Date.now() >= deadline) return;
      const current = pending[cursor++];
      if (!current) return;
      const persisted = await persistBeerLabelFromUrl(userId, current.url);
      out[current.index] = {
        ...out[current.index]!,
        etikettUrl: persisted.slice(0, 1200),
      };
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, pending.length) }, () => worker());
  await Promise.all(workers);
  return out;
}
