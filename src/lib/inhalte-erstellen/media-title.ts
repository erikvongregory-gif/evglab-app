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

/** Max. Länge für den gespeicherten User-Prompt in der Mediathek. */
export const MEDIA_PROMPT_MAX = 800;

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
  /** Freitext / Chat-Prompt — steuert Aktion und Szene im Titel. */
  zusatzWunsch?: string | null;
};

function vesselLabel(input: StudioMediaTitleInput): string | null {
  const glas =
    input.glasTyp && input.glasTyp in GLAS_TYPEN
      ? GLAS_TYPEN[input.glasTyp as keyof typeof GLAS_TYPEN].label
      : null;
  const behaelter = input.behaelter ?? (glas ? "B" : "F");
  if (behaelter === "G") return glas ?? "Glas";
  if (behaelter === "B") return glas ?? "Glas";
  if (input.flaschenTyp === "dose_330" || input.flaschenTyp === "dose_500") return "Dose";
  return "Flasche";
}

/** Kurze Aktions-/Motivzeile aus dem User-Freitext. */
export function actionLabelFromIntent(raw?: string | null): string | null {
  const text = raw?.trim();
  if (!text) return null;
  if (/einschenk|eingesch[aeä]nk|eingeschenkt|pour(?:ed|ing)?|ins?\s+glas|in\s+(?:ein|das)\s+glas/i.test(text)) {
    return "Einschenken";
  }
  if (/anstoss|anstoß|prost|cheers|toast(?:ing)?/i.test(text)) return "Anstoßen";
  if (/zapf(?:t|en)?/i.test(text)) return "Zapfen";
  if (/naturtr[uü]b|unfiltriert|unfiltered/i.test(text)) return "Naturtrüb";
  if (/held|hero|packshot|produktfoto|still\s*life/i.test(text)) return "Produktfoto";
  const cleaned = text.replace(/\s+/g, " ").replace(/^["„]|["“]$/g, "").trim();
  if (cleaned.length >= 8 && cleaned.length <= 40 && !/[,:;]/.test(cleaned) && !/\n/.test(cleaned)) {
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  return null;
}

function sceneLabelFromIntent(
  raw: string | null | undefined,
  fallbackSzene: StudioMediaTitleInput["szene"],
): string | null {
  const text = raw?.trim() ?? "";
  if (/berg|gipfel|alpen|mountain|hütte|huette|\balm\b/i.test(text)) return "Alpenpanorama";
  if (/brauerei|sudhaus|braukessel|brewery/i.test(text)) return "Brauereihof";
  if (/strand|beach|sonnenuntergang/i.test(text)) return "Strand";
  if (/fussball|fußball|public.?viewing|stadion|fanmeile/i.test(text)) return "Public Viewing";
  if (/picknick|wiese|wiesen/i.test(text)) return "Picknick";
  if (/balkon|rooftop|skyline/i.test(text)) return "Stadtbalkon";
  if (/wirtshaus|kneipe|taverne/i.test(text)) return "Wirtshaus";
  if (/küche|kueche|kitchen|holztisch/i.test(text)) return "Holztisch";
  if (/biergarten|beer.?garden/i.test(text)) return "Biergarten";

  // Freitext beschreibt Aktion/Outdoor ohne Ort → kein Default-„Biergarten“ im Titel.
  if (text && /einschenk|eingesch|pour|zapf|naturtr|ansto/i.test(text)) {
    return null;
  }

  if (fallbackSzene && fallbackSzene in SCENE_LABELS) {
    return SCENE_LABELS[fallbackSzene as HyperrealisticInput["szene"]];
  }
  return null;
}

/** Kurztitel aus Bildkontext (Produkt · Aktion · Gefäß · Ort) — nie der Roh-Prompt. */
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

  const action = actionLabelFromIntent(input.zusatzWunsch);
  const scene = sceneLabelFromIntent(input.zusatzWunsch, input.szene);
  const vessel = vesselLabel(input);
  const character = input.characterName?.trim() || null;

  // Aktion vor Gefäß — „Hanseat · Einschenken · Willibecher“ liest sich wie das Motiv.
  const parts = [product, action, vessel, scene, character].filter(Boolean);
  // Doppelte Segmente vermeiden (z. B. Aktion = kurzer Freitext der schon Produkt heißt)
  const unique: string[] = [];
  for (const part of parts) {
    if (!unique.some((u) => u.toLowerCase() === part!.toLowerCase())) unique.push(part!);
  }
  return unique.join(" · ").slice(0, 120) || "Motiv";
}

/** User-Prompt für Mediathek-Suche und Lightbox — nie der englische KI-Masterprompt. */
export function buildStudioMediaPrompt(input: {
  zusatzWunsch?: string | null;
  fallbackTitle?: string | null;
}): string {
  const wish = input.zusatzWunsch?.trim();
  if (wish) return wish.slice(0, MEDIA_PROMPT_MAX);
  return (input.fallbackTitle?.trim() || "Motiv").slice(0, MEDIA_PROMPT_MAX);
}
