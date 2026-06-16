import { describe, expect, it } from "vitest";
import { calculateGenerationTokenCost, calculatePerVariantTokenCost, calculateSeedanceVideoTokenCost } from "./generationTokenCost";

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

  it("Standard-Video Seedance 720p 8s = 90 Tokens", () => {
    expect(
      calculateSeedanceVideoTokenCost({
        resolution: "720p",
        duration: 8,
        generateAudio: false,
      }),
    ).toBe(90);
  });

  it("längeres Video addiert Dauer-Aufschlag", () => {
    expect(
      calculateSeedanceVideoTokenCost({
        resolution: "720p",
        duration: 12,
        generateAudio: false,
      }),
    ).toBe(106);
  });
});
