import { describe, expect, it } from "vitest";
import { collectCatalogCards, distinctGebinde, gebindeSuffix, rankCardsForProduct } from "./catalog-ai";
import { extractCatalogLinks } from "./product-catalog-crawl";

describe("product catalog crawl", () => {
  it("follows deep product pages under catalog paths and skips legal, news and foreign-language links", () => {
    const html = `
      <a href="/unsere-biere/hellbiere/muenchner-hell">Münchner Hell</a>
      <a href="/unsere-biere/radler/natur-radler"><img src="x.png">Natur Radler</a>
      <a href="/produkte/limo/zitrone">Limo Zitrone</a>
      <a href="/rechtliche-hinweise/impressum">Impressum</a>
      <a href="/neuigkeiten/world-beer-cup">News</a>
      <a href="/en/our-beers/hell">Hell (EN)</a>
      <a href="https://other.example/unsere-biere/pils">Fremd</a>
      <a href="/kontakt">Kontakt</a>`;
    const links = extractCatalogLinks(html, "https://www.brauerei.de/", "brauerei.de", false).map((link) =>
      new URL(link.url).pathname,
    );
    expect(links).toEqual(
      expect.arrayContaining([
        "/unsere-biere/hellbiere/muenchner-hell",
        "/unsere-biere/radler/natur-radler",
        "/produkte/limo/zitrone",
      ]),
    );
    expect(links.some((path) => /impressum|neuigkeiten|\/en\/|kontakt|pils/.test(path))).toBe(false);
  });
});

describe("catalog image cards", () => {
  it("keeps each image with its nearby product text, link and lazy/next-image source", () => {
    const html = `
      <section><h2>Unsere Biere</h2>
        <div class="product"><a href="/biere/pils"><img data-src="/img/pils_03.png" alt=""></a><h3>Pils Anno 1907</h3><p>0,33 l</p></div>
        <div class="product"><img src="/_next/image?url=%2Fuploads%2FHelles_alkfrei.png&amp;w=3840" alt="Helles Alkoholfrei"><h3>Helles Alkoholfrei</h3></div>
        <img src="/logo.svg"><img src="/assets/icons/arrow.png">
      </section>`;
    const { cards, pages } = collectCatalogCards({ "https://www.brauerei.de/biere": html });
    expect(pages[0]?.headings).toContain("Unsere Biere");
    const pils = cards.find((card) => card.imageUrl.endsWith("/img/pils_03.png"));
    expect(pils?.text).toContain("Pils Anno 1907");
    expect(pils?.link).toBe("https://www.brauerei.de/biere/pils");
    expect(cards.some((card) => card.imageUrl === "https://www.brauerei.de/uploads/Helles_alkfrei.png")).toBe(true);
    expect(cards.some((card) => /logo|arrow/.test(card.imageUrl))).toBe(false);
  });

  it("reads JSON-LD shop products as image cards", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@type": "Product",
      name: "Mineralwasser Medium",
      category: "Wasser",
      image: ["https://shop.brunnen.de/medium.jpg"],
    })}</script>`;
    const { cards } = collectCatalogCards({ "https://shop.brunnen.de/medium": html });
    expect(cards[0]).toMatchObject({ imageUrl: "https://shop.brunnen.de/medium.jpg", alt: "Mineralwasser Medium" });
    expect(cards[0]?.text).toContain("Wasser");
  });
});

describe("Gebinde-Varianten und Nachsuche", () => {
  it("legt 0,5 l und 0,33 l Bügel als eigene Gebinde an, gleiche Füllmenge nur einmal", () => {
    expect(distinctGebinde(["buegel_500", "buegel_330"])).toEqual(["buegel_500", "buegel_330"]);
    expect(distinctGebinde(["nrw_500", undefined, "buegel_500", "dose_500"])).toEqual(["nrw_500", "dose_500"]);
    expect(gebindeSuffix("buegel_330")).toBe("0,33 l");
    expect(gebindeSuffix("buegel_500")).toBe("0,5 l");
    expect(gebindeSuffix("dose_500")).toBe("Dose 0,5 l");
  });

  it("findet Bild-Kandidaten über den Sortennamen und trennt alkoholfrei", () => {
    const card = (id: number, file: string, alt = "") => ({
      id,
      imageUrl: `https://brauerei.de/img/${file}`,
      pageUrl: "https://brauerei.de/biere",
      alt,
      text: "",
      link: "",
      section: "",
    });
    const cards = [
      card(1, "kellerbier-naturtrueb-05.png"),
      card(2, "hell-alkoholfrei.png"),
      card(3, "hell.png", "Hell »Das Blaue«"),
      card(4, "team.jpg"),
    ];
    expect(rankCardsForProduct("Kellerbier »Naturtrüb«", cards).map((entry) => entry.id)).toEqual([1]);
    expect(rankCardsForProduct("Hell »Das Blaue«", cards)[0]?.id).toBe(3);
    expect(rankCardsForProduct("Hell Alkoholfrei", cards)[0]?.id).toBe(2);
  });

  it("sammelt externe Links (z. B. Wirtshaus → Brauerei) ohne Social Media", () => {
    const { externalLinks } = collectCatalogCards({
      "https://www.wirtshaus.de/": `<footer>
        <a href="https://www.brauerei-muenchen.de/">Unsere Brauerei</a>
        <a href="https://www.instagram.com/wirtshaus">Instagram</a>
        <a href="/kontakt">Kontakt</a></footer>`,
    });
    expect(externalLinks).toEqual([{ url: "https://www.brauerei-muenchen.de/", text: "Unsere Brauerei" }]);
  });
});
