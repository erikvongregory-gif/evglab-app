import { describe, expect, it } from "vitest";
import { loadReportageStyleReferences } from "./reportageStyleReferences";
import type { HyperrealisticInput } from "@/app/(dashboard)/inhalte-erstellen/lib/schemas";

const baseInput: HyperrealisticInput = {
  etikettBild: "https://example.com/product.png",
  flaschenTyp: "nrw_500",
  flaschenfarbe: "braun",
  bierstil: "helles",
  szene: "biergarten_sommer",
  personImBild: false,
  personenModus: "A",
  tageszeit: "goldene_stunde",
  stimmung: "entspannt",
  aspectRatio: "4:5",
  quality: "medium",
  variantCount: 1,
  aiWatermark: false,
};

describe("reportage style references", () => {
  it("loads bundled candid look references only for reportage mode", async () => {
    const references = await loadReportageStyleReferences(
      { ...baseInput, photoStyle: "reportage" },
      2,
    );
    expect(references.length).toBeGreaterThan(0);
    expect(references.every((reference) => reference.mime === "image/jpeg")).toBe(true);
  });

  it("does not attach the library to campaign or premium images", async () => {
    await expect(loadReportageStyleReferences({ ...baseInput, photoStyle: "campaign" }, 2)).resolves.toEqual([]);
    await expect(loadReportageStyleReferences({ ...baseInput, photoStyle: "premium" }, 2)).resolves.toEqual([]);
  });
});
