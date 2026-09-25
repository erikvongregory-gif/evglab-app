import { describe, expect, it } from "vitest";
import { loadPremiumStyleReferences } from "./premiumStyleReferences";
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

describe("premium style references", () => {
  it("loads bundled hospitality look references only for premium mode", async () => {
    const references = await loadPremiumStyleReferences(
      { ...baseInput, photoStyle: "premium", zusatzWunsch: "Freunde im Biergarten" },
      2,
    );
    expect(references).toHaveLength(2);
    expect(references.every((reference) => reference.mime === "image/png")).toBe(true);
    expect(references.every((reference) => reference.base64.length > 10_000)).toBe(true);
  });

  it("does not attach the library to reportage or campaign images", async () => {
    await expect(loadPremiumStyleReferences({ ...baseInput, photoStyle: "reportage" }, 2)).resolves.toEqual([]);
    await expect(loadPremiumStyleReferences({ ...baseInput, photoStyle: "campaign" }, 2)).resolves.toEqual([]);
  });
});
