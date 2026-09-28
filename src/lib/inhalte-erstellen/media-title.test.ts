import { describe, expect, it } from "vitest";
import {
  actionLabelFromIntent,
  buildStudioMediaPrompt,
  buildStudioMediaTitle,
} from "./media-title";

describe("buildStudioMediaTitle", () => {
  it("verdrahtet Einschenken + Glas statt Default-Biergarten", () => {
    expect(
      buildStudioMediaTitle({
        beerName: "Hanseat",
        bierstil: "helles",
        szene: "biergarten_sommer",
        glasTyp: "willibecher",
        behaelter: "B",
        flaschenTyp: "euro_longneck_330",
        zusatzWunsch: "hanseat wird ins glas eingeschenkt naturtrüb",
      }),
    ).toBe("Hanseat · Einschenken · Willibecher");
  });

  it("behält Ort, wenn Freitext ihn nennt", () => {
    expect(
      buildStudioMediaTitle({
        beerName: "Helles",
        bierstil: "helles",
        szene: "biergarten_sommer",
        glasTyp: "willibecher",
        behaelter: "B",
        zusatzWunsch: "auf dem berg anstoßen",
      }),
    ).toBe("Helles · Anstoßen · Willibecher · Alpenpanorama");
  });

  it("nutzt Preset-Szene ohne Freitext", () => {
    expect(
      buildStudioMediaTitle({
        beerName: "Pils",
        bierstil: "pils",
        szene: "wirtshaus_innen",
        glasTyp: "pils_tulpe",
        behaelter: "G",
      }),
    ).toBe("Pils · Pilstulpe · Wirtshaus");
  });
});

describe("actionLabelFromIntent", () => {
  it("erkennt Einschenken und Anstoßen", () => {
    expect(actionLabelFromIntent("wird eingeschenkt")).toBe("Einschenken");
    expect(actionLabelFromIntent("Prost anstoßen")).toBe("Anstoßen");
  });
});

describe("buildStudioMediaPrompt", () => {
  it("speichert den User-Freitext", () => {
    expect(
      buildStudioMediaPrompt({
        zusatzWunsch: "hanseat wird ins glas eingeschenkt naturtrüb",
        fallbackTitle: "Hanseat · Willibecher",
      }),
    ).toBe("hanseat wird ins glas eingeschenkt naturtrüb");
  });
});
