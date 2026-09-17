import { describe, expect, it } from "vitest";
import type { DashboardBeer, DashboardCharacter } from "@/lib/dashboard/metadata";
import {
  beersRevision,
  characterImageUrls,
  derivedBeerFields,
  effectiveAspectRatio,
  extraRefCapacity,
  productImageUrl,
  resolveLabelIntent,
  selectedBeerFromId,
  snapshotFromPayload,
  suggestionIsCurrent,
  validateStudioRequest,
} from "./studio-config";
import type { HyperrealisticInput } from "@/app/(dashboard)/inhalte-erstellen/lib/schemas";

const beerA: DashboardBeer = {
  id: "a",
  name: "Helles",
  bierstil: "helles",
  flaschenTyp: "nrw_500",
  flaschenfarbe: "braun",
  glasTyp: "willibecher",
  etikettUrl: "https://cdn.example/helles.png",
  createdAt: "",
};

const beerB: DashboardBeer = {
  ...beerA,
  id: "b",
  name: "Pils",
  bierstil: "pils",
  flaschenTyp: "euro_longneck_330",
  etikettUrl: "https://cdn.example/pils.png",
};

const character: DashboardCharacter = {
  id: "char-1",
  name: "Marta",
  role: "Braumeisterin",
  referenceImageUrls: ["https://cdn.example/marta.jpg"],
  appearanceLock: "short brown hair",
  createdAt: "",
};

const baseDraft = {
  keepLabel: true,
  applyBrandLook: true,
  labelFidelity: "hoch" as const,
  selectedBeerId: "a",
  selectedCharacterId: null as string | null,
  extraReferences: [] as Array<{ name: string; dataUrl: string; role: "scene" | "look" }>,
  aspectRatio: "16:9" as const,
  headline: "",
  userPrompt: "Flasche auf dem Holztisch",
  presetId: null as string | null,
};

const workspace = {
  beers: [beerA, beerB],
  characters: [character],
  brandLabelUrl: "https://cdn.example/brand.png",
  profileMode: "guided" as const,
  profileComplete: true,
};

describe("beersRevision", () => {
  it("changes when a second tab added a beer", () => {
    expect(beersRevision([beerA, beerB])).not.toBe(beersRevision([beerA]));
  });

  it("ignores signed-url churn", () => {
    const first = beersRevision([beerA]);
    const rotated = { ...beerA, etikettUrl: "https://cdn.example/helles.png?token=new" };
    expect(beersRevision([rotated])).toBe(first);
  });

  it("changes when drink category changes", () => {
    expect(beersRevision([{ ...beerA, produktKategorie: "limonade" }])).not.toBe(beersRevision([beerA]));
  });
});

describe("selected beer derivation", () => {
  it("keeps the chosen id and picks up updated bottle fields", () => {
    const selected = selectedBeerFromId([beerA, { ...beerB, flaschenTyp: "dose_500" }], "b");
    expect(selected?.name).toBe("Pils");
    const fields = derivedBeerFields(selected, {}, {
      bierstil: "helles",
      flaschenTyp: "nrw_500",
      flaschenfarbe: "braun",
      glasTyp: "willibecher",
    });
    expect(fields.flaschenTyp).toBe("dose_500");
    expect(fields.bierstil).toBe("pils");
  });

  it("uses the current brand photo when no beer is selected", () => {
    expect(productImageUrl(null, "https://cdn.example/new-brand.png")).toBe("https://cdn.example/new-brand.png");
  });
});

describe("format and references", () => {
  it("uses the same effective format for character as the stored snapshot", () => {
    const aspect = effectiveAspectRatio("16:9", true);
    expect(aspect).toBe("4:5");
    const payload = {
      etikettBild: "https://cdn.example/helles.png",
      flaschenTyp: "nrw_500",
      flaschenfarbe: "braun",
      bierstil: "helles",
      szene: "biergarten_sommer",
      tageszeit: "goldene_stunde",
      stimmung: "gesellig",
      aspectRatio: "16:9",
      quality: "medium",
      variantCount: 1,
      keepLabel: true,
      characterName: "Marta",
    } as HyperrealisticInput;
    const snapshot = snapshotFromPayload({
      mode: "produktfoto",
      payload,
      beerId: "a",
      characterId: "char-1",
      extraRoles: [{ role: "scene", label: "Biergarten" }],
      beerName: "Helles",
      characterName: "Marta",
    });
    expect(snapshot.aspectRatio).toBe("4:5");
    expect(snapshot.payload.aspectRatio).toBe("4:5");
    expect(snapshot.outputDimensions.width / snapshot.outputDimensions.height).toBeCloseTo(4 / 5, 2);
  });

  it("counts character extras against the model budget instead of dropping them", () => {
    expect(extraRefCapacity(1, true)).toBe(2);
    expect(extraRefCapacity(3, true)).toBe(0);
    const result = validateStudioRequest({
      mode: "produktfoto",
      draft: {
        ...baseDraft,
        selectedCharacterId: "char-1",
        aspectRatio: "4:5",
        extraReferences: [
          { name: "Garten", dataUrl: "data:image/png;base64,aaa", role: "scene" },
          { name: "Look", dataUrl: "data:image/png;base64,bbb", role: "look" },
          { name: "Zu viel", dataUrl: "data:image/png;base64,ccc", role: "scene" },
        ],
      },
      workspace,
      productImageReady: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some((issue) => issue.code === "extra_refs_overflow")).toBe(true);
  });

  it("rejects character without a product reference", () => {
    const result = validateStudioRequest({
      mode: "produktfoto",
      draft: { ...baseDraft, keepLabel: false, selectedCharacterId: "char-1", aspectRatio: "4:5" },
      workspace,
      productImageReady: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some((issue) => issue.code === "character_needs_product")).toBe(true);
  });

  it("accepts character plus a scene reference when there is room", () => {
    const result = validateStudioRequest({
      mode: "produktfoto",
      draft: {
        ...baseDraft,
        selectedCharacterId: "char-1",
        aspectRatio: "4:5",
        extraReferences: [{ name: "Biergarten", dataUrl: "data:image/png;base64,aaa", role: "scene" }],
      },
      workspace,
      productImageReady: true,
    });
    expect(result).toEqual({ ok: true });
    expect(characterImageUrls(character)).toHaveLength(1);
  });
});

describe("label vs brand look", () => {
  it("keeps the product lock when brand look is off", () => {
    const resolved = resolveLabelIntent({ keepLabel: true, applyBrandLook: false, stiltreue: "hoch" });
    expect(resolved.etikettModus).toBe("marke");
    expect(resolved.applyBrandLook).toBe(false);
    expect(resolved.keepLabel).toBe(true);
  });
});

describe("late suggestions", () => {
  it("does not apply a stale prompt improvement", () => {
    expect(suggestionIsCurrent(1, 2)).toBe(false);
    expect(suggestionIsCurrent(4, 4)).toBe(true);
  });
});
