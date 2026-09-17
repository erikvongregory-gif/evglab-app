import { describe, expect, it } from "vitest";
import {
  extractBeerVarietiesFromIntake,
  humanizeBeerSlug,
  inferBierstilFromName,
  mergeSuggestedBeers,
  replaceSuggestedBeers,
  suggestedBeersToDashboard,
} from "@/lib/brand/beer-catalog-intake";
import type { ImageCandidate } from "@/lib/brand/website-intake";
import type { DownloadedImage } from "@/lib/brand/website-intake";

function catalogImage(url: string): DownloadedImage {
  return {
    url,
    alt: "",
    score: 56,
    productScore: 56,
    lifestyleScore: 40,
    isPackshot: true,
    base64: "",
    mediaType: "image/jpeg",
    mime: "image/jpeg",
    sizeBytes: 1000,
  };
}

describe("beer-catalog-intake", () => {
  function scan(html: string, images: DownloadedImage[] = []) {
    const pageUrl = "https://bier-brauerei.de/biere/";
    return extractBeerVarietiesFromIntake({
      pages: [{ pageUrl, title: "Sortiment", textBlocks: [], textExcerpt: "", imageCandidates: [] }],
      downloadedImages: images,
      breweryName: "Testbrauerei",
      rawHtmlByUrl: { [pageUrl]: html },
    });
  }

  it("imports mixed drinks and keeps radler plus alcohol-free beer as beer", () => {
    const beers = ["Natur Pils", "Helles", "Hefeweizen", "Hazy NEIPA", "Alkoholfreies Pils", "Natur Radler"];
    const softdrinks = ["Limonade", "Cola", "Mineralwasser", "Tafelwasser"];
    const other = ["Alkoholfrei", "Bierglas", "Pils Glas", "Weizen Tasse", "Bier T-Shirt", "Bier Gutschein", "Bierbrand", "Bierpaket", "Premium Original", "Unsere Biere", "Bier erleben", "Wasser", "Getränke"];
    const html = [...beers, ...softdrinks, ...other].map((name) => `<h2>${name}</h2>`).join("");
    const result = scan(html);
    expect(result.map((beer) => beer.name).sort()).toEqual([...beers, ...softdrinks].sort());
    expect(result.find((item) => item.name === "Natur Radler")?.produktKategorie).toBe("bier");
    expect(result.find((item) => item.name === "Alkoholfreies Pils")?.produktKategorie).toBe("bier");
    expect(result.find((item) => item.name === "Limonade")?.produktKategorie).toBe("limonade");
    expect(result.find((item) => item.name === "Cola")?.produktKategorie).toBe("limonade");
    expect(result.find((item) => item.name === "Tafelwasser")?.produktKategorie).toBe("tafelwasser");
    expect(result.find((item) => item.name === "Mineralwasser")?.produktKategorie).toBe("mineralwasser");
  });

  it("does not promote arbitrary packshots, CMS filenames or brewery paths to beers", () => {
    const files = ["tasse", "premium-original", "csm_Brauerei-geschenk_abcdef12", "pils-glas", "bier-shirt", "alkoholfrei", "flasche", "label", "original", "wasser"];
    const images = files.map((file) => catalogImage(`https://bier-brauerei.de/biere/${file}.jpg`));
    expect(scan("<h2>Willkommen</h2><h2>Getränke</h2>", images)).toEqual([]);
  });

  it("uses item alt text as beer evidence and rejects merchandise despite beer filenames", () => {
    const images = [
      { ...catalogImage("https://example.com/product-4711.jpg"), alt: "Sonnen Pils" },
      { ...catalogImage("https://example.com/helles.jpg"), alt: "Helles Bierglas" },
    ];
    const result = scan("", images);
    expect(result.map((beer) => beer.name)).toEqual(["Sonnen Pils"]);
    expect(result[0].etikettUrl).toContain("product-4711");
  });

  it("does not infer beers from substring matches such as saison or ipa", () => {
    expect(scan("<h2>Saison Angebote</h2><h2>Marzipan</h2><h2>Helles Glas</h2><h2>Lager Verkauf</h2>").map((beer) => beer.name)).toEqual([]);
  });

  it("maps common beer names to bierstil codes", () => {
    expect(inferBierstilFromName("Augustiner Pils")).toBe("pils");
    expect(inferBierstilFromName("Weissbier")).toBe("hefeweizen");
    expect(inferBierstilFromName("Alkoholfrei")).toBe("alkoholfrei_pilsner");
  });

  it("humanizes product slugs with brewery prefix", () => {
    expect(humanizeBeerSlug("pils", "Augustiner-Bräu München")).toBe("Augustiner Pils");
  });

  it("extracts Augustiner sortiment from catalog image filenames", () => {
    const varieties = extractBeerVarietiesFromIntake({
      pages: [
        {
          pageUrl: "https://www.augustiner-braeu.de/unser-bier/",
          title: "Unser Bier",
          textBlocks: [],
          textExcerpt: "",
          imageCandidates: [],
        },
      ],
      downloadedImages: [
        catalogImage(
          "https://www.augustiner-braeu.de/fileadmin/_processed_/b/4/csm_Augustiner-pils_ce71e2324b.jpg",
        ),
        catalogImage(
          "https://www.augustiner-braeu.de/fileadmin/_processed_/f/7/csm_Augustiner-weissbier_0c0c0d5850.jpg",
        ),
        { ...catalogImage(
          "https://www.augustiner-braeu.de/fileadmin/_processed_/5/4/csm_Augustiner-alkoholfrei_60650aa974.jpg",
        ), alt: "Augustiner Alkoholfreies Bier" },
      ],
      breweryName: "Augustiner-Bräu München",
    });

    const names = varieties.map((beer) => beer.name);
    expect(names.some((name) => /pils/i.test(name))).toBe(true);
    expect(names.some((name) => /weissbier|weizen/i.test(name))).toBe(true);
    expect(names.some((name) => /alkoholfrei/i.test(name))).toBe(true);
    expect(varieties.every((beer) => beer.etikettUrl.startsWith("https://"))).toBe(true);
  });

  it("maps long HTML names to shorter product image slugs", () => {
    const catalogImages: ImageCandidate[] = [
      {
        url: "https://brauerei.de/fileadmin/csm_Augustiner-alkoholfrei_60650aa974.jpg",
        alt: "",
        score: 56,
        productScore: 56,
        lifestyleScore: 40,
      },
      {
        url: "https://brauerei.de/fileadmin/csm_Augustiner-bock_8b0082fad4.jpg",
        alt: "",
        score: 56,
        productScore: 56,
        lifestyleScore: 40,
      },
      {
        url: "https://brauerei.de/fileadmin/csm_Augustiner-hell_d9ab0bfbf8.jpg",
        alt: "",
        score: 56,
        productScore: 56,
        lifestyleScore: 40,
      },
    ];
    const html = `
      <h2>Augustiner Alkoholfrei Hell</h2>
      <h2>Augustiner Heller Bock</h2>
      <h2>Augustiner Lagerbier Hell</h2>
    `;
    const varieties = extractBeerVarietiesFromIntake({
      pages: [
        {
          pageUrl: "https://brauerei.de/unser-bier/",
          title: "Sortiment",
          textBlocks: [],
          textExcerpt: "",
          imageCandidates: catalogImages,
        },
      ],
      downloadedImages: [],
      imageCandidates: catalogImages,
      breweryName: "Augustiner-Bräu München",
      rawHtmlByUrl: { "https://brauerei.de/unser-bier/": html },
    });

    const byName = Object.fromEntries(varieties.map((beer) => [beer.name, beer.etikettUrl]));
    expect(byName["Augustiner Alkoholfrei Hell"]).toContain("alkoholfrei");
    expect(byName["Augustiner Heller Bock"]).toContain("bock");
    expect(byName["Augustiner Lagerbier Hell"]).toContain("hell");
  });

  it("resolves etikett URLs from image candidates without download", () => {
    const varieties = extractBeerVarietiesFromIntake({
      pages: [
        {
          pageUrl: "https://www.augustiner-braeu.de/unser-bier/",
          title: "Unser Bier",
          textBlocks: [],
          textExcerpt: "",
          imageCandidates: [
            {
              url: "https://www.augustiner-braeu.de/fileadmin/_processed_/b/4/csm_Augustiner-pils_ce71e2324b.jpg",
              alt: "",
              score: 56,
              productScore: 56,
              lifestyleScore: 40,
            },
          ],
        },
      ],
      downloadedImages: [],
      imageCandidates: [
        {
          url: "https://www.augustiner-braeu.de/fileadmin/_processed_/b/4/csm_Augustiner-pils_ce71e2324b.jpg",
          alt: "",
          score: 56,
          productScore: 56,
          lifestyleScore: 40,
        },
      ],
      breweryName: "Augustiner-Bräu München",
    });

    expect(varieties.some((beer) => /pils/i.test(beer.name) && beer.etikettUrl.includes("Augustiner-pils"))).toBe(true);
  });

  it("backfills etikett on existing beers with matching names", () => {
    const merged = mergeSuggestedBeers(
      [{ id: "beer-1", name: "Augustiner Pils", bierstil: "pils", flaschenTyp: "nrw_500", flaschenfarbe: "braun", etikettUrl: "", createdAt: "" }],
      [
        {
          name: "Augustiner Pils",
          bierstil: "pils",
          flaschenTyp: "nrw_500",
          flaschenfarbe: "braun",
          glasTyp: "pils_tulpe",
          etikettUrl: "https://example.com/pils.jpg",
        },
      ],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]?.etikettUrl).toBe("https://example.com/pils.jpg");
  });

  it("matches generic WordPress product filenames and alt text to beer names", () => {
    const html = `
      <h2>Da Helles</h2>
      <img src="/wp-content/uploads/da-helles-flasche.jpg" alt="Da Helles Flasche" />
      <h2>Da Pils</h2>
      <img src="/wp-content/uploads/da-pils.jpg" alt="Da Pils" />
    `;
    const varieties = extractBeerVarietiesFromIntake({
      pages: [
        {
          pageUrl: "https://brauerei-beispiel.de/biere/",
          title: "Biere",
          textBlocks: [],
          textExcerpt: "",
          imageCandidates: [],
        },
      ],
      downloadedImages: [],
      breweryName: "Brauerei Beispiel",
      rawHtmlByUrl: { "https://brauerei-beispiel.de/biere/": html },
    });

    const byName = Object.fromEntries(varieties.map((beer) => [beer.name, beer.etikettUrl]));
    expect(byName["Da Helles"]).toContain("da-helles-flasche");
    expect(byName["Da Pils"]).toContain("da-pils");
  });

  it("merges suggested beers without duplicating existing names", () => {
    const merged = mergeSuggestedBeers(
      [{ id: "beer-1", name: "Augustiner Pils", bierstil: "pils", flaschenTyp: "nrw_500", flaschenfarbe: "braun", etikettUrl: "", createdAt: "" }],
      [
        {
          name: "Augustiner Pils",
          bierstil: "pils",
          flaschenTyp: "nrw_500",
          flaschenfarbe: "braun",
          glasTyp: "pils_tulpe",
          etikettUrl: "https://example.com/pils.jpg",
        },
        {
          name: "Augustiner Dunkel",
          bierstil: "helles",
          flaschenTyp: "nrw_500",
          flaschenfarbe: "braun",
          glasTyp: "willibecher",
          etikettUrl: "https://example.com/dunkel.jpg",
        },
      ],
    );

    expect(merged).toHaveLength(2);
    expect(merged.some((beer) => beer.name === "Augustiner Dunkel")).toBe(true);
  });

  it("suggestedBeersToDashboard replaces instead of keeping foreign brands", () => {
    const replaced = suggestedBeersToDashboard([
      {
        name: "Lang Bräu Helles",
        bierstil: "helles",
        flaschenTyp: "nrw_500",
        flaschenfarbe: "braun",
        glasTyp: "willibecher",
        etikettUrl: "https://langbraeu.de/helles.jpg",
      },
    ]);

    expect(replaced).toHaveLength(1);
    expect(replaced[0]?.name).toBe("Lang Bräu Helles");
  });

  it("replaceSuggestedBeers drops foreign brands but keeps matching etikett", () => {
    const replaced = replaceSuggestedBeers(
      [
        {
          id: "beer-abk",
          name: "Abk Beer",
          bierstil: "helles",
          flaschenTyp: "nrw_500",
          flaschenfarbe: "braun",
          etikettUrl: "https://abk.example/abk.jpg",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "beer-lang",
          name: "Lang Bräu Helles",
          bierstil: "helles",
          flaschenTyp: "nrw_500",
          flaschenfarbe: "braun",
          etikettUrl: "https://lang.example/helles.jpg",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      [
        {
          name: "Lang Bräu Helles",
          bierstil: "helles",
          flaschenTyp: "nrw_500",
          flaschenfarbe: "braun",
          glasTyp: "willibecher",
          etikettUrl: "",
        },
        {
          name: "Lang Bräu Pils",
          bierstil: "pils",
          flaschenTyp: "nrw_500",
          flaschenfarbe: "braun",
          glasTyp: "pils_tulpe",
          etikettUrl: "https://lang.example/pils.jpg",
        },
      ],
    );

    expect(replaced.map((beer) => beer.name)).toEqual(["Lang Bräu Helles", "Lang Bräu Pils"]);
    expect(replaced[0]?.id).toBe("beer-lang");
    expect(replaced[0]?.etikettUrl).toBe("https://lang.example/helles.jpg");
    expect(replaced.some((beer) => beer.name === "Abk Beer")).toBe(false);
  });
});
