import { describe, expect, it } from "vitest";
import { buildCampaignTextPrompt } from "./campaign-text";
import { buildHyperrealisticPrompt, buildProductPlacementPrompt } from "./hyperrealistic";
import { buildProductIsolatePrompt } from "./product-isolate";
import { DEFAULT_GLAS_BY_STIL, buildProductStudioPrompt, resolveStudioGlas } from "./product-studio";
import { campaignTextSchema, hyperrealisticSchema, productIsolateSchema, productStudioSchema } from "../schemas";

describe("inhalte-erstellen prompt builders", () => {
  it("builds a hyperrealistic prompt snapshot", () => {
    expect(
      buildHyperrealisticPrompt({
        etikettBild: "https://example.com/etikett.png",
        flaschenTyp: "nrw_500",
        flaschenfarbe: "braun",
        bierstil: "pils",
        glasTyp: "pils_tulpe",
        szene: "biergarten_sommer",
        personImBild: true,
        tageszeit: "goldene_stunde",
        stimmung: "gesellig",
        zusatzWunsch: "Dezente Hopfenranken im Vordergrund.",
        aspectRatio: "4:5",
        quality: "high",
        variantCount: 3,
      }),
    ).toMatchSnapshot();
  });

  it("places the product photo without describing a brand name for the label", () => {
    const prompt = buildProductPlacementPrompt({
      etikettBild: "https://example.com/etikett.png",
      flaschenTyp: "nrw_500",
      flaschenfarbe: "braun",
      bierstil: "helles",
      glasTyp: "willibecher",
      szene: "stadtbalkon_abend",
      behaelter: "B",
      personImBild: false,
      personenModus: "B",
      tageszeit: "abend_warm",
      etikettModus: "marke",
      beerName: "ABK Hell",
      aspectRatio: "4:5",
      quality: "medium",
      variantCount: 3,
    });
    expect(prompt).toMatch(/Image 1/);
    expect(prompt).toMatch(/entire printed label/);
    expect(prompt).not.toMatch(/ABK/);
    expect(prompt).not.toMatch(/EXACT TEXT/);
    expect(prompt).toMatch(/not an advertisement/i);
    expect(prompt).toMatch(/Kodak Portra 400/);
    expect(prompt).toMatch(/product-preservation/);
    expect(prompt).toMatch(/Forbidden look/i);
    expect(prompt).toMatch(/single pour/);
  });

  it("haelt das Glas auf Flaschenvolumen (kein 0,5-l-Krug neben 0,33 l)", () => {
    const prompt = buildProductPlacementPrompt({
      etikettBild: "https://example.com/etikett.png",
      flaschenTyp: "euro_longneck_330",
      flaschenfarbe: "braun",
      bierstil: "bock",
      glasTyp: "masskrug",
      szene: "wirtshaus_innen",
      behaelter: "B",
      personImBild: false,
      personenModus: "A",
      tageszeit: "abend_warm",
      etikettModus: "marke",
      aspectRatio: "4:5",
      quality: "medium",
      variantCount: 3,
    });
    expect(prompt).toMatch(/0\.3 litre/);
    expect(prompt).toMatch(/NOT a 0\.5 litre/);
    expect(prompt).toMatch(/0\.33 L bottle/);
  });

  it("builds a product isolate prompt snapshot", () => {
    expect(
      buildProductIsolatePrompt({
        inputBild: "https://example.com/flasche.png",
        hintergrund: "transparent",
        schattenErhalten: true,
        outputFormat: "png",
      }),
    ).toMatchSnapshot();
  });

  it("builds a product studio prompt snapshot", () => {
    expect(
      buildProductStudioPrompt({
        referenzBild: "https://example.com/flasche.png",
        bierstil: "hefeweizen",
        hintergrundStil: "naturholz_warm",
        glasNebenFlasche: true,
        lichtStimmung: "weich_diffuse",
        aspectRatio: "1:1",
        quality: "high",
      }),
    ).toMatchSnapshot();
  });

  it("builds a campaign text prompt snapshot", () => {
    expect(
      buildCampaignTextPrompt({
        referenzBilder: [
          "https://example.com/feed-1.png",
          "https://example.com/feed-2.png",
          "https://example.com/feed-3.png",
        ],
        postZiel: "produkt_launch",
        headline: "Frisch eingebraut",
        subline: "Unser neues Helles ist da.",
        ctaText: "Jetzt probieren",
        brauereiName: "Hopfenhof",
        bierstilOderProdukt: "Helles Lager",
        zusatzKontext: "Sommerlich, hell und freundlich.",
        aspectRatio: "4:5",
        quality: "high",
      }),
    ).toMatchSnapshot();
  });
});

describe("studio glass auto mapping", () => {
  it("maps every supported beer style to its expected glass", () => {
    for (const [bierstil, glasTyp] of Object.entries(DEFAULT_GLAS_BY_STIL)) {
      expect(resolveStudioGlas({ bierstil: bierstil as keyof typeof DEFAULT_GLAS_BY_STIL })).toBe(glasTyp);
    }
  });
});

describe("mode schemas", () => {
  it("rejects missing required fields", () => {
    expect(hyperrealisticSchema.safeParse({}).success).toBe(false);
    expect(productIsolateSchema.safeParse({}).success).toBe(false);
    expect(productStudioSchema.safeParse({}).success).toBe(false);
    expect(campaignTextSchema.safeParse({}).success).toBe(false);
  });
});
