import type { HyperrealisticInput } from "../schemas";
import {
  BOTTLE_SHAPE_LOCK_MARKER,
  buildBottleShapeLockFragment,
  CLOSURE_LOGIC_MARKER,
  buildClosureLogicFragment,
  ensureHyperrealismDirectives,
} from "./hyperrealism-blocks";

const GLASS_ONLY_LOCK =
  "CRITICAL COMPOSITION LOCK (MANDATORY): GLASS-ONLY hero shot — absolutely NO beer bottle, NO bottle on table, NO can, NO packaging visible anywhere in frame. Only branded beer glass(es) with beer and foam. Image is INVALID if any bottle or can appears.";

const BOTTLE_ONLY_LOCK =
  "CRITICAL COMPOSITION LOCK (MANDATORY): BOTTLE/CAN ONLY — absolutely NO poured beer glass, NO stein, NO tulip glass visible in frame.";

const BOTH_LOCK =
  "CRITICAL COMPOSITION LOCK (MANDATORY): Composition MUST show BOTH bottle/can AND poured beer glass, side by side, realistic proportion, both fully visible.";

const PUBLIC_VIEWING_SCENE_LOCK =
  "SCENE LOCK (MANDATORY): Football public viewing / Fanmeile with a large visible screen showing a live match, cheering fans, outdoor watch-party atmosphere. FORBIDDEN as main setting: Biergarten, beer garden chestnut trees, Wirtshaus interior, cozy tavern.";

function glassBrandLock(breweryName: string): string {
  const brand = breweryName.trim();
  return `GLASS BRAND LOCK (MANDATORY): Every beer glass in frame MUST display the "${brand}" logo/branding on the glass (etched or printed), matching reference label colors and typography. EXACT TEXT on each glass: "${brand}". FORBIDDEN: plain unbranded glasses, wrong brewery names (e.g. fictional brands), missing logos on glasses.`;
}

/** Gleiche Logik wie Legacy ImagePromptWorkflow — auf finalen Kie-Prompt anwenden. */
export function enforceHyperrealisticPromptConstraints(
  prompt: string,
  input: HyperrealisticInput,
  breweryName?: string,
): string {
  const behaelter = input.behaelter ?? (input.glasTyp ? "B" : "F");
  const etikettModus = input.etikettModus ?? "marke";
  let next = prompt.trim();
  const lower = next.toLowerCase();

  if (input.szene === "fussball_public_viewing" && !/public viewing|fanmeile|football.*screen|watch party/i.test(lower)) {
    next = `${next}\n\n${PUBLIC_VIEWING_SCENE_LOCK}`;
  }
  if (
    input.szene === "fussball_public_viewing" &&
    /(biergarten|beer garden|chestnut tree|wirtshaus|cozy tavern)/i.test(lower)
  ) {
    next = `${next}\n\nOverride conflict: Remove Biergarten/Wirtshaus setting. Scene MUST be football public viewing with visible screen and fan crowd.`;
  }

  if (behaelter === "G") {
    if (!/glass-only|no beer bottle|no bottle|invalid if any bottle/i.test(lower)) {
      next = `${next}\n\n${GLASS_ONLY_LOCK}`;
    }
    if (/(beer bottle|bottle on|with a bottle|holding.*bottle|\bbottle\b.*\btable\b)/i.test(lower)) {
      next = `${next}\n\nOverride conflict: Remove ALL bottles and cans from the scene. GLASS ONLY composition.`;
    }
    if (etikettModus === "marke" && breweryName?.trim() && !/glass.*logo|logo.*glass|exact text on.*glass/i.test(lower)) {
      next = `${next}\n\n${glassBrandLock(breweryName)}`;
    }
  }

  if (behaelter === "F") {
    if (!/bottle-only|no poured glass|no beer glass/i.test(lower)) {
      next = `${next}\n\n${BOTTLE_ONLY_LOCK}`;
    }
    if (/(poured glass|glass of beer|beer glass|weizen glass|willibecher)/i.test(lower)) {
      next = `${next}\n\nOverride conflict: Remove all glasses from the scene. Bottle/can product shot only.`;
    }
  }

  if (behaelter === "B") {
    const hasBottle = /(bottle|can|flasche|dose)/i.test(lower);
    const hasGlass = /(glass|willibecher|weizen|pilsner|snifter|goblet|pokal|stein|tulpe)/i.test(lower);
    if (!hasBottle || !hasGlass) {
      next = `${next}\n\n${BOTH_LOCK}`;
    }
  }

  // Flaschenform/-volumen hart erzwingen (nicht bei Nur-Glas). Wird spät angehängt,
  // damit gpt-image-2 die exakte Form gewichtet und der Claude-Rewrite sie nicht verwässert.
  if (behaelter !== "G" && !next.includes(BOTTLE_SHAPE_LOCK_MARKER)) {
    const shapeLock = buildBottleShapeLockFragment(input);
    if (shapeLock) {
      next = `${next}\n\n${shapeLock}`;
    }
  }

  // Verschluss-Konsistenz erzwingen: offene Flasche/Dose, wenn ein Glas eingeschenkt
  // ist oder jemand trinkt — kein Kronkorken/Tab auf einem "benutzten" Gebinde.
  if (behaelter !== "G" && !next.includes(CLOSURE_LOGIC_MARKER)) {
    const closureLogic = buildClosureLogicFragment(input);
    if (closureLogic) {
      next = `${next}\n\n${closureLogic}`;
    }
  }

  return ensureHyperrealismDirectives(next.trim(), input);
}

/** Bei Nur-Glas darf Kie kein Flaschen-Referenzbild bekommen — sonst kopiert i2i die Flasche in die Szene. */
export function shouldUseImageReferenceForGeneration(input: HyperrealisticInput): boolean {
  if (input.etikettModus === "generisch") return false;
  if (input.behaelter === "G") return false;
  return true;
}
