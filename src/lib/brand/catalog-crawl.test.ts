import { describe, expect, it, vi } from "vitest";
import { crawlCatalogPages } from "./catalog-crawl";

const page = (path: string, html: string) => ({ finalUrl: `https://example.com${path}`, html, contentType: "text/html" });

describe("catalog crawl", () => {
  it("discovers soft-drink details, prioritizes lemonade and deduplicates URL variants", async () => {
    const homepage = page("/", `<a href="/unsere-biere">Biere</a><a href="/limonaden">Limonaden</a><a href="/limonaden/?utm_source=x">Limonaden</a>`);
    const fetchPage = vi.fn(async (url: string) => {
      if (url.endsWith("/limonaden")) return page("/limonaden", '<h1>Limonaden</h1><a href="/limonaden/zitrone">Zitrone</a>');
      return page(new URL(url).pathname, "<h1>Produkt</h1>");
    });
    const result = await crawlCatalogPages(homepage, fetchPage);
    expect(fetchPage.mock.calls[0][0]).toBe("https://example.com/limonaden");
    expect(fetchPage.mock.calls.filter(([url]) => /\/limonaden\/?$/.test(url))).toHaveLength(1);
    expect(result.pages.map((item) => item.pageUrl)).toContain("https://example.com/limonaden/zitrone");
  });

  it("bounds requests, tolerates failures and excludes external redirects", async () => {
    const homepage = page("/", Array.from({ length: 30 }, (_, i) => `<a href="/biere/${i}">Bier ${i}</a>`).join(""));
    const fetchPage = vi.fn(async (url: string) => {
      if (url.endsWith("/0")) throw new Error("unavailable");
      if (url.endsWith("/1")) return { ...page("/", "<h1>Cola</h1>"), finalUrl: "https://other.example/" };
      return page(new URL(url).pathname, "<h1>Pils</h1>");
    });
    const result = await crawlCatalogPages(homepage, fetchPage, { maxPages: 8 });
    expect(fetchPage).toHaveBeenCalledTimes(8);
    expect(result.pages).toHaveLength(6);
    expect(Object.keys(result.rawHtmlByUrl)).not.toContain("https://other.example/");
  });

  it("does not start requests once the crawl budget is exhausted", async () => {
    const fetchPage = vi.fn();
    await crawlCatalogPages(page("/", '<a href="/limonaden">Limonaden</a>'), fetchPage, { budgetMs: 0 });
    expect(fetchPage).not.toHaveBeenCalled();
  });
});
