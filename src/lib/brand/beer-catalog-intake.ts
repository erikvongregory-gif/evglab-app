import { catalogIdentity, catalogToken, readCatalogEvidence, readCatalogImages } from "./catalog-products";
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
import { assertSafePublicUrl, BROWSER_USER_AGENT, URL_FETCH_TIMEOUT_MS } from "@/lib/brand/url-intake";
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

// Product evidence must come from the item itself, never its domain or parent
// directory (a brewery's /bier/ shop can also contain glasses and merchandise).
const BEER_PRODUCT_SIGNAL = /\b(?:bier|beer|pils(?:ner|ener)?|hell(?:es|er)?|dunkel(?:es|er)?|(?:hefe|kristall)?weizen|weissbier|weizenbier|lager(?:bier)?|(?:doppel|eis|weizen)?bock|bockbier|radler|(?:ne|double-)?ipa|stout|porter|saison|koelsch|maerzen|kellerbier|zwickl|zwickelbier|altbier|festbier|oktoberfestbier|edelstoff|maximator|pale-ale)\b/;
const LIMONADE_SIGNAL = /\b(?:limonade|limo|cola|spezi|brause|orangeade|orangenlimonade|zitronenlimonade|zitronenlimo|orangenlimo|kola|fritz-kola|ginger-ale|bitter-lemon|tonic(?:-water|-wasser)?)\b/;
const TAFELWASSER_SIGNAL = /\btafel(?:-)?wasser\b/;
const MINERALWASSER_SIGNAL = /\b(?:mineral(?:-)?wasser|quell(?:-)?wasser)\b/;
const NON_CATALOG_PRODUCT = /\b(?:saft|saefte|schorle|energy|gin|whisk(?:e)?y|rum|vodka|wodka|schnaps|likoer|brand|braende|wein|sekt|cider|glas|glaeser|bierglas|bierglaeser|pilsglas|weizenglas|krug|kruege|bierkrug|masskrug|tasse\w*|becher|flaschenoeffner|oeffner|bierdeckel|untersetzer|shirt\w*|hoodie\w*|muetze\w*|cap|caps|kleidung|merch\w*|gutschein\w*|geschenk\w*|probierpaket\w*|bierpaket\w*|set|sets|paket\w*|fuehrung\w*|verkostung\w*|bierprobe\w*)\b/;
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

function imageMatchScore(name: string, image: CatalogImageRef, brewery: string): number {
  const wanted = catalogIdentity(name, brewery);
  const alt = catalogIdentity(image.alt, brewery);
  const slug = catalogIdentity(extractProductSlugFromImageUrl(image.url) ?? "", brewery);
  if (wanted === alt || wanted === slug) return 100;
  const modifiers = /(?:^|-)(alkoholfrei|zero|light|zuckerfrei|bock|naturtrueb|zitrone|orange|grapefruit|blutorange|helles|dunkel|0-0)(?=-|$)/g;
  const wantedModifiers = [...wanted.matchAll(modifiers)].map((match) => match[1]);
  return Math.max(0, ...[alt, slug].filter(Boolean).map((candidate) => {
    const otherModifiers = [...candidate.matchAll(modifiers)].map((match) => match[1]);
    // Never assign a regular product image to its zero/alcohol-free/flavour variant.
    if (otherModifiers.some((part) => !wantedModifiers.includes(part))) return 0;
    if (wantedModifiers.some((part) => !otherModifiers.includes(part) && part !== "helles")) return 0;
    const tokens = candidate.split("-");
    const wantedTokens = wanted.split("-");
    return tokens.every((part) => wantedTokens.includes(part)) ? 40 + candidate.length : 0;
  }));
}

