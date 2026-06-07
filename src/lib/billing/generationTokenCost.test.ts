import { describe, expect, it } from "vitest";
import { calculateGenerationTokenCost, calculatePerVariantTokenCost } from "./generationTokenCost";

describe("generationTokenCost", () => {
  it("berechnet 2K + Referenz + Strict pro Variante", () => {
    expect(
      calculatePerVariantTokenCost({
        resolution: "2K",
        hasReferenceImage: true,
        strictLabelMode: true,
      }),
    ).toBe(35);
  });

  it("multipliziert mit Variantenanzahl", () => {
    expect(
      calculateGenerationTokenCost({
        resolution: "2K",
        hasReferenceImage: true,
        strictLabelMode: true,
        variantCount: 3,
      }),
    ).toBe(105);
  });

  it("1K ohne Referenz = 10 Tokens", () => {
    expect(
      calculatePerVariantTokenCost({
        resolution: "1K",
        hasReferenceImage: false,
      }),
    ).toBe(10);
  });
});
