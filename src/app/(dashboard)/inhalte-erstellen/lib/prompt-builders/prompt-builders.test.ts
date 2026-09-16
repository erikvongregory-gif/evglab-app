import { describe, expect, it } from "vitest";
import { buildCampaignTextPrompt } from "./campaign-text";
import { buildHyperrealisticPrompt, buildProductPlacementPrompt, applyClientIntentOverrides } from "./hyperrealistic";
import { buildProductIsolatePrompt } from "./product-isolate";
import { DEFAULT_GLAS_BY_STIL, buildProductStudioPrompt, resolveStudioGlas } from "./product-studio";
import { campaignTextSchema, hyperrealisticSchema, productIsolateSchema, productStudioSchema } from "../schemas";
import { applyContentPresetPrompt } from "@/lib/image-types/policy";

describe("inhalte-erstellen prompt builders", () => {
  it("activates the reusable Hyperreal prompt lock", () => {
    const prompt = applyContentPresetPrompt("A beer in a garden.", "hyperreal");
    expect(prompt).toContain("Preset lock (NON-NEGOTIABLE): Hyperreal Motif");
    expect(prompt).toContain("real commercial beverage photography");
    expect(prompt).toContain("85mm lens, f/5.6, ISO 100, 1/160 s");
    expect(prompt).toContain("physically correct refraction");
    expect(prompt).toContain("Strictly forbid illustration");
    expect(prompt).toContain("film grain");
  });

  it("builds a hyperrealistic prompt snapshot", () => {
    expect(
      buildHyperrealisticPrompt({
        aiWatermark: false, etikettBild: "https://example.com/etikett.png",
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
      aiWatermark: false, stimmung: "entspannt", etikettBild: "https://example.com/etikett.png",
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
      stiltreue: "hoch",
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
    expect(prompt).toMatch(/PRODUCT INTEGRATION — CRITICAL/);
    expect(prompt).toMatch(/NOT as a flat cutout, sticker, pasted layer, or composited object/);
    expect(prompt).toMatch(/Do NOT preserve the reference image's lighting/);
    expect(prompt).toMatch(/share the SAME camera, lens, focal plane/);
    expect(prompt).not.toMatch(/Keep unchanged from Image 1/i);
    expect(prompt).toMatch(/HYPERREALISM LOCK/);
    expect(prompt).toMatch(/NEGATIVE \(hyperreal\)/);
    expect(prompt).toMatch(/Forbidden/);
    expect(prompt).toMatch(/single pour/);
  });

  it("unterscheidet Stiltreue normal vs hoch beim Label-Lock", () => {
    const hoch = buildProductPlacementPrompt({
      aiWatermark: false,
      stimmung: "entspannt",
      etikettBild: "https://example.com/etikett.png",
      flaschenTyp: "nrw_500",
      flaschenfarbe: "braun",
      bierstil: "helles",
      glasTyp: "willibecher",
      szene: "biergarten_sommer",
      behaelter: "B",
      personImBild: false,
      personenModus: "A",
      tageszeit: "goldene_stunde",
      etikettModus: "marke",
      stiltreue: "hoch",
      aspectRatio: "4:5",
      quality: "medium",
      variantCount: 1,
    });
    const normal = buildProductPlacementPrompt({
      aiWatermark: false,
      stimmung: "entspannt",
      etikettBild: "https://example.com/etikett.png",
      flaschenTyp: "nrw_500",
      flaschenfarbe: "braun",
      bierstil: "helles",
      glasTyp: "willibecher",
      szene: "biergarten_sommer",
      behaelter: "B",
      personImBild: false,
      personenModus: "A",
      tageszeit: "goldene_stunde",
      etikettModus: "marke",
      stiltreue: "normal",
      aspectRatio: "4:5",
      quality: "medium",
      variantCount: 1,
    });
    expect(hoch).toMatch(/entire printed label/);
    expect(normal).toMatch(/faithful reference/);
    expect(normal).not.toMatch(/entire printed label/);
  });

  it("lets free-text intent override biergarten defaults for mountain toasting", () => {
    const next = applyClientIntentOverrides({
      aiWatermark: false, etikettBild: "https://example.com/etikett.png",
      flaschenTyp: "nrw_500",
      flaschenfarbe: "braun",
      bierstil: "helles",
      glasTyp: "willibecher",
      szene: "biergarten_sommer",
      behaelter: "B",
      personImBild: false,
      personenModus: "A",
      tageszeit: "goldene_stunde",
      stimmung: "gesellig",
      zusatzWunsch: "auf dem berg anstoßen",
      aspectRatio: "4:5",
      quality: "medium",
      variantCount: 1,
    });
    expect(next.szene).toBe("alpenpanorama");
    expect(next.personenModus).toBe("E");

    const prompt = buildProductPlacementPrompt(next);
    expect(prompt.startsWith("HYPERREALISM LOCK")).toBe(true);
    expect(prompt).toMatch(/USER SCENE/);
    expect(prompt).toMatch(/auf dem berg anstoßen/);
    expect(prompt).toMatch(/COMPLETELY DISCARD Image 1's background/i);
    expect(prompt).toMatch(/hands holding glasses|mid-clink|Anstoßen/i);
    expect(prompt).toMatch(/floating bottle/i);
    expect(prompt).toMatch(/alpine mountain/i);
    expect(prompt).toMatch(/NEGATIVE \(hyperreal\)/);
  });

  it("maps brewery toasting freitext to brauereihof with people", () => {
    const next = applyClientIntentOverrides({
      aiWatermark: false, etikettBild: "https://example.com/etikett.png",
      flaschenTyp: "nrw_500",
      flaschenfarbe: "braun",
      bierstil: "helles",
      glasTyp: "willibecher",
      szene: "biergarten_sommer",
      behaelter: "B",
      personImBild: false,
      personenModus: "A",
      tageszeit: "goldene_stunde",
      stimmung: "gesellig",
      zusatzWunsch: "in der brauerei wird angestoßen",
      aspectRatio: "4:5",
      quality: "medium",
      variantCount: 1,
    });
    expect(next.szene).toBe("brauereihof");
    expect(next.personenModus).toBe("E");
    const prompt = buildProductPlacementPrompt(next);
    expect(prompt).toMatch(/hands holding glasses|Anstoßen/i);
    expect(prompt).not.toMatch(/No people and no hands/);
  });

  it("maps laughing brewer freitext to person hero + brewery scene", () => {
    const next = applyClientIntentOverrides({
      aiWatermark: false, etikettBild: "https://example.com/etikett.png",
      flaschenTyp: "nrw_500",
      flaschenfarbe: "braun",
      bierstil: "helles",
      glasTyp: "willibecher",
      szene: "biergarten_sommer",
      behaelter: "B",
      personImBild: false,
      personenModus: "A",
      tageszeit: "goldene_stunde",
      stimmung: "gesellig",
      zusatzWunsch: "brauer lacht sich schlapp über neues bier",
      aspectRatio: "4:5",
      quality: "medium",
      variantCount: 1,
    });
    expect(next.szene).toBe("brauereihof");
    expect(next.personenModus).toBe("D");
    expect(next.personImBild).toBe(true);

    const prompt = buildProductPlacementPrompt(next);
    expect(prompt).toMatch(/HERO PERSON|PEOPLE FROM USER SCENE|laughing|mandatory/i);
    expect(prompt).toMatch(/brauer lacht sich schlapp/i);
    expect(prompt).toMatch(/lonely bottle\+glass|still life|empty product table|omitting the people/i);
  });

  it("forces two older Bavarians into the prompt instead of No-people packshot", () => {
    const next = applyClientIntentOverrides({
      aiWatermark: false, etikettBild: "https://example.com/etikett.png",
      flaschenTyp: "nrw_500",
      flaschenfarbe: "braun",
      bierstil: "helles",
      glasTyp: "willibecher",
      szene: "biergarten_sommer",
      behaelter: "B",
      personImBild: false,
      personenModus: "A",
      tageszeit: "goldene_stunde",
      stimmung: "gesellig",
      zusatzWunsch: "zwei alte urbayer trinken gemütlich auf einer parkbank am marienplatz in münchen ihr bier",
      aspectRatio: "4:5",
      quality: "medium",
      variantCount: 1,
    });
    expect(next.personenModus).toBe("E");
    expect(next.personImBild).toBe(true);
    expect(next.gruppenAnzahl).toBe("2");
    expect(next.personAlter).toBe("aelter");

    const prompt = buildProductPlacementPrompt(next);
    expect(prompt).toMatch(/PEOPLE FROM USER SCENE|mandatory/i);
    expect(prompt).toMatch(/zwei alte urbayer/i);
    expect(prompt).not.toMatch(/No people and no hands/);
    expect(prompt).toMatch(/omitting the people|empty product table|lonely bottle/i);
  });

  it("never emits hard No-people when freitext exists even for unknown synonyms", () => {
    const prompt = buildProductPlacementPrompt({
      aiWatermark: false, etikettBild: "https://example.com/etikett.png",
      flaschenTyp: "nrw_500",
      flaschenfarbe: "braun",
      bierstil: "helles",
      glasTyp: "willibecher",
      szene: "biergarten_sommer",
      behaelter: "B",
      personImBild: false,
      personenModus: "A",
      tageszeit: "goldene_stunde",
      stimmung: "gesellig",
      zusatzWunsch: "stammtischveteranen genießen ihr helles am rathausplatz",
      aspectRatio: "4:5",
      quality: "medium",
      variantCount: 1,
    });
    expect(prompt).toMatch(/Follow USER SCENE for people/i);
    expect(prompt).toMatch(/stammtischveteranen/i);
    expect(prompt).not.toMatch(/No people and no hands/);
  });

  it("haelt das Glas auf Flaschenvolumen (kein 0,5-l-Krug neben 0,33 l)", () => {
    const prompt = buildProductPlacementPrompt({
      aiWatermark: false, stimmung: "entspannt", etikettBild: "https://example.com/etikett.png",
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
