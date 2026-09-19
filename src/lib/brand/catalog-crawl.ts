import { extractRelevantInternalLinks, parseWebsiteHtml, type ParsedWebsitePage } from "./website-intake";
import { looksLikeBlockedGatePage } from "./consent-gate-dismiss";
import type { SafeFetchResult } from "./url-intake";

/** Bounded two-level crawl: assortment pages often link to separate flavour pages. */
export async function crawlCatalogPages(
  homepage: SafeFetchResult,
  fetchPage: (url: string) => Promise<SafeFetchResult>,
  options: { maxPages?: number; budgetMs?: number } = {},
): Promise<{ pages: ParsedWebsitePage[]; rawHtmlByUrl: Record<string, string> }> {
  const maxPages = options.maxPages ?? 12;
  const deadline = Date.now() + (options.budgetMs ?? 30_000);
  const key = (url: string) => { const parsed = new URL(url); return `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname.replace(/\/+$/, "")}`; };
  const host = new URL(homepage.finalUrl).hostname.replace(/^www\./, "");
  const seen = new Set([key(homepage.finalUrl)]);
  const pages: ParsedWebsitePage[] = [];
  const rawHtmlByUrl: Record<string, string> = { [homepage.finalUrl]: homepage.html };
  let sources = [homepage];
  let attempted = 0;
  for (let depth = 0; depth < 2 && Date.now() < deadline; depth++) {
    const links = [...sources, homepage].flatMap((page) => extractRelevantInternalLinks(page.html, page.finalUrl, 40))
      .sort((a, b) => b.score - a.score);
    // Reserve room for both beer and soft-drink pages, even when brewery links dominate.
    const soft = links.filter((link) => /limon|limo|softdrink|erfrisch|cola|spezi|brause/i.test(`${link.url} ${link.label}`));
    const queued = new Set<string>();
    const queue = [...soft.slice(0, 3), ...links].filter((link) => {
      const id = key(link.url);
      if (seen.has(id) || queued.has(id) || new URL(link.url).hostname.replace(/^www\./, "") !== host) return false;
      queued.add(id); return true;
    }).slice(0, Math.min(depth === 0 ? 6 : maxPages, maxPages - attempted));
    sources = [];
    for (let offset = 0; offset < queue.length && Date.now() < deadline; offset += 3) {
      const batch = queue.slice(offset, offset + 3);
      batch.forEach((link) => seen.add(key(link.url)));
      attempted += batch.length;
      const results = await Promise.all(batch.map(async (link) => {
        try { return await fetchPage(link.url); } catch { return null; }
      }));
      for (const result of results) {
        if (!result || new URL(result.finalUrl).hostname.replace(/^www\./, "") !== host || Object.keys(rawHtmlByUrl).some((url) => key(url) === key(result.finalUrl))) continue;
        const page = parseWebsiteHtml(result.html, result.finalUrl);
        if (looksLikeBlockedGatePage(result.html, page.textExcerpt)) continue;
        rawHtmlByUrl[result.finalUrl] = result.html;
        pages.push(page); sources.push(result);
      }
    }
  }
  return { pages, rawHtmlByUrl };
}
