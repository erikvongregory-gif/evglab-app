import { FLASCHEN_TYPEN } from "@/app/(dashboard)/inhalte-erstellen/lib/brewing-knowledge";
import type { HyperrealisticInput } from "@/app/(dashboard)/inhalte-erstellen/lib/schemas";

export type ValidationContext = {
  input: HyperrealisticInput;
  hasProductPhoto: boolean;
  hasUsableBrief: boolean;
};

export type BriefValidation = {
  blocking_issues: string[];
  missing_information: string[];
};

/**
 * Pflichtchecks vor teurem Compiler/Generate.
 * Keine Flaschenform erfinden: ohne Produktfoto und ohne Shape-Ref → Block.
 */
export function validateBriefForGeneration(ctx: ValidationContext): BriefValidation {
  const blocking_issues: string[] = [];
  const missing_information: string[] = [];
  const { input, hasProductPhoto, hasUsableBrief } = ctx;
  const bottle = FLASCHEN_TYPEN[input.flaschenTyp];
  const wantsBrand = input.etikettModus !== "generisch";
  const glassOnly = input.behaelter === "G";

  if (!hasUsableBrief) {
    blocking_issues.push(
      "Kundenbrief fehlt: Bitte Freitext oder Preset angeben (Szene/Aktion beschreiben).",
    );
  }

  if (wantsBrand && !glassOnly && !hasProductPhoto) {
    blocking_issues.push(
      "Produktfoto fehlt: Für markentreue Bilder ist ein echtes Flaschen-/Etikettfoto Pflicht.",
    );
  }

  if (!glassOnly && !hasProductPhoto && !bottle.hasShapeReference) {
    blocking_issues.push(
      `Keine Formreferenz für „${bottle.display_name}“: Bitte Produktfoto hochladen — Flaschenform wird nicht erfunden.`,
    );
  }

  if (!glassOnly && !hasProductPhoto && bottle.hasShapeReference) {
    missing_information.push(
      "Kein Produktfoto: Nur Formreferenz verfügbar — Etikett-/Markentreue eingeschränkt.",
    );
  }

  if (wantsBrand && input.stiltreue === "hoch" && !hasProductPhoto) {
    blocking_issues.push("Stiltreue Hoch erfordert ein ladbares Produktfoto.");
  }

  return { blocking_issues, missing_information };
}
