import { describe, expect, it } from "vitest";
import { calculateGenerationTokenCost, calculatePerVariantTokenCost, calculateSeedanceVideoTokenCost, estimateStudioImageTokenCost, resolveImageBillingResolution } from "./generationTokenCost";

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

  it("Studio-Vorschau entspricht Server-Kosten mit Produktfoto", () => {
    expect(
      estimateStudioImageTokenCost({
        usesProductPhoto: true,
        etikettModus: "marke",
        variantCount: 3,
      }),
    ).toBe(105);
    expect(
      estimateStudioImageTokenCost({
        usesProductPhoto: false,
        extraReferenceCount: 2,
        etikettModus: "generisch",
        variantCount: 1,
      }),
    ).toBe(15);
  });

  it("berücksichtigt Qualitäts-Env und Request-Qualität ohne Produktfoto", () => {
    expect(
      resolveImageBillingResolution({
        hasProductPhoto: false,
        qualityEnv: "high",
      }),
    ).toBe("2K");
    expect(
      resolveImageBillingResolution({
        hasProductPhoto: true,
        qualityEnv: "low",
      }),
    ).toBe("1K");
    expect(
      estimateStudioImageTokenCost({
        usesProductPhoto: false,
        hasShapeReference: true,
        etikettModus: "generisch",
        variantCount: 1,
        qualityEnv: "high",
      }),
    ).toBe(25);
    expect(
      estimateStudioImageTokenCost({
        usesProductPhoto: false,
        etikettModus: "generisch",
        variantCount: 1,
        requestedQuality: "high",
      }),
    ).toBe(20);
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

  it("Client-Vorschau medium entspricht Request-Qualitaet ohne Produktfoto", () => {
    expect(
      estimateStudioImageTokenCost({
        usesProductPhoto: false,
        etikettModus: "generisch",
        variantCount: 1,
        requestedQuality: "medium",
      }),
    ).toBe(
      calculateGenerationTokenCost({
        resolution: resolveImageBillingResolution({
          hasProductPhoto: false,
          compiledOrRequestedQuality: "medium",
        }),
        hasReferenceImage: false,
        strictLabelMode: false,
        variantCount: 1,
      }),
    );
  });
});
