import { FLASCHEN_TYPEN } from "@/app/(dashboard)/inhalte-erstellen/lib/brewing-knowledge";
import type { HyperrealisticInput } from "@/app/(dashboard)/inhalte-erstellen/lib/schemas";
import {
  beverageContainerNoun,
  beverageDrinkNoun,
  inputProduktKategorie,
  isPouredGlassServing,
  resolvePhotoStyle,
} from "@/app/(dashboard)/inhalte-erstellen/lib/prompt-builders/hyperrealism-blocks";
import { MASTER_PROMPT_SECTIONS } from "./schema";

const CLOSURE_LABEL: Record<string, string> = {
  kronkorken: "Kronkorken",
  buegel: "Bügelverschluss",
  ring_pull: "Stay-Tab / Ring-Pull",
};

export type MasterPromptContext = {
  input: HyperrealisticInput;
  breweryName?: string;
  brandContext?: string;
  hasProductPhoto: boolean;
  hasShapeReference: boolean;
  channel?: string;
  sceneOverride?: string;
  actionOverride?: string;
  peopleOverride?: string;
  moodOverride?: string;
  referenceRoles?: Array<{
    index: number;
    role: "product" | "label" | "mood" | "shape" | "glass" | "scene" | "look";
    note?: string;
  }>;
};

const SHOT_DESCRIPTION: Record<string, string> = {
  A: "three-quarter product view with natural perspective",
  B: "eye-level frontal view",
  C: "slight low angle",
  D: "top-down composition",
  E: "close detail of label, liquid, foam, and condensation",
  F: "wide environmental view",
  G: "aerial top-down view",
  H: "over-the-shoulder handheld view",
};