export function extractBeerVarietiesFromIntake(params: {
  pages: ParsedWebsitePage[];
  downloadedImages: DownloadedImage[];
  imageCandidates?: ImageCandidate[];
  breweryName: string;
  rawHtmlByUrl?: Record<string, string>;
}): SuggestedBeerVariety[] {
  const brewery = params.breweryName.trim();
  type Entry = { name: string; kategorie: ProduktKategorie; etikettUrl: string; score: number };
  const entries = new Map<string, Entry>();
  const images: CatalogImageRef[] = [];
  const add = (name: string, kategorie: ProduktKategorie, etikettUrl = "", score = 0) => {
    const identity = catalogIdentity(name, brewery);
    if (!identity) return;
    const key = `${kategorie}:${identity}`;
    const existing = entries.get(key);
    if (!existing) entries.set(key, { name, kategorie, etikettUrl, score });
    else if (etikettUrl && score > existing.score) Object.assign(existing, { etikettUrl, score });
  };
  for (const page of params.pages) {
    for (const product of readCatalogEvidence(params.rawHtmlByUrl?.[page.pageUrl] ?? "", page.pageUrl)) {
      const token = catalogToken(product.name);
      if (NON_CATALOG_PRODUCT.test(token) || GENERIC_CATALOG_HEADING.test(token)) continue;
      const flavour = /\b(?:zitrone|orange|blutorange|grapefruit|zitrus|limette|rhabarber|waldmeister|himbeere|holunder|mandarine)\b/.test(token);
      const lemonadeContext = /limonad|limo|softdrink|erfrischungsgetr/i.test(product.context);
      const category = (product.category ?? "").replace(/\bLimonaden\b/gi, "Limonade").replace(/\bBiere\b/gi, "Bier");
      const kategorie = detectProduktKategorie(product.name) ?? detectProduktKategorie(category) ?? (flavour && lemonadeContext ? "limonade" : null);
      if (!kategorie) continue;
      const uniqueImage = product.images.length === 1 ? product.images[0] : "";
      add(product.name, kategorie, uniqueImage, uniqueImage ? 200 : 0);
      for (const url of product.images) images.push({ url, alt: product.images.length === 1 ? product.name : "", kategorie });
    }
  }
  // Shared catalogue art is not a trustworthy image for either individual variety.
  const imageUses = new Map<string, number>();
  for (const entry of entries.values()) {
    if (entry.etikettUrl) imageUses.set(entry.etikettUrl, (imageUses.get(entry.etikettUrl) ?? 0) + 1);
  }
  for (const entry of entries.values()) {
    if ((imageUses.get(entry.etikettUrl) ?? 0) > 1) Object.assign(entry, { etikettUrl: "", score: 0 });
  }
  const candidates = [...params.pages.flatMap((page) => readCatalogImages(params.rawHtmlByUrl?.[page.pageUrl] ?? "", page.pageUrl)), ...params.downloadedImages, ...(params.imageCandidates ?? []), ...params.pages.flatMap((page) => page.imageCandidates)];
  for (const candidate of candidates) {
    const slug = extractProductSlugFromImageUrl(candidate.url);
    if (!slug || PRODUCT_IMAGE_NOISE.test(imageFilename(candidate.url))) continue;
    const text = `${imageFilename(candidate.url)} ${candidate.alt}`;
    if (NON_CATALOG_PRODUCT.test(catalogToken(text))) continue;
    const kategorie = detectProduktKategorie(candidate.alt) ?? detectProduktKategorie(slug)
      ?? (/\balkoholfrei\b/.test(slug) && [...entries.values()].some((entry) => entry.kategorie === "bier" && imageMatchScore(entry.name, candidate, brewery) > 0) ? "bier" : null);
    if (kategorie) images.push({ url: candidate.url, alt: candidate.alt, kategorie });
  }
  // An image may enrich an existing product. It must not merge two named varieties.
  const claimedImages = new Set([...entries.values()].map((entry) => entry.etikettUrl).filter(Boolean));
  for (const entry of entries.values()) {
    const ranked = images.filter((image) => image.kategorie === entry.kategorie && (imageUses.get(image.url) ?? 0) <= 1)
      .map((image) => ({ image, score: imageMatchScore(entry.name, image, brewery) }))
      .filter((item) => item.score > 0).sort((a, b) => b.score - a.score);
    for (const match of ranked) {
      const competitors = [...entries.values()].filter((other) => other !== entry && other.kategorie === entry.kategorie && imageMatchScore(other.name, match.image, brewery) >= match.score);
      if (competitors.length) continue;
      claimedImages.add(match.image.url);
      if (match.score > entry.score) Object.assign(entry, { etikettUrl: match.image.url, score: match.score });
    }
  }
  for (const image of images) {
    if (claimedImages.has(image.url) || !image.kategorie || (imageUses.get(image.url) ?? 0) > 1) continue;
    const slug = extractProductSlugFromImageUrl(image.url);
    if (!slug) continue;
    const name = detectProduktKategorie(image.alt) ? image.alt : humanizeBeerSlug(catalogIdentity(slug), brewery);
    // Ambiguous short filename evidence must not become an additional phantom variety.
    if ([...entries.values()].some((entry) => entry.kategorie === image.kategorie && imageMatchScore(entry.name, image, brewery) > 0)) continue;
    add(name, image.kategorie, image.url, 50);
  }
  return [...entries.values()].slice(0, MAX_MY_BEERS).map((entry): SuggestedBeerVariety => {
    const bierstil = inferProduktBezeichnung(entry.name, entry.kategorie);
    const style = entry.kategorie === "bier" ? findBeerStyle(bierstil) : undefined;
    return {
      name: entry.name.slice(0, 80), produktKategorie: entry.kategorie, bierstil,
      flaschenTyp: "nrw_500", flaschenfarbe: entry.kategorie === "bier" ? "braun" : "klar",
      glasTyp: style?.glasTyp ?? "willibecher", etikettUrl: entry.etikettUrl.slice(0, 1200),
    };
  }).sort((a, b) => a.name.localeCompare(b.name, "de"));
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
  const byName = new Map<string, DashboardBeer>(
    sanitizeDashboardBeers(existing).map((beer) => [`${sanitizeProduktKategorie(beer.produktKategorie)}:${catalogIdentity(beer.name)}`, beer] as const),
  );
  const out: DashboardBeer[] = [];
  const seen = new Set<string>();

  for (const suggestion of suggested) {
    if (out.length >= MAX_MY_BEERS) break;
    const name = suggestion.name.trim();
    if (!name) continue;
    const key = `${sanitizeProduktKategorie(suggestion.produktKategorie)}:${catalogIdentity(name)}`;
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
  const seen = new Set(out.map((beer) => `${sanitizeProduktKategorie(beer.produktKategorie)}:${catalogIdentity(beer.name)}`));

  for (const suggestion of suggested) {
    if (out.length >= MAX_MY_BEERS) break;
    const name = suggestion.name.trim();
    if (!name) continue;
    const key = `${sanitizeProduktKategorie(suggestion.produktKategorie)}:${catalogIdentity(name)}`;
    const existingBeer = out.find((beer) => `${sanitizeProduktKategorie(beer.produktKategorie)}:${catalogIdentity(beer.name)}` === key);
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
