import { describe, expect, it } from "vitest";
import { loadCampaignStyleReferences } from "./campaignStyleReferences";
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

describe("campaign style references", () => {
  it("loads two bundled look references only for campaign mode", async () => {
    const references = await loadCampaignStyleReferences(
      { ...baseInput, photoStyle: "campaign", zusatzWunsch: "Dose wird eingeschenkt" },
      2,
    );
    expect(references).toHaveLength(2);
    expect(references.every((reference) => reference.mime === "image/png" || reference.mime === "image/jpeg")).toBe(true);
    expect(references.every((reference) => reference.base64.length > 10_000)).toBe(true);
  });

  it("does not attach the library to reportage or premium images", async () => {
    await expect(loadCampaignStyleReferences({ ...baseInput, photoStyle: "reportage" }, 2)).resolves.toEqual([]);
    await expect(loadCampaignStyleReferences({ ...baseInput, photoStyle: "premium" }, 2)).resolves.toEqual([]);
  });
});

