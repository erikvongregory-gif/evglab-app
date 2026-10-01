import { load } from "cheerio";
import { catalogPageKey, normalizeCatalogUrl, resolveAbsoluteUrl, type SafeFetchResult } from "./url-intake";

/**
 * Sortiments-Crawler: folgt gezielt Links auf Sortiments-, Kategorie- und Produktseiten
 * (auch tiefe Pfade wie /unsere-biere/hellbiere/muenchner-hell), damit jede Sorte mit
 * ihrer eigenen Seite und ihrem Produktbild erfasst wird.
 */

const CATALOG_PATH =
  /(?:^|[/_-])(?:unsere?-?biere?|unser-?bier|biere|bier|biersorten|sorten|sortiment|produkte?|products?|beers?|getraenke|drinks|limonaden?|limo|softdrinks?|erfrischungsgetraenke|alkoholfreie?|wasser|mineralwasser|tafelwasser|brunnen|spezialitaeten|bierspezialitaeten|weissbiere?|weizenbiere?|hellbiere?|helle|dunkle|radler|cola|spezi|schorlen?)(?:$|[/_-])/;
const CATALOG_LABEL =
  /\b(?:unsere?\s+biere?|sortiment|biersorten|sorten|produkte|getränke|limonaden?|limo|wasser|alkoholfrei|spezialitäten|weißbiere?|weissbiere?|hellbiere?|radler)\b/i;
const NOISE_PATH =
  /(?:^|[/_-])(?:impressum|datenschutz|privacy|agb|nutzungsbedingungen|rechtliche-hinweise|cookie|karriere|jobs?|stellen|presse|presseservice|news|neuigkeiten|aktuelles|blog|magazin|events?|veranstaltungen|termine|kontakt|contact|newsletter|haendlersuche|partnerbereich|login|konto|account|warenkorb|cart|checkout|wp-admin|wp-login|feed|tag|author|rezepte?|gewinnspiel|fan-momente|historie|geschichte)(?:$|[/_-])/;
const FOREIGN_LANG_PREFIX = /^\/(?:en|it|fr|es|nl|pl|cs|us|uk|ru|zh|ja)(?:\/|$)/;
const FILE_EXTENSION = /\.(?:pdf|jpe?g|png|webp|gif|svg|zip|docx?|xlsx?|mp4|mp3)$/i;

type CatalogLink = { url: string; score: number };

function decodedPath(url: URL): string {
  try {
    return decodeURIComponent(url.pathname).toLowerCase()
      .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
  } catch {
    return url.pathname.toLowerCase();
  }
}

/** Interne Sortimentslinks einer Seite mit Priorität (Produkt-Detailseiten unter einem Sortimentspfad zuerst). */
export function extractCatalogLinks(html: string, pageUrl: string, host: string, allowForeignLang: boolean): CatalogLink[] {
  const $ = load(html);
  const out = new Map<string, CatalogLink>();
  $("a[href]").each((_, node) => {
    const href = ($(node).attr("href") ?? "").trim();
    if (!href || /^(?:javascript|mailto|tel|data):/i.test(href) || href.startsWith("#")) return;
    const abs = resolveAbsoluteUrl(pageUrl, href);
    if (!abs) return;
    let url: URL;
    try {
      url = new URL(abs);
    } catch {
      return;
    }
    if (url.hostname.replace(/^www\./, "").toLowerCase() !== host) return;
    const path = decodedPath(url);
    if (path === "/" || FILE_EXTENSION.test(path) || NOISE_PATH.test(path)) return;
    if (!allowForeignLang && FOREIGN_LANG_PREFIX.test(path)) return;
    const label = $(node).text().replace(/\s+/g, " ").trim().slice(0, 80);
    const pathHit = CATALOG_PATH.test(path);
    if (!pathHit && !CATALOG_LABEL.test(label)) return;
    const depth = path.split("/").filter(Boolean).length;
    // Tiefe Pfade unter einem Sortimentssegment sind fast immer Produkt-Detailseiten.
    const score = (pathHit ? 10 : 4) + Math.min(depth, 4) * 2 + ($(node).find("img,picture").length ? 3 : 0);
    url.hash = "";
    const normalized = normalizeCatalogUrl(url.toString());
    const key = catalogPageKey(normalized);
    const existing = out.get(key);
    if (!existing || score > existing.score) out.set(key, { url: normalized, score });
  });
  return [...out.values()];
}

