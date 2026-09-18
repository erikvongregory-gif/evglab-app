import { beerStyleLabel } from "@/app/(dashboard)/inhalte-erstellen/lib/beer-styles";
import { GLAS_TYPEN } from "@/app/(dashboard)/inhalte-erstellen/lib/brewing-knowledge";
import type { HyperrealisticInput } from "@/app/(dashboard)/inhalte-erstellen/lib/schemas";

const SCENE_LABELS: Record<HyperrealisticInput["szene"], string> = {
  biergarten_sommer: "Biergarten",
  wirtshaus_innen: "Wirtshaus",
  kueche_zuhause: "Holztisch",
  wiese_picknick: "Picknick",
  strand_sonnenuntergang: "Strand",
  alpenpanorama: "Alpenpanorama",
  stadtbalkon_abend: "Stadtbalkon",
  brauereihof: "Brauereihof",
  fussball_public_viewing: "Public Viewing",
};

export type StudioMediaTitleInput = {
  mode?: "produktfoto" | "social";
  beerName?: string | null;
  bierstil?: string | null;
  szene?: HyperrealisticInput["szene"] | string | null;
  glasTyp?: HyperrealisticInput["glasTyp"] | string | null;
  behaelter?: HyperrealisticInput["behaelter"] | string | null;
  flaschenTyp?: HyperrealisticInput["flaschenTyp"] | string | null;
  characterName?: string | null;
  headline?: string | null;
  breweryName?: string | null;
};

function vesselLabel(input: StudioMediaTitleInput): string | null {
  const glas =
    input.glasTyp && input.glasTyp in GLAS_TYPEN
      ? GLAS_TYPEN[input.glasTyp as keyof typeof GLAS_TYPEN].label
      : null;
  const behaelter = input.behaelter ?? (glas ? "B" : "F");
  if (behaelter === "G") return glas;
  if (behaelter === "B") return glas;
  if (input.flaschenTyp === "dose_330" || input.flaschenTyp === "dose_500") return "Dose";
  return "Flasche";
}

/** Kurztitel aus Bildkontext (Produkt · Gefäß · Szene) — nie der Roh-Prompt. */
export function buildStudioMediaTitle(input: StudioMediaTitleInput): string {
  const product =
    input.beerName?.trim() ||
    (input.bierstil?.trim() ? beerStyleLabel(input.bierstil.trim()) : "") ||
    input.breweryName?.trim() ||
    "";

  if (input.mode === "social") {
    const headline = input.headline?.trim();
    return [product || "Social", headline].filter(Boolean).join(" · ").slice(0, 120) || "Social-Motiv";
  }

  const scene =
    input.szene && input.szene in SCENE_LABELS
      ? SCENE_LABELS[input.szene as HyperrealisticInput["szene"]]
      : null;
  const character = input.characterName?.trim() || null;
  const parts = [product, vesselLabel(input), scene, character].filter(Boolean);
  return parts.join(" · ").slice(0, 120) || "Motiv";
}
