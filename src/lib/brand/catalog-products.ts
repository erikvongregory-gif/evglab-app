import { load } from "cheerio";
import { resolveAbsoluteUrl } from "./url-intake";

export function catalogToken(value: string): string {
  return value.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue")
    .replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Packaging and image renditions are not varieties. Keep zero/0.0 and flavour modifiers. */
export function catalogIdentity(value: string, brewery = ""): string {
  let clean = value.replace(/\.(?:png|jpe?g|webp|avif)$/i, "")
    .replace(/(?:\d+\s*[x×]\s*)?\d+(?:[.,]\d+)?\s*(?:ml|cl|l|liter)\b/gi, " ")
    .replace(/\b\d{2,4}[x×]\d{2,4}\b/gi, " ")
    .replace(/(?:^|[-_])(?:[a-f0-9]{8,}|\d{2,4}w)(?=$|[-_])/gi, " ");
  clean = catalogToken(clean);
  const brand = catalogToken(brewery);
  const short = brand.split(/-(?:braeu|brauerei|brewery|brewing)\b/)[0];
  for (const prefix of [brand, short]) {
    if (prefix && clean.startsWith(`${prefix}-`)) clean = clean.slice(prefix.length + 1);
  }
  return clean.split("-").filter((part) => !/^(?:flasche|flaschen|bottle|bottles|dose|dosen|can|packshot|freisteller|front|vorderseite|produktbild|scaled|csm)$/.test(part))
    .map((part) => /^(?:hell|heller)$/.test(part) ? "helles" : part === "alkoholfreies" ? "alkoholfrei" : part)
    .join("-");
}

export type CatalogEvidence = { name: string; context: string; category?: string; images: string[] };

export function readCatalogImages(html: string, pageUrl: string): Array<{ url: string; alt: string }> {
  const $ = load(html);
  const images: Array<{ url: string; alt: string }> = [];
  $("img").each((_, node) => {
    const img = $(node);
    const srcset = img.attr("data-srcset") || img.attr("srcset") || img.closest("picture").find("source").first().attr("srcset") || "";
    const sources = [img.attr("data-src"), img.attr("data-lazy-src"), img.attr("data-original"),
      ...srcset.split(",").map((part) => part.trim().split(/\s+/)).sort((a, b) => (parseFloat(b[1]) || 0) - (parseFloat(a[1]) || 0)).map((part) => part[0]), img.attr("src")];
    for (const src of sources) {
      if (!src || /^(?:data|blob):/i.test(src) || /placeholder|spacer|loader|pixel/i.test(src)) continue;
      const url = resolveAbsoluteUrl(pageUrl, src);
      if (!url || !/^https?:/i.test(url)) continue;
      images.push({ url, alt: img.attr("alt") ?? "" });
      break;
    }
  });
  return images;
}

/** Read only existing markup. No network access and no execution of site scripts. */
export function readCatalogEvidence(html: string, pageUrl: string): CatalogEvidence[] {
  const $ = load(html);
  const products: CatalogEvidence[] = [];
  const imageUrl = (value: string) => {
    if (!value || /^(?:data|blob):/i.test(value)) return "";
    const url = resolveAbsoluteUrl(pageUrl, value);
    return url && /^https?:/i.test(url) && !/placeholder|spacer|loader|pixel|logo|banner|hero/i.test(url) ? url : "";
  };
  const jsonImages = (value: unknown): string[] => {
    if (typeof value === "string") return [imageUrl(value)].filter(Boolean);
    if (Array.isArray(value)) return value.flatMap(jsonImages);
    if (value && typeof value === "object") {
      const image = value as Record<string, unknown>;
      return jsonImages(image.contentUrl ?? image.url ?? "");
    }
    return [];
  };
  const visit = (value: unknown, depth = 0) => {
    if (!value || typeof value !== "object" || depth > 16) return;
    if (Array.isArray(value)) { value.forEach((item) => visit(item, depth + 1)); return; }
    const record = value as Record<string, unknown>;
    const types = [record["@type"]].flat();
    if (types.some((type) => typeof type === "string" && /(?:^|\/)Product$/.test(type)) && typeof record.name === "string") {
      const category = typeof record.category === "string" ? record.category : "";
      products.push({ name: record.name.trim(), context: category, category, images: jsonImages(record.image) });
    }
    Object.values(record).forEach((item) => visit(item, depth + 1));
  };
  $('script[type="application/ld+json"]').each((_, node) => {
    try { visit(JSON.parse($(node).text())); } catch { /* Broken JSON-LD must not discard HTML evidence. */ }
  });
  $("script, style, nav, header, footer").remove();
  const headingSelector = 'h1,h2,h3,h4,[itemprop="name"],.product-title,.product_title,.woocommerce-loop-product__title,strong[class*="product"],b[class*="product"],li[class*="sorte"],p[class*="product"],p[class*="bier"]';
  $(headingSelector).each((_, node) => {
    const heading = $(node);
    const name = heading.text().replace(/\s+/g, " ").trim();
    if (name.length < 3 || name.length > 80) return;
    // Ascend only within a single-product container, never to a whole assortment.
    let scope = heading;
    for (let level = 0; level < 4; level++) {
      const parent = scope.parent();
      if (!parent.length || parent.is("body,html") || parent.find(headingSelector).length > 1) break;
      scope = parent;
    }
    const category = scope.find('[itemprop="category"],.product-category,.product-category-name').first().text();
    let context = category;
    // A flavour-only title needs a locally scoped lemonade section, not a site-wide menu.
    const section = heading.closest("section");
    const sectionTitle = section.length ? section.find("h1,h2").first().text() : $("h1").first().text();
    if (/limonaden|limonade|limo|softdrinks|erfrischungsgetr[aä]nke/i.test(sectionTitle)) context += ` ${sectionTitle}`;
    const images = readCatalogImages($.html(scope), pageUrl).map((image) => image.url)
      .filter((url) => Boolean(imageUrl(url)));
    products.push({ name, context, category, images: [...new Set(images)] });
  });
  return products;
}