export type ProductCatalogCrawlResult = {
  /** Neu geladene Seiten (finalUrl → HTML). */
  rawHtmlByUrl: Record<string, string>;
  attempted: number;
  failed: number;
};

/**
 * Lädt bis zu `maxPages` Sortiments-/Produktseiten zusätzlich zu den bereits geladenen.
 * Bereits bekannte Seiten werden nur als Linkquelle genutzt, nicht erneut geladen.
 */
export async function crawlProductCatalog(
  homepage: SafeFetchResult,
  knownHtmlByUrl: Record<string, string>,
  fetchPage: (url: string) => Promise<SafeFetchResult>,
  options: { maxPages?: number; budgetMs?: number; concurrency?: number } = {},
): Promise<ProductCatalogCrawlResult> {
  const maxPages = options.maxPages ?? 28;
  const concurrency = options.concurrency ?? 5;
  const deadline = Date.now() + (options.budgetMs ?? 25_000);
  const home = new URL(homepage.finalUrl);
  const host = home.hostname.replace(/^www\./, "").toLowerCase();
  const allowForeignLang = FOREIGN_LANG_PREFIX.test(home.pathname);

  const seen = new Set<string>(Object.keys(knownHtmlByUrl).map((url) => catalogPageKey(url)));
  seen.add(catalogPageKey(homepage.finalUrl));
  const frontier = new Map<string, CatalogLink>();
  const addLinks = (html: string, pageUrl: string) => {
    for (const link of extractCatalogLinks(html, pageUrl, host, allowForeignLang)) {
      const key = catalogPageKey(link.url);
      if (seen.has(key)) continue;
      const existing = frontier.get(key);
      if (!existing || link.score > existing.score) frontier.set(key, link);
    }
  };
  addLinks(homepage.html, homepage.finalUrl);
  for (const [url, html] of Object.entries(knownHtmlByUrl)) addLinks(html, url);

  const rawHtmlByUrl: Record<string, string> = {};
  let attempted = 0;
  let failed = 0;

  while (attempted < maxPages && frontier.size > 0 && Date.now() < deadline) {
    const batch = [...frontier.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.min(concurrency, maxPages - attempted));
    for (const link of batch) {
      const key = catalogPageKey(link.url);
      frontier.delete(key);
      seen.add(key);
    }
    attempted += batch.length;
    const results = await Promise.all(
      batch.map(async (link) => {
        const remaining = deadline - Date.now();
        if (remaining <= 0) return null;
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          return await Promise.race([
            fetchPage(link.url),
            new Promise<null>((resolve) => {
              timer = setTimeout(() => resolve(null), remaining);
            }),
          ]);
        } catch {
          return null;
        } finally {
          if (timer) clearTimeout(timer);
        }
      }),
    );
    for (const result of results) {
      if (!result) {
        failed += 1;
        continue;
      }
      let finalHost = "";
      try {
        finalHost = new URL(result.finalUrl).hostname.replace(/^www\./, "").toLowerCase();
      } catch {
        failed += 1;
        continue;
      }
      if (finalHost !== host) continue;
      const key = catalogPageKey(result.finalUrl);
      seen.add(key);
      if (Object.keys(rawHtmlByUrl).some((url) => catalogPageKey(url) === key)) continue;
      rawHtmlByUrl[result.finalUrl] = result.html;
      addLinks(result.html, result.finalUrl);
    }
  }

  return { rawHtmlByUrl, attempted, failed };
}
