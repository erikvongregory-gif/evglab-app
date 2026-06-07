import { describe, expect, it } from "vitest";
import { buildCampaignTextPrompt } from "./campaign-text";
import { buildHyperrealisticPrompt } from "./hyperrealistic";
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
        personBeschreibung: "Mann ca. 40, Bart, lacht",
        tageszeit: "goldene_stunde",
        stimmung: "gesellig",
        zusatzWunsch: "Dezente Hopfenranken im Vordergrund.",
        aspectRatio: "4:5",
        quality: "high",
      }),
    ).toMatchSnapshot();
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
