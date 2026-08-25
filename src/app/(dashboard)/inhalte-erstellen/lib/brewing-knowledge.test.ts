import { describe, expect, it } from "vitest";
import {
  flascheVolumeMl,
  glassPourPromptDescription,
  pouredGlassFillMl,
} from "./brewing-knowledge";

describe("poured glass vs bottle volume", () => {
  it("liest Gebindevolumen aus dem Flaschencode", () => {
    expect(flascheVolumeMl("euro_longneck_330")).toBe(330);
    expect(flascheVolumeMl("nrw_500")).toBe(500);
    expect(flascheVolumeMl("buegel_750")).toBe(750);
    expect(flascheVolumeMl("dose_330")).toBe(330);
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
