import { extractRelevantInternalLinks, parseWebsiteHtml, type ParsedWebsitePage } from "./website-intake";
import { looksLikeBlockedGatePage } from "./consent-gate-dismiss";
import { catalogPageKey, type SafeFetchResult } from "./url-intake";

export type CatalogCrawlSkipReason = "timeout" | "error" | "blocked" | "external" | "budget";

export type CatalogCrawlSkip = {
  url: string;
  reason: CatalogCrawlSkipReason;
};

export type CatalogCrawlResult = {
  pages: ParsedWebsitePage[];
  rawHtmlByUrl: Record<string, string>;
  skipped: CatalogCrawlSkip[];
};

export function formatCatalogCrawlNote(pagesFetched: number, skipped: CatalogCrawlSkip[]): string | null {
  if (!skipped.length) return null;
  const timedOut = skipped.filter((item) => item.reason === "timeout" || item.reason === "budget").length;
  const failed = skipped.filter((item) => item.reason === "error").length;
  const parts = [`${pagesFetched} Seiten ausgewertet`];
  if (timedOut) parts.push(`${timedOut} wegen Zeitüberschreitung ausgelassen`);
  if (failed) parts.push(`${failed} fehlgeschlagen`);
  const other = skipped.length - timedOut - failed;
  if (other > 0) parts.push(`${other} übersprungen`);
  return parts.join(", ");
}

/** Bounded two-level crawl: assortment pages often link to separate flavour pages. */
export async function crawlCatalogPages(
  homepage: SafeFetchResult,
  fetchPage: (url: string) => Promise<SafeFetchResult>,
  options: { maxPages?: number; budgetMs?: number } = {},
): Promise<CatalogCrawlResult> {
  const maxPages = options.maxPages ?? 12;
  const deadline = Date.now() + (options.budgetMs ?? 30_000);
  const host = new URL(homepage.finalUrl).hostname.replace(/^www\./, "");
  const seen = new Set([catalogPageKey(homepage.finalUrl)]);
  const pages: ParsedWebsitePage[] = [];
  const skipped: CatalogCrawlSkip[] = [];
  const rawHtmlByUrl: Record<string, string> = { [homepage.finalUrl]: homepage.html };
  let sources = [homepage];
  let attempted = 0;

  const remainingMs = () => deadline - Date.now();

  for (let depth = 0; depth < 2; depth++) {
    const links = [...sources, homepage]
      .flatMap((page) => extractRelevantInternalLinks(page.html, page.finalUrl, 40))
      .sort((a, b) => b.score - a.score);
    // Reserve room for both beer and soft-drink pages, even when brewery links dominate.
    const soft = links.filter((link) =>
      /limon|limo|softdrink|erfrisch|cola|spezi|brause/i.test(`${link.url} ${link.label}`),
    );
    const queued = new Set<string>();
    const queue = [...soft.slice(0, 3), ...links]
      .filter((link) => {
        const id = catalogPageKey(link.url);
        if (seen.has(id) || queued.has(id) || new URL(link.url).hostname.replace(/^www\./, "") !== host) {
          return false;
        }
        queued.add(id);
        return true;
      })
      .slice(0, Math.min(depth === 0 ? 6 : maxPages, maxPages - attempted));

    if (remainingMs() <= 0) {
      for (const link of queue) skipped.push({ url: link.url, reason: "budget" });
      break;
    }

    sources = [];
    for (let offset = 0; offset < queue.length; offset += 3) {
      if (remainingMs() <= 0) {
        for (const link of queue.slice(offset)) skipped.push({ url: link.url, reason: "budget" });
        break;
      }
      const batch = queue.slice(offset, offset + 3);
      batch.forEach((link) => seen.add(catalogPageKey(link.url)));
      attempted += batch.length;

      const results = await Promise.all(
        batch.map(async (link) => {
          const waitMs = Math.max(1, remainingMs());
          let timer: ReturnType<typeof setTimeout> | undefined;
          try {
            const result = await Promise.race([
              fetchPage(link.url),
              new Promise<never>((_, reject) => {
                timer = setTimeout(
                  () => reject(Object.assign(new Error("timeout"), { code: "catalog_timeout" })),
                  waitMs,
                );
              }),
            ]);
            return { link, result };
          } catch (error) {
            const timedOut =
              error instanceof Error &&
              ((error as { code?: string }).code === "catalog_timeout" || /timeout|Zeitlimit/i.test(error.message));
            skipped.push({ url: link.url, reason: timedOut ? "timeout" : "error" });
            return { link, result: null as SafeFetchResult | null };
          } finally {
            if (timer) clearTimeout(timer);
          }
        }),
      );

      for (const { link, result } of results) {
        if (!result) continue;
        if (new URL(result.finalUrl).hostname.replace(/^www\./, "") !== host) {
          skipped.push({ url: link.url, reason: "external" });
          continue;
        }
        if (Object.keys(rawHtmlByUrl).some((url) => catalogPageKey(url) === catalogPageKey(result.finalUrl))) {
          continue;
        }
        const page = parseWebsiteHtml(result.html, result.finalUrl);
        if (looksLikeBlockedGatePage(result.html, page.textExcerpt)) {
          skipped.push({ url: result.finalUrl, reason: "blocked" });
          continue;
        }
        rawHtmlByUrl[result.finalUrl] = result.html;
        pages.push(page);
        sources.push(result);
      }
    }
  }

  return { pages, rawHtmlByUrl, skipped };
}
