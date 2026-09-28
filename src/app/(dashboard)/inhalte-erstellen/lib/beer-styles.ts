import { GLAS_TYPEN, type GlasTyp } from "@/app/(dashboard)/inhalte-erstellen/lib/brewing-knowledge";
import type { HyperrealisticInput } from "@/app/(dashboard)/inhalte-erstellen/lib/schemas";

/**
 * Bierstil-Katalog — eine Quelle fuer Wizard (WAS_OPTIONS) und "Meine Biere".
 * Der glasTyp bestimmt das stilkorrekte Glas in der Generierung.
 */
export type BeerStyleOption = {
  label: string;
  bierstil: string;
  glasTyp: NonNullable<HyperrealisticInput["glasTyp"]>;
};

export const BEER_STYLE_OPTIONS: BeerStyleOption[] = [
  { label: "Helles", bierstil: "helles", glasTyp: "willibecher" },
  { label: "Pils", bierstil: "pils", glasTyp: "pils_tulpe" },
  { label: "Hefeweizen", bierstil: "hefeweizen", glasTyp: "weizen" },
  { label: "Kristallweizen", bierstil: "kristallweizen", glasTyp: "weizen" },
  { label: "Märzen", bierstil: "maerzen", glasTyp: "masskrug" },
  { label: "Kellerbier", bierstil: "kellerbier", glasTyp: "willibecher" },
  { label: "Bock", bierstil: "bock", glasTyp: "masskrug" },
  { label: "Kölsch", bierstil: "koelsch", glasTyp: "stange" },
  { label: "Altbier", bierstil: "altbier", glasTyp: "stange" },
  { label: "IPA", bierstil: "ipa", glasTyp: "ipa_teku" },
  { label: "NEIPA / Hazy IPA", bierstil: "neipa", glasTyp: "ipa_teku" },
  { label: "Stout", bierstil: "stout", glasTyp: "schwenker" },
  { label: "Porter", bierstil: "porter", glasTyp: "schwenker" },
  { label: "Saison", bierstil: "saison", glasTyp: "ipa_teku" },
  { label: "Radler", bierstil: "radler", glasTyp: "willibecher" },
  { label: "Alkoholfrei", bierstil: "alkoholfrei_pilsner", glasTyp: "pils_tulpe" },
];

export function findBeerStyle(bierstil: string): BeerStyleOption | undefined {
  return BEER_STYLE_OPTIONS.find((option) => option.bierstil === bierstil);
}

export function beerStyleLabel(bierstil: string): string {
  return findBeerStyle(bierstil)?.label ?? bierstil;
}

/** User-Glastyp aus der Sorte, sonst Stil-Default — nie stillschweigend weglassen. */
export function resolveGlasTyp(
  bierstil: string,
  glasTyp?: string | null,
): NonNullable<HyperrealisticInput["glasTyp"]> {
  const trimmed = glasTyp?.trim();
  if (trimmed && trimmed in GLAS_TYPEN) return trimmed as GlasTyp;
  return findBeerStyle(bierstil)?.glasTyp ?? "willibecher";
}
