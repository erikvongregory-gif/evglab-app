import { describe, expect, it } from "vitest";
import { assessBrandAnalysisFields, computeAnalysisConfidence, parseScanJson } from "@/lib/brand/brand-analysis";

describe("brand-analysis", () => {
  it("parses JSON with optional code fences", () => {
    const raw = `\`\`\`json
{"breweryName":"Lang Bräu","brandTone":"Traditionell","brandColors":"Bernstein","brandDos":"Logo sichtbar","brandDonts":"Keine Neonfarben"}
\`\`\``;
    expect(parseScanJson(raw)).toEqual({
      breweryName: "Lang Bräu",
      brandTone: "Traditionell",
      brandColors: "Bernstein",
      brandDos: "Logo sichtbar",
      brandDonts: "Keine Neonfarben",
    });
  });

  it("returns null for incomplete JSON", () => {
    expect(parseScanJson('{"breweryName":"X"}')).toBeNull();
  });

  it("computes confidence from text and images", () => {
    expect(computeAnalysisConfidence({ textExcerpt: "x".repeat(500), imageCount: 3 })).toBe("high");
    expect(computeAnalysisConfidence({ textExcerpt: "Kurzer Text", imageCount: 1 })).toBe("medium");
    expect(computeAnalysisConfidence({ textExcerpt: "", imageCount: 0 })).toBe("low");
  });

  it("assesses confidence per field with review hints", () => {
    const assessment = assessBrandAnalysisFields({
      scan: {
        breweryName: "Lang Bräu",
        brandTone: "Traditionell",
        brandColors: "#E8772E, #6B4423",
        brandDos: "Warmes Licht.",
        brandDonts: "Kein Neon.",
      },
      textExcerpt: "Willkommen bei Lang Bräu. ".repeat(20),
      imageCount: 2,
      sceneCount: 0,
      packshotCount: 0,
      beersDetected: 0,
    });
    expect(assessment.fields.find((field) => field.field === "breweryName")?.level).toBe("high");
    expect(assessment.fields.find((field) => field.field === "brandColors")?.needsReview).toBe(true);
    expect(assessment.reviewHints.some((hint) => /Referenzbilder|Packshot|Sorten|Farben/i.test(hint))).toBe(true);
  });
});
