import { describe, expect, it } from "vitest";
import { computeAnalysisConfidence, parseScanJson } from "@/lib/brand/brand-analysis";

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
});
