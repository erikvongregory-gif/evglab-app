import { describe, expect, it } from "vitest";
import {
  extractBeerVarietiesFromIntake,
  humanizeBeerSlug,
  inferBierstilFromName,
  mergeSuggestedBeers,
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
        catalogImage(
          "https://www.augustiner-braeu.de/fileadmin/_processed_/5/4/csm_Augustiner-alkoholfrei_60650aa974.jpg",
        ),
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
});
