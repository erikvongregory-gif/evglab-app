import { describe, expect, it, vi } from "vitest";
import { catalogPageKey, normalizeCatalogUrl } from "./url-intake";
import { crawlCatalogPages, formatCatalogCrawlNote } from "./catalog-crawl";

const page = (path: string, html: string) => ({ finalUrl: `https://example.com${path}`, html, contentType: "text/html" });

describe("catalog crawl", () => {
  it("discovers soft-drink details, prioritizes lemonade and deduplicates URL variants", async () => {
    const homepage = page("/", `<a href="/unsere-biere">Biere</a><a href="/limonaden">Limonaden</a><a href="/limonaden/?utm_source=x">Limonaden</a>`);
    const fetchPage = vi.fn(async (url: string) => {
      if (/\/limonaden\/?$/.test(new URL(url).pathname)) {
        return page("/limonaden", '<h1>Limonaden</h1><a href="/limonaden/zitrone">Zitrone</a>');
      }
      return page(new URL(url).pathname, "<h1>Produkt</h1>");
    });
    const result = await crawlCatalogPages(homepage, fetchPage);
    expect(fetchPage.mock.calls[0][0]).toContain("/limonaden");
    expect(fetchPage.mock.calls.filter(([url]) => /\/limonaden\/?$/.test(new URL(url).pathname))).toHaveLength(1);
    expect(result.pages.map((item) => item.pageUrl)).toContain("https://example.com/limonaden/zitrone");
  });

  it("keeps product query params so different ids stay distinct", async () => {
    const homepage = page(
      "/",
      `<a href="/biere/detail?id=123&utm_source=x">Pils</a><a href="/biere/detail?id=456">Helles</a>`,
    );
    const fetchPage = vi.fn(async (url: string) => page(new URL(url).pathname + new URL(url).search, "<h1>Produkt</h1>"));
    const result = await crawlCatalogPages(homepage, fetchPage);
    const ids = fetchPage.mock.calls.map(([url]) => new URL(url).searchParams.get("id")).sort();
    expect(ids).toEqual(["123", "456"]);
    expect(result.skipped).toEqual([]);
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
    expect(result.skipped.some((item) => item.reason === "error")).toBe(true);
    expect(result.skipped.some((item) => item.reason === "external")).toBe(true);
  });

  it("does not start requests once the crawl budget is exhausted", async () => {
    const fetchPage = vi.fn();
    const result = await crawlCatalogPages(page("/", '<a href="/limonaden">Limonaden</a>'), fetchPage, { budgetMs: 0 });
    expect(fetchPage).not.toHaveBeenCalled();
    expect(result.skipped.some((item) => item.reason === "budget")).toBe(true);
  });

  it("records timed-out fetches instead of swallowing them", async () => {
    const homepage = page("/", '<a href="/biere/slow">Langsam</a>');
    const fetchPage = vi.fn(
      () => new Promise<never>(() => {
        /* never resolves */
      }),
    );
    const result = await crawlCatalogPages(homepage, fetchPage, { budgetMs: 40 });
    expect(result.pages).toHaveLength(0);
    expect(result.skipped.some((item) => item.reason === "timeout")).toBe(true);
  });

  it("formats a readable crawl note", () => {
    expect(
      formatCatalogCrawlNote(8, [
        { url: "a", reason: "timeout" },
        { url: "b", reason: "budget" },
      ]),
    ).toBe("8 Seiten ausgewertet, 2 wegen Zeitüberschreitung ausgelassen");
  });
});

describe("catalog page identity", () => {
  it("strips tracking but keeps product ids", () => {
    expect(catalogPageKey("https://Shop.Example.com/produkt/?id=12&utm_source=x")).toBe("shop.example.com/produkt?id=12");
    expect(catalogPageKey("https://shop.example.com/produkt?id=12")).not.toBe(
      catalogPageKey("https://shop.example.com/produkt?id=99"),
    );
    expect(normalizeCatalogUrl("https://shop.example.com/produkt?id=12&utm_campaign=y")).toBe(
      "https://shop.example.com/produkt?id=12",
    );
  });
});
