import { describe, expect, it } from "vitest";
import type { HyperrealisticInput } from "../schemas";
import {
  enforceHyperrealisticPromptConstraints,
  shouldUseImageReferenceForGeneration,
} from "./enforce-prompt-constraints";
import { buildHyperrealisticPrompt } from "./hyperrealistic";

const baseInput: HyperrealisticInput = {
  etikettBild: "https://example.com/label.png",
  flaschenTyp: "nrw_500",
  flaschenfarbe: "braun",
  bierstil: "hefeweizen",
  glasTyp: "weizen",
  szene: "biergarten_sommer",
  behaelter: "G",
  personenModus: "E",
  gruppenAnzahl: "3",
  gruppenTyp: "gemischt",
  gruppenDynamik: "E3",
  tageszeit: "goldene_stunde",
  stimmungTrend: "aktiv",
  stimmung: "gesellig",
  etikettModus: "marke",
  aspectRatio: "9:16",
  quality: "high",
};

describe("enforceHyperrealisticPromptConstraints", () => {
  it("appends glass-only lock when behaelter is G", () => {
    const out = enforceHyperrealisticPromptConstraints("A group with beer bottles on the table.", baseInput, "Paulaner");
    expect(out).toMatch(/GLASS-ONLY/i);
    expect(out).toMatch(/INVALID if any bottle/i);
    expect(out).toMatch(/Paulaner/i);
  });

  it("skips image reference for glass-only generation", () => {
    expect(shouldUseImageReferenceForGeneration(baseInput)).toBe(false);
    expect(shouldUseImageReferenceForGeneration({ ...baseInput, behaelter: "B" })).toBe(true);
  });
});

describe("buildHyperrealisticPrompt glass-only", () => {
  it("does not describe a bottle in the subject when behaelter is G", () => {
    const prompt = buildHyperrealisticPrompt(baseInput, { breweryName: "Paulaner" });
    expect(prompt).not.toMatch(/A amber-brown.* bottle\. The label/i);
    expect(prompt).toMatch(/ONLY the glass, absolutely NO bottle/);
    expect(prompt).toMatch(/EXACT TEXT on the glass: "Paulaner"/);
    expect(prompt).toMatch(/beer bottle, bottle on table/i);
  });

  it("uses glasses not bottles in group E4 when behaelter is G", () => {
    const prompt = buildHyperrealisticPrompt(
      { ...baseInput, gruppenDynamik: "E4" },
      { breweryName: "Paulaner" },
    );
    expect(prompt).not.toMatch(/holding beer bottles/i);
    expect(prompt).toMatch(/branded beer glasses/i);
  });

  it("uses public viewing schauplatz for group mode instead of legacy biergarten setting", () => {
    const prompt = buildHyperrealisticPrompt(
      {
        ...baseInput,
        szene: "fussball_public_viewing",
        gruppenSetting: "biergarten",
        gruppenDynamik: "E3",
      },
      { breweryName: "Paulaner" },
    );
    expect(prompt).toMatch(/football public viewing|public viewing party/i);
    expect(prompt).not.toMatch(/in a traditional Biergarten/i);
    expect(prompt).not.toMatch(/rustic wooden table/i);
    expect(prompt).toMatch(/SCENE:.*public viewing/i);
  });
});