/** Deterministischer Master-Prompt in fester Sektionsreihenfolge. */
export function assembleMasterPrompt(ctx: MasterPromptContext): string {
  const { input } = ctx;
  const bottle = FLASCHEN_TYPEN[input.flaschenTyp];
  const glassColor = input.flaschenfarbe;
  const closure = CLOSURE_LABEL[bottle.closure] ?? bottle.closure;
  const clientIntent = input.zusatzWunsch?.trim() || "";
  const scene =
    ctx.sceneOverride?.trim() ||
    clientIntent ||
    `photoreal scene: ${input.szene.replace(/_/g, " ")}`;
  const action = ctx.actionOverride?.trim() || "";
  const people = ctx.peopleOverride?.trim() || peopleFromInput(input);
  const mood = ctx.moodOverride?.trim() || input.stimmungTrend || input.stimmung || "authentic";
  const channel = ctx.channel?.trim() || "Instagram, Website, POS";
  const format = input.aspectRatio || "4:5";
  const productNoun = beverageContainerNoun(input);
  const drink = beverageDrinkNoun(input);
  const isBeer = inputProduktKategorie(input) === "bier";
  const containerMode = input.behaelter ?? (input.glasTyp ? "B" : "F");
  const closeDetail = input.shotType === "E";

  const refs: string[] = [];
  if (ctx.referenceRoles?.length) {
    for (const reference of ctx.referenceRoles) {
      const rule =
        reference.role === "product" || reference.role === "label"
          ? "preserve product identity and printed artwork; discard its background and lighting"
          : reference.role === "shape"
            ? "use only container geometry; copy no label, text, background, or lighting"
            : reference.role === "glass"
              ? "use only the glass silhouette and proportions; copy no logo, text, background, or lighting"
              : reference.role === "look" || reference.role === "mood"
                ? "use only lighting character, energy, and framing mood; invent new people — copy no faces, outfits, logos, or text"
                : "use only environment and spatial cues; copy no products, logos, or text";
      refs.push(`Image ${reference.index} (${reference.role}): ${rule}.${reference.note ? ` ${reference.note}` : ""}`);
    }
  } else if (ctx.hasProductPhoto) {
    refs.push(
      "Image 1: binding product and geometry reference (exact container and printed label). Discard its background and lighting.",
    );
    refs.push(
      "Image 1 also defines the label and logo; preserve recognizable artwork and lettering.",
    );
  } else if (ctx.hasShapeReference) {
    refs.push(
      "Image 1: container shape and silhouette reference only. Do not copy any label from it.",
    );
  } else if (containerMode !== "G") {
    refs.push("No usable product or shape reference is available; generation must be blocked.");
  } else {
    refs.push("No image reference supplied. Build the selected glass and beverage from the structured brief.");
  }

  const preserve = [
    ...(containerMode === "G" ? [] : bottle.preserve),
    ...(containerMode === "G" ? ["selected glass silhouette and fill level"] : ["container geometry and scale"]),
    ...(ctx.hasProductPhoto && input.stiltreue !== "frei"
      ? ["product identity", "logo and brand colors", "printed label text"]
      : []),
  ];

  const exclusions = [
      ...(containerMode === "G" ? ["no bottle, can, or packaging"] : ["no alternative container shape"]),
      "no extra labels or unrelated logos",
      "no watermark or malformed lettering",
      "no cutout, collage, or floating-product appearance",
    ...(action.toLowerCase().includes("toast") || /anst/i.test(clientIntent)
      ? ["kein Anstoßen nur durch Flasche+Glas ohne Hände"]
      : []),
  ];

  const sections: Record<(typeof MASTER_PROMPT_SECTIONS)[number], string> = {
    "AUFGABE UND VERWENDUNGSZWECK": [
      `Create a real-camera beverage image for ${channel}.`,
      resolvePhotoStyle(input) === "campaign"
        ? "Use deliberate campaign art direction with a clear subject hierarchy and usable copy space."
        : resolvePhotoStyle(input) === "premium"
          ? "Use restrained premium product-photography art direction with precise, believable light and materials."
          : "Use candid reportage art direction appropriate to the scene, with observed moments and natural imperfections.",
      "It must look physically photographed, with no CGI or pasted-product appearance.",
    ].join("\n"),
    HAUPTPRODUKT: [
      containerMode === "G"
        ? `Show only the selected ${drink} glass${input.glasTyp ? ` (${input.glasTyp.replace(/_/g, " ")})` : ""}; no bottle, can, or packaging.`
        : ctx.hasProductPhoto
          ? `Show the ${productNoun} from its product reference.`
          : `Show a ${bottle.display_name} matching the available shape reference.`,
      containerMode === "G" ? "" : `Container type: ${bottle.display_name}.`,
      containerMode === "G" ? "" : `Container geometry: ${bottle.geometry_profile}.`,
      containerMode === "G" ? "" : `Container material/color: ${glassColor}.`,
      isBeer
        ? ""
        : `Getränk: ${drink}. Keine Bierfarbe, kein Hopfen, kein Bierschaum. ${
            drink.includes("water")
              ? "Wasser farblos. Kohlensäure nur bei gesicherter Produktangabe."
              : "Limonadenfarbe nur aus Produktname oder Foto."
          }`,
      isPouredGlassServing(input)
        ? `Closure: open; the poured ${drink} means no cap may remain on the mouth.`
        : containerMode === "G"
          ? ""
          : `Closure: ${closure}.`,
      containerMode === "G"
        ? "Preserve the selected glass silhouette, rim, stem/base, proportions, and realistic fill level."
        : "Preserve container silhouette, neck, shoulder, proportions, label position, and closure geometry.",
      containerMode === "G" ? "" : bottle.forbidden,
    ]
      .filter(Boolean)
      .join("\n"),
    REFERENZEN: refs.join("\n"),
    "SZENE UND KOMPOSITION": [
      `Mandatory scene: ${scene}`,
      action ? `Action: ${action}` : "",
      people ? `People: ${people}` : "People: only when required by the scene.",
      `Mood: ${mood}`,
      `Shot: ${SHOT_DESCRIPTION[input.shotType ?? "A"]}.`,
      closeDetail ? "A deliberate detail crop is allowed." : "Keep the hero product readable and avoid accidental cropping.",
      "If toasting/Prost: visible adult hands holding glasses mid-clink — never floating bottle toasting floating glass.",
    ]
      .filter(Boolean)
      .join("\n"),
    "LICHT UND MATERIAL": [
      `Lighting must come from and match the scene (${input.tageszeit.replace(/_/g, " ")}).`,
      "Use natural glass reflections and sparse, irregular condensation only when physically plausible.",
      "Use physically believable depth of field for the selected shot.",
      "Matched lighting so the product looks physically photographed in THIS scene.",
    ].join("\n"),
    MARKENWIRKUNG: [
      ctx.breweryName ? `Brand/brewery: ${ctx.breweryName}.` : "Brand: derive only from the product reference.",
      ctx.brandContext?.trim() || "Tone: authentic, regional, and photographed.",
      "Avoid generic stock staging, synthetic colored glow, and beauty filters.",
    ].join("\n"),
    "TEXT UND ETIKETT": [
      ctx.hasProductPhoto && input.stiltreue !== "frei"
        ? "Preserve existing label text and logo from the product reference as accurately as possible."
        : "Do not claim exact label fidelity when no locked product artwork is supplied.",
      "Add no extra copy, invented lettering, or additional trademarks.",
    ].join("\n"),
    "ZWINGEND BEIBEHALTEN": preserve.map((p) => `- ${p}`).join("\n"),
    "NICHT VERÄNDERN ODER HINZUFÜGEN": exclusions.map((e) => `- ${e}`).join("\n"),
    AUSGABE: [
      "One coherent real-camera image with a single visual hierarchy.",
      `Format: ${format}.`,
      closeDetail ? "Honor the requested detail crop." : "Keep the hero subject readable in the final crop.",
    ].join("\n"),
  };

  return MASTER_PROMPT_SECTIONS.map((title) => `${title}\n\n${sections[title]}`).join("\n\n");
}

function peopleFromInput(input: HyperrealisticInput): string {
  const modus = input.personenModus ?? (input.personImBild ? "D" : "A");
  if (modus === "A") return "keine Personen / keine Hände, außer der Kundenbrief verlangt etwas anderes";
  if (modus === "B") return "eine erwachsene Hand mit Glas";
  if (modus === "E") {
    return `Gruppe (${input.gruppenAnzahl ?? "2"}, ${input.gruppenTyp ?? "gemischt"}, Dynamik ${input.gruppenDynamik ?? "E2"})`;
  }
  return "eine Person in der Szene, ungestellt";
}
