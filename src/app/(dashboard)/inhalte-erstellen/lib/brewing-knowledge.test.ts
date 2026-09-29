import { describe, expect, it } from "vitest";
import {
  DEFAULT_FLASCHE,
  FLASCHEN_NACH_KATEGORIE,
  FLASCHEN_TYPEN,
  flascheForKategorie,
  flascheVolumeMl,
  flaschenGruppen,
  glassPourPromptDescription,
  pouredGlassFillMl,
} from "./brewing-knowledge";
import { flaschenTypSchema } from "./schemas";

describe("poured glass vs bottle volume", () => {
  it("liest Gebindevolumen aus dem Flaschencode", () => {
    expect(flascheVolumeMl("euro_longneck_330")).toBe(330);
    expect(flascheVolumeMl("nrw_500")).toBe(500);
    expect(flascheVolumeMl("buegel_750")).toBe(750);
    expect(flascheVolumeMl("dose_330")).toBe(330);
    expect(flascheVolumeMl("gastro_250")).toBe(250);
    expect(flascheVolumeMl("perle_700")).toBe(700);
    expect(flascheVolumeMl("glas_1000")).toBe(1000);
    expect(flascheVolumeMl("pet_1500")).toBe(1500);
  });

  it("zeigt je Getränkeart nur passende Gebinde", () => {
    expect(FLASCHEN_NACH_KATEGORIE.bier).toContain("nrw_500");
    expect(FLASCHEN_NACH_KATEGORIE.bier).not.toContain("perle_700");
    expect(FLASCHEN_NACH_KATEGORIE.limonade).toEqual(
      expect.arrayContaining(["euro_longneck_330", "pet_1000", "pet_1500", "perle_700"]),
    );
    expect(FLASCHEN_NACH_KATEGORIE.limonade).not.toContain("nrw_500");
    expect(FLASCHEN_NACH_KATEGORIE.limonade).not.toContain("brunnen_750");
    expect(FLASCHEN_NACH_KATEGORIE.mineralwasser).toEqual(
      expect.arrayContaining(["perle_700", "brunnen_750", "pet_1000"]),
    );
    expect(FLASCHEN_NACH_KATEGORIE.mineralwasser).not.toContain("euro_longneck_330");
    expect(FLASCHEN_NACH_KATEGORIE.tafelwasser).toContain("pet_1500");
    expect(FLASCHEN_NACH_KATEGORIE.tafelwasser).not.toContain("perle_700");
    expect(FLASCHEN_NACH_KATEGORIE.tafelwasser).not.toContain("brunnen_750");
    for (const kategorie of ["bier", "limonade", "tafelwasser", "mineralwasser"] as const) {
      expect(FLASCHEN_NACH_KATEGORIE[kategorie]).toContain(DEFAULT_FLASCHE[kategorie]);
      expect(flascheForKategorie(kategorie, "nrw_500")).toBe(
        kategorie === "bier" ? "nrw_500" : DEFAULT_FLASCHE[kategorie],
      );
    }
    expect(flaschenGruppen("mineralwasser").map((group) => group.volume)).toEqual([
      "0,25 l",
      "0,5 l",
      "0,7 l",
      "0,75 l",
      "1,0 l",
      "1,5 l",
    ]);
    for (const code of Object.keys(FLASCHEN_TYPEN)) {
      expect(flaschenTypSchema.safeParse(code).success).toBe(true);
    }
  });

  it("kapppt das Glas auf die Flasche, wenn beides im Bild ist", () => {
    expect(pouredGlassFillMl("masskrug", "euro_longneck_330", "B")).toBe(330);
    expect(pouredGlassFillMl("willibecher", "euro_longneck_330", "B")).toBe(330);
    expect(pouredGlassFillMl("weizen", "vichy_330", "B")).toBe(330);
    expect(pouredGlassFillMl("masskrug", "nrw_500", "B")).toBe(500);
    expect(pouredGlassFillMl("masskrug", "nrw_500", "G")).toBe(1000);
  });

  it("verbietet 0,5-l-Krug neben 0,33-l-Flasche", () => {
    const text = glassPourPromptDescription("masskrug", 330);
    expect(text).toMatch(/0\.3 litre/);
    expect(text).toMatch(/NOT a 0\.5 litre/);
    expect(text).not.toMatch(/1-liter glass Maßkrug/);
  });
});
