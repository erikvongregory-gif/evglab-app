import { BEER_PHYSICS, type BeerPhysicsProfile } from "@/lib/beverages/beer-appearance";
import {
  FLASCHEN_TYPEN,
  GLAS_TYPEN,
  containerMaterialPhrase,
  flascheVolumeMl,
  glassHasEichstrich,
  glassPourPromptDescription,
  isDoseTyp,
  pouredGlassFillMl,
} from "../brewing-knowledge";
import type { HyperrealisticInput } from "../schemas";
import { sanitizeProduktKategorie, type ProduktKategorie } from "@/lib/dashboard/metadata";

/** Nur Blickwinkel und Ausschnitt — Kamera und Objektiv kommen ausschließlich aus dem Fotostil. */
export const CAMERA_BY_SHOT: Record<NonNullable<HyperrealisticInput["shotType"]>, string> = {
  A: "Angle: slight 45° three-quarter view, product sharp",
  B: "Angle: eye-level, natural perspective, label fully sharp",
  C: "Angle: slight low angle, physically plausible, no superhero tilt",
  D: "Angle: top-down, natural shadow falloff",
  E: "Angle: close-up of glass, foam, condensation and label texture, thin but honest focal plane",
  F: "Angle: wide environmental framing at authentic venue scale",
  G: "Angle: aerial view from moderate height, realistic geometry",
  H: "Angle: over-the-shoulder first-person hold, believable hand scale",
};

const SCENE_TEXTURE_ANCHORS: Record<HyperrealisticInput["szene"], string> = {
  biergarten_sommer:
    "weathered wooden table grain with real scratches, gravel pebbles with uneven size, chestnut leaf dappled shadows with soft penumbra, distant guest clothing with natural fabric folds",
  wirtshaus_innen:
    "dark wood paneling with visible grain and age marks, checkered tablecloth weave, warm tungsten practical lights with soft falloff, subtle glass reflections on polished surfaces",
  kueche_zuhause:
    "marble countertop with natural veining and micro-scratches, soft window light with realistic shadow direction, everyday kitchen props with lived-in imperfections",
  wiese_picknick:
    "woven picnic blanket texture, wildflower stems with irregular spacing, soft grass blades in foreground blur, natural uneven ground contact shadows",
  strand_sonnenuntergang:
    "fine beach sand grains, gentle wave foam at shoreline, warm sunset color temperature gradient in sky, salt-air moisture on glass surface",
  alpenpanorama:
    "rough alpine wood railing texture, crisp mountain air clarity, subtle wind movement in clothing, distant peak atmospheric haze",
  stadtbalkon_abend:
    "urban balcony metal rail with real patina, city light bokeh with natural circle-of-confusion, evening ambient mixed lighting, believable depth between foreground and skyline",
  brauereihof:
    "copper kettle patina and brushed metal reflections, industrial-rustic stone or brick textures, brewery courtyard ground wear, authentic production-environment grime and warmth",
  fussball_public_viewing:
    "LED screen glow with realistic bloom on faces, plastic cup and jersey fabric textures, crowd depth layers with natural motion blur, outdoor event lighting spill",
};

export const HYPERREALISM_NEGATIVE =
  "no CGI or illustration; no floating or misscaled product; no warped label text; no plastic foam or uniform sticker-like condensation; no malformed hands or faces; no beauty-retouched wax skin; no golden-hour HDR bloom or teal-orange grade; no lens-flare stock glow; no unrelated logos or watermarks";

export function resolveBeerPhysics(bierstil: string): BeerPhysicsProfile {
  const key = bierstil.trim().toLowerCase().replace(/\s+/g, "_");
  return (
    BEER_PHYSICS[key] ?? {
      srm: "4–8",
      hex: "#E8B050",
      liquid: "authentic craft beer color with natural clarity and physically plausible translucency",
      foam: "natural white foam with irregular pores and believable retention, never stiff or plastic",
      head: "about two fingers (2–3 cm) of foam",
      carbonation: "natural carbonation bubbles with varied size and spacing",
    }
  );
}

/** Automatisch in den Freitext gespiegelte Klarheits-Notizen (applyClientIntentOverrides). */
export const CLARITY_NOTE_TRUEB = "Bier naturtrüb unfiltriert mit Hefetrübung";
export const CLARITY_NOTE_KLAR = "Bier filtriert klar";

/** Freitext ohne die automatisch angehängten Klarheits-Notizen — also nur, was der Kunde geschrieben hat. */
export function customerSceneText(zusatzWunsch?: string | null): string {
  return (zusatzWunsch ?? "")
    .split(CLARITY_NOTE_TRUEB)
    .join("")
    .split(CLARITY_NOTE_KLAR)
    .join("")
    .replace(/^[\s.]+|[\s.]+$/g, "");
}

/** Freitext verlangt naturtrübes / unfiltriertes Bier. */
export function wantsUnfilteredFromText(zusatzWunsch?: string | null): boolean {
  return /naturtr[uü]b|unfiltriert|unfiltered|\btr[uü]b\b|yeast.?haze|cloudy|hazy(?!\s*ipa)/i.test(
    zusatzWunsch?.trim() ?? "",
  );
}

/** Freitext verlangt klar filtriertes Bier — nicht „unfiltriert“ matchen. */
export function wantsFilteredFromText(zusatzWunsch?: string | null): boolean {
  const text = zusatzWunsch?.trim() ?? "";
  if (!text || /unfiltriert|naturtr[uü]b/i.test(text)) return false;
  return /\bfiltriert\b|crystal.?clear|glasklar/i.test(text);
}

/**
 * Bierklarheit für die Generierung:
 * Freitext schlägt Sortenfeld; sonst filtrierung; sonst Stil-Default (Hefe/Keller/NEIPA → trüb).
 */
export function resolveBeerClarity(
  input: Pick<HyperrealisticInput, "filtrierung" | "zusatzWunsch" | "bierstil">,
): "trueb" | "klar" {
  if (wantsUnfilteredFromText(input.zusatzWunsch)) return "trueb";
  if (wantsFilteredFromText(input.zusatzWunsch)) return "klar";
  if (input.filtrierung === "unfiltriert") return "trueb";
  if (input.filtrierung === "filtriert") return "klar";
  const stil = input.bierstil.trim().toLowerCase().replace(/\s+/g, "_");
  if (/hefeweizen|dunkles_weizen|weizenbock|kellerbier|neipa|zwickel|rauchbier|radler/.test(stil)) return "trueb";
  return "klar";
}

/** @deprecated Prefer resolveBeerClarity — bleibt für kurze Freitext-Checks. */
export function wantsUnfilteredBeer(
  zusatzWunsch?: string | null,
  filtrierung?: HyperrealisticInput["filtrierung"],
): boolean {
  if (filtrierung === "unfiltriert") return true;
  if (filtrierung === "filtriert") return false;
  return wantsUnfilteredFromText(zusatzWunsch);
}

/** Weißbier wird anders eingeschenkt: Rest aufschwenken, Hefe ins Glas. */
export function weizenPourNote(bierstil: string, behaelter: NonNullable<HyperrealisticInput["behaelter"]>): string {
  if (behaelter !== "B") return "";
  const stil = bierstil.trim().toLowerCase().replace(/\s+/g, "_");
  if (!/hefeweizen|dunkles_weizen|weizenbock/.test(stil)) return "";
  return "Weißbier serving: the bottle is almost empty — poured slowly into the tilted glass, the last few centimetres swirled to rouse the yeast; at most a thin yeast film remains at the bottle bottom.";
}

export function buildBeerPhysicsFragment(
  bierstil: string,
  behaelter: NonNullable<HyperrealisticInput["behaelter"]>,
  options?: { clarity?: "trueb" | "klar" },
): string {
  const profile = resolveBeerPhysics(bierstil);
  const clarity = options?.clarity ?? "klar";
  // Bei trüb KEINE Stil-Wörter wie „crystal-clear Helles“ stehen lassen — die ziehen das Modell zurück.
  const liquid =
    clarity === "trueb"
      ? `visibly NATURTRÜB / UNFILTERED beer in its own style color (approx. ${profile.hex}) — dense soft yeast haze, milky-cloudy opacity, light scatters in the body so you cannot see sharp detail through the liquid, NEVER crystal-clear`
      : /hazy|cloudy|turbid|opaque|yeast/i.test(profile.liquid)
        ? "crystal-clear filtered beer matching the style color — brilliant see-through body, NO yeast haze, NO naturtrüb cloudiness"
        : profile.liquid;
  const vessel =
    behaelter === "G"
      ? "poured beer in glass"
      : behaelter === "F"
        ? "visible beer liquid through bottle glass where applicable"
        : "poured beer in glass and bottle liquid color consistency";
  return [
    `LIQUID PHYSICS (${vessel}):`,
    `Clarity: ${clarity === "trueb" ? "UNFILTERED / naturtrüb (MANDATORY)" : "FILTERED / crystal-clear (MANDATORY)"}.`,
    `Color SRM ${profile.srm}, approx. hex ${profile.hex} — ${liquid}.`,
    `Foam: ${profile.foam}. Head height: ${profile.head} — match this exactly, it is how a brewer serves this style.`,
    weizenPourNote(bierstil, behaelter),
    `Carbonation: ${profile.carbonation}.`,
    "Glass: ordinary real glass. Highlights come from this room (window, sky, lamps), not a studio HDRI. Reflections show the actual setting. Condensation only if the drink is cold — sparse, irregular, some droplets already slid.",
    "Condensation: fine irregular perspiration droplets with varied size and spacing slowly sliding down chilled glass — never uniform sticker dots.",
    "Avoid unnaturally stiff, plastic-looking, or perfectly symmetrical foam domes.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function inputProduktKategorie(input: Pick<HyperrealisticInput, "produktKategorie">): ProduktKategorie {
  return sanitizeProduktKategorie(input.produktKategorie);
}

export function beverageDrinkNoun(input: Pick<HyperrealisticInput, "produktKategorie">): string {
  switch (inputProduktKategorie(input)) {
    case "limonade":
      return "lemonade";
    case "tafelwasser":
      return "still table water";
    case "mineralwasser":
      return "mineral water";
    default:
      return "beer";
  }
}

export function beverageContainerNoun(input: Pick<HyperrealisticInput, "produktKategorie" | "flaschenTyp">): string {
  if (isDoseTyp(input.flaschenTyp)) return "beverage can";
  switch (inputProduktKategorie(input)) {
    case "limonade":
      return "lemonade bottle";
    case "tafelwasser":
      return "still table-water bottle";
    case "mineralwasser":
      return "mineral-water bottle";
    default:
      return "beer bottle";
  }
}

export function withoutBeerFoam(text: string): string {
  return text
    .replace(/modest white foam cap/gi, "no beer foam")
    .replace(/fine white foam[^,—.]*/gi, "no beer foam")
    .replace(/thick foam crown[^,.]*/gi, "no beer foam")
    .replace(/modest foam/gi, "no beer foam")
    .replace(/glass beer mug/gi, "glass mug")
    .replace(/wheat-beer tumbler/gi, "tumbler");
}

export function bottleGeometryPrompt(
  input: Pick<HyperrealisticInput, "produktKategorie" | "flaschenTyp">,
  promptDescription: string,
): string {
  if (inputProduktKategorie(input) === "bier") return promptDescription;
  return promptDescription.replace(/beer bottle/gi, beverageContainerNoun(input));
}

export function lemonadeColorFromName(bierstil: string): string {
  const key = bierstil.trim().toLowerCase();
  if (/\bspezi\b/.test(key)) return "cola-orange Spezi color matching the product label/photo";
  if (/\bcola\b/.test(key)) return "dark cola-brown matching the product label/photo";
  if (/orange/.test(key)) return "orange lemonade color matching the product label/photo";
  if (/zitrone|lemon/.test(key)) return "pale lemon lemonade color matching the product label/photo";
  return "lemonade color taken only from the product label/photo — do not invent beer amber or hops";
}

export function waterCarbonationFromName(input: HyperrealisticInput): string {
  const key = `${input.bierstil} ${input.beerName ?? ""}`.toLowerCase();
  if (/\b(?:still|naturell|ohne kohlensaeure|ohne kohlensäure)\b/.test(key)) {
    return "still water, no bubbles, no foam";
  }
  if (/\b(?:medium|classic|sprudel|sparkling|kohlensaeure|kohlensäure)\b/.test(key)) {
    return "fine mineral-water carbonation bubbles only if consistent with the product photo; no beer foam, no hop haze";
  }
  return "no beer foam and no invented carbonation — bubbles only if clearly visible in the product photo";
}

export function buildLiquidPhysicsFragment(input: HyperrealisticInput, behaelter: NonNullable<HyperrealisticInput["behaelter"]>): string {
  const kategorie = inputProduktKategorie(input);
  if (kategorie === "bier") {
    return buildBeerPhysicsFragment(input.bierstil, behaelter, {
      clarity: resolveBeerClarity(input),
    });
  }
  const drink = beverageDrinkNoun(input);
  const vessel =
    behaelter === "G"
      ? `poured ${drink} in glass`
      : behaelter === "F"
        ? `visible ${drink} through bottle glass where applicable`
        : `poured ${drink} in glass and bottle liquid consistency`;
  if (kategorie === "limonade") {
    return [
      `LIQUID PHYSICS (${vessel}):`,
      `Color: ${lemonadeColorFromName(input.bierstil)}.`,
      "No beer color, no hops, no beer foam head.",
      "Carbonation only if the product name or photo shows a carbonated lemonade (Cola/Spezi/Brause); otherwise no invented fizz.",
      "Glass: ordinary real glass. Highlights from this room, not a studio HDRI. Condensation only if the drink is cold — sparse, irregular.",
    ].join(" ");
  }
  return [
    `LIQUID PHYSICS (${vessel}):`,
    "Water is colorless and crystal-clear — no beer color, no hops, no beer foam.",
    `Carbonation: ${waterCarbonationFromName(input)}.`,
    "Glass: ordinary real glass. Highlights from this room, not a studio HDRI. Condensation only if the drink is cold — sparse, irregular.",
  ].join(" ");
}

/**
 * gpt-image-2 liefert nur 3 reale Formate (1024x1024 / 1024x1536 / 1536x1024).
 * Wir versprechen dem Modell daher das tatsächlich gerenderte Format, nicht das
 * UI-Verhältnis (9:16 und 4:5 werden beide zu Hochformat 2:3).
 */
function aspectRatioFormatLabel(aspectRatio: HyperrealisticInput["aspectRatio"]): string {
  if (aspectRatio === "1:1") return "a square 1:1";
  if (aspectRatio === "16:9" || aspectRatio === "4:3") return "a horizontal landscape (3:2)";
  return "a vertical portrait (2:3)";
}

export function buildCameraFragment(
  shotType: NonNullable<HyperrealisticInput["shotType"]> | undefined,
  aspectRatio: HyperrealisticInput["aspectRatio"],
  input?: Pick<HyperrealisticInput, "contentPreset" | "photoStyle" | "stimmungTrend" | "personenModus" | "personImBild">,
): string {
  const shot = shotType ?? "A";
  const style = input ? resolvePhotoStyle(input) : "reportage";
  const camera =
    style === "campaign"
      ? "Camera: full-frame, 24–35mm lens at f/5.6, ISO 100, low or forced perspective with the product dominant in frame"
      : style === "premium"
        ? "Camera: full-frame on a steady hold, 85mm lens at f/4, ISO 100–400, product in focus with natural optical falloff"
        : "Camera: handheld 35mm point-and-shoot look, 28–35mm lens, on-camera direct flash, candid framing with imperfect edges";
  return `${CAMERA_BY_SHOT[shot]}. ${camera}. Final composition framed for ${aspectRatioFormatLabel(aspectRatio)} format. Neutral white balance and believable dynamic range; no HDR.`;
}

export function buildSceneTextureAnchors(szene: HyperrealisticInput["szene"]): string {
  return `SCENE TEXTURE ANCHORS (mandatory micro-realism): ${SCENE_TEXTURE_ANCHORS[szene]}.`;
}

export function buildHumanRealismFragment(input: HyperrealisticInput): string {
  const modus = input.personenModus ?? (input.personImBild ? "D" : "A");
  if (modus === "A") return "";
  if (modus === "B" || modus === "C") {
    return `HUMAN REALISM: Real adult hands — visible knuckles, pores, veins, slight dryness or tan lines, correct finger count, believable grip pressure on glass and bottle. Not smooth CGI hands, not beauty-retouched skin. ${HAND_BOTTLE_CONTACT}`;
  }
  return [
    "HUMAN REALISM:",
    "Clearly adult humans with natural anatomy, realistic proportions, and true skin detail (pores, subtle blemishes, under-eye texture, realistic lips and ears).",
    "Faces must be artifact-free: no extra fingers, no fused fingers, no warped teeth, no uncanny asymmetry, no beauty-filter smoothing.",
    "Wardrobe and hair should look worn-in and candid, not catalog-styled. Expressions spontaneous, not posed stock-photo smiles.",
    "Keep person scale physically plausible relative to bottle, glass, table, and environment.",
  ].join(" ");
}

/** Eindeutiger Marker, damit der Lock nicht doppelt angehängt wird. */
export const BOTTLE_SHAPE_LOCK_MARKER = "BOTTLE SHAPE LOCK (MANDATORY)";

/** Eingeschenktes Glas neben Flasche/Dose — der Verschluss darf dann nicht mehr drauf sein. */
export function isPouredGlassServing(input: HyperrealisticInput): boolean {
  const behaelter = input.behaelter ?? (input.glasTyp ? "B" : "F");
  return behaelter === "B";
}

/**
 * Erzwingt exakt den vom Nutzer gewählten Flaschentyp (Form + Volumen) und
 * verbietet typische Verwechslungen (z. B. NRW-0,5-l vs. Stubbi-0,33-l).
 * Die Endmontage (final-prompt.ts) stellt ihn vor die Szene, damit Kürzung ihn nie trifft.
 */
export function buildBottleShapeLockFragment(input: HyperrealisticInput): string {
  const behaelter = input.behaelter ?? (input.glasTyp ? "B" : "F");
  if (behaelter === "G") return "";
  const flasche = FLASCHEN_TYPEN[input.flaschenTyp];
  if (!flasche) return "";
  const istDose = isDoseTyp(input.flaschenTyp);
  const noun = istDose ? "aluminium beverage can" : "bottle";
  const nounCap = istDose ? "Can" : "Bottle";
  const colorClause = istDose ? "" : `, made of ${containerMaterialPhrase(input.flaschenTyp, input.flaschenfarbe)}`;
  const poured = isPouredGlassServing(input);
  const litres = flascheVolumeMl(input.flaschenTyp) / 1000;
  return [
    `${BOTTLE_SHAPE_LOCK_MARKER}:`,
    `The ${noun} MUST be ${bottleGeometryPrompt(input, flasche.promptDescription)}${colorClause}.`,
    `${nounCap} shape and size are defined by this specification — ${flasche.forbidden}.`,
    poured
      ? `EXACTLY ONE ${noun} of this product in the frame — the one poured from or standing open next to the glass; never a second ${noun} beside it.`
      : "",
    `If a bottle-shape reference photo is attached, copy its silhouette, neck and shoulder exactly.`,
    `If the product photo shows several sizes, the product is ONLY the ${litres} L one — ignore the others.`,
    smallSizeCue(input.flaschenTyp, noun),
    `Label photos only supply the printed artwork for this ${noun}; containers in LOOK/style references are NOT this product.`,
    `Physically correct real-world scale so the ${litres} L size is unmistakable.`,
  ]
    .filter(Boolean)
    .join(" ");
}

/** 0,33 l wird sonst fast immer als 0,5 l gerendert — Größe über Hand und Glas greifbar machen. */
function smallSizeCue(flaschenTyp: string, noun: string): string {
  const ml = flascheVolumeMl(flaschenTyp);
  if (ml <= 0 || ml > 350) return "";
  return `SMALL SIZE (${ml} ml): this is the small ${noun}, clearly shorter and slimmer than a standard 0.5 L ${noun} — an adult hand covers about half of its body height, and the poured glass is a small glass of about ${ml} ml, never a tall 0.5 L glass.`;
}

export const GLASS_FORBIDDEN: Record<NonNullable<HyperrealisticInput["glasTyp"]>, string> = {
  willibecher:
    "NOT a stemmed Pilsner flute or tulip, NOT a curvy Weizen vase, NOT a Maßkrug with handle, NOT a Teku, NOT a Kölsch Stange, NOT an American shaker pint, NOT a straight highball/water tumbler",
  pils_tulpe:
    "NOT a stemless Willibecher tumbler, NOT a Weizen vase, NOT a Maßkrug, NOT a Teku, NOT a shaker pint, NOT a cylindrical water glass",
  weizen: "NOT a Willibecher tumbler, NOT a stemmed Pilsner flute, NOT a Maßkrug, NOT a Stange, NOT a shaker pint",
  masskrug: "NOT a Willibecher, NOT a Pilsner flute, NOT a Weizen vase, NOT a stemless tumbler without handle",
  seidel: "NOT a 1 litre Maßkrug, NOT a handle-less Willibecher, NOT a stoneware Steinkrug, NOT a Weizen vase",
  steinkrug: "NOT a glass mug, NOT a transparent Maßkrug, NOT a Willibecher, NOT a stemmed glass",
  pokal: "NOT a slender Pilstulpe, NOT a snifter, NOT a Teku, NOT a stemless Willibecher, NOT a Maßkrug",
  nonic: "NOT a conical Willibecher, NOT a Weizen vase, NOT a stemmed glass, NOT a Maßkrug with handle",
  ipa_teku: "NOT a Willibecher, NOT a Weizen vase, NOT a Maßkrug, NOT a Pilsner flute, NOT a shaker pint",
  schwenker: "NOT a Willibecher, NOT a Weizen vase, NOT a Maßkrug, NOT a Pilsner flute, NOT a shaker pint",
  stange: "NOT a Willibecher (too wide), NOT a Pilsner flute, NOT a Weizen vase, NOT a Maßkrug, NOT a shaker pint",
};

/** Marker, damit der Etikett-Lock nicht doppelt angehängt wird. */
export const LABEL_LOCK_MARKER = "LABEL LOCK 1:1 (MANDATORY)";

/**
 * Physikalische Etikett-Ausrichtung relativ zu Boden/Hals — nicht relativ zur Kamera.
 * Vorn anhängen (siehe ensureProductGeometryLocks), sonst wird der Lock bei langen Prompts abgeschnitten.
 */
export const LABEL_ORIENTATION_LOCK =
  "LABEL ORIENTATION (PHYSICAL, MANDATORY): the label is glued to the bottle — its top edge (Anchor A) always faces the NECK/shoulder and its bottom edge the base, exactly as on the reference. When the bottle tilts or pours, the artwork rotates with the glass, so text may read sideways or upside-down to the camera; that is correct. FORBIDDEN: label re-rotated to read upright on a tilted bottle, label upside-down relative to the base, mirrored label. Pour tilt about 45–70°.";

export function buildLabelLockFragment(input: HyperrealisticInput): string {
  if ((input.etikettModus ?? "marke") !== "marke") return "";
  const product = input.beerName?.trim();
  const noun = isDoseTyp(input.flaschenTyp) ? "can" : "bottle";
  return [
    `${LABEL_LOCK_MARKER}:`,
    product ? `The product reference photo IS "${product}".` : "The product reference photo IS this exact product.",
    `Copy the printed ${noun} artwork 1:1 — same logo, crest, typography, colors, layout and words; every readable letter spelled exactly as on the reference.`,
    `No redesign, recolor, translation, invented variant, extra badge or warped letters; if the reference shows several ${noun}s, copy only one label, never a blend.`,
    isDoseTyp(input.flaschenTyp) ? "" : LABEL_ORIENTATION_LOCK,
    `A new photograph of that same physical product — not a collage and not a different ${inputProduktKategorie(input) === "bier" ? "beer" : "drink"}.`,
  ]
    .filter(Boolean)
    .join(" ");
}
export const GLASS_SHAPE_LOCK_MARKER = "GLASS SHAPE LOCK (MANDATORY)";

export function buildGlassShapeLockFragment(input: HyperrealisticInput): string {
  const behaelter = input.behaelter ?? (input.glasTyp ? "B" : "F");
  if (behaelter === "F" || !input.glasTyp) return "";
  const glas = GLAS_TYPEN[input.glasTyp];
  if (!glas) return "";
  const fillMl = pouredGlassFillMl(input.glasTyp, input.flaschenTyp, behaelter);
  const pour = glassPourPromptDescription(input.glasTyp, fillMl);
  const bottleMl = flascheVolumeMl(input.flaschenTyp);
  const isBeer = inputProduktKategorie(input) === "bier";
  const drink = beverageDrinkNoun(input);
  const volumeLock =
    behaelter === "B"
      ? `POUR VOLUME: a single pour from this ${bottleMl / 1000} L bottle/can (${fillMl} ml) — never a larger mug.`
      : "";
  return [
    `${GLASS_SHAPE_LOCK_MARKER} — INVALID IF WRONG GLASS (${glas.label}):`,
    isBeer
      ? `Every beer glass in frame MUST be exactly ${pour}.`
      : `Every glass in frame MUST be exactly ${withoutBeerFoam(pour)}. Liquid is ${drink}; do not render beer foam or hop haze.`,
    `${GLASS_FORBIDDEN[input.glasTyp]}.`,
    input.glasTyp !== "willibecher" ? "Do not fall back to a Willibecher / conical tumbler." : "",
    input.glasTyp === "steinkrug" && isBeer
      ? "Stoneware is opaque: show the beer and foam only from above at the rim; no liquid is visible through the walls."
      : "",
    isBeer && glassHasEichstrich(input.glasTyp)
      ? "German serving glass: a small printed fill line with its volume mark near the rim (Eichstrich); the beer reaches that line and the foam sits above it. The mark stays small and secondary."
      : "",
    volumeLock,
    "If a glass-shape reference image is attached, copy its silhouette and proportions exactly.",
  ]
    .filter(Boolean)
    .join(" ");
}

export const UNFILTERED_LIQUID_LOCK_MARKER = "LIQUID CLARITY LOCK (MANDATORY)";

export function buildUnfilteredLiquidLockFragment(input: HyperrealisticInput): string {
  if (inputProduktKategorie(input) !== "bier") return "";
  const clarity = resolveBeerClarity(input);
  if (clarity === "trueb") {
    return [
      `${UNFILTERED_LIQUID_LOCK_MARKER} — INVALID IF CLEAR:`,
      "Every poured beer is densely NATURTRÜB like a Kellerbier or Zwickel: milky yeast haze in the beer's own color, nearly opaque; the far glass wall and background do NOT read sharply through the beer.",
      "IMAGE-1 LIQUID OVERRIDE: ignore any clear beer visible through the bottle in Image 1 — clarity comes from this text and any LIQUID reference, never from Image 1 or from style words like Helles/Lager.",
      "FORBIDDEN: crystal-clear filtered lager, water-like transparency, Pils clarity.",
    ].join(" ");
  }
  return [
    `${UNFILTERED_LIQUID_LOCK_MARKER} — INVALID IF CLOUDY:`,
    "The poured beer is filtered and crystal-clear. FORBIDDEN: naturtrüb cloudiness, milky opacity, yeast haze.",
  ].join(" ");
}

/**
 * Kritische Produkt-Geometrie vorn anhängen — Prompt-Kürzung am Ende darf
 * Etikett-Orientierung, Glasform und Naturtrüb nicht streichen.
 * Klarheit immer STICKY vorn, auch wenn sie schon mitten im Prompt steht.
 */
export function ensureProductGeometryLocks(prompt: string, input: HyperrealisticInput): string {
  const heads: string[] = [];
  const clarity = buildUnfilteredLiquidLockFragment(input);
  if (clarity) heads.push(clarity);
  if (!prompt.includes(GLASS_SHAPE_LOCK_MARKER)) {
    const glass = buildGlassShapeLockFragment(input);
    if (glass) heads.push(glass);
  }
  const needsOrientation =
    (input.etikettModus ?? "marke") === "marke" && !isDoseTyp(input.flaschenTyp);
  if (needsOrientation && !prompt.includes("LABEL ORIENTATION (PHYSICAL")) {
    heads.push(LABEL_ORIENTATION_LOCK);
  }
  if (!heads.length) return prompt;
  return `${heads.join("\n\n")}\n\n${prompt}`;
}

/** Marker, damit die Verschluss-Logik nicht doppelt angehängt wird. */
export const CLOSURE_LOGIC_MARKER = "CLOSURE LOGIC (MANDATORY)";

/**
 * Physikalische Konsistenz des Verschlusses:
 * - Steht ein bereits eingeschenktes Glas daneben, ODER trinkt jemand aus der
 *   Flasche/Dose, MUSS das Gebinde geöffnet sein (kein Kronkorken / Tab offen).
 * - Eine versiegelte Flasche neben einem vollen Glas oder jemand, der aus einer
 *   verschlossenen Flasche trinkt, ist unlogisch und wird verboten.
 */
/**
 * Offener Bügelverschluss als echte Mechanik beschreiben — vage Angaben („flipped back“) führten zu
 * doppelten, verknoteten Drahtbügeln und schwebenden Porzellanköpfen.
 */
export const SWING_TOP_OPEN = [
  "the swing-top OPEN like a real German Bügelverschluss: ONE thin wire ring around the neck below the lip, TWO parallel wire arms hinged on it, ONE porcelain stopper with rubber gasket at their end",
  "— the arms are swung back and the stopper hangs down against the side of the neck by gravity (on a pouring bottle it dangles below the neck, beside the stream, never in it)",
  "— exactly ONE stopper in ONE color as on the reference, ONE wire bail, bottle mouth free; NO second wire loop, NO tangled wire, NO stopper upright on the mouth, NOT covering the neck label",
].join(" ");

/** Hand an Flasche: Finger liegen außen am Glas — nie durch das Glas sichtbar oder im Etikett „versunken“. */
export const HAND_BOTTLE_CONTACT =
  "HAND–BOTTLE CONTACT: fingers and thumb wrap around the OUTSIDE of the bottle with contact shadows; no part of a hand is ever inside the bottle or seen through its glass, nothing fuses into it, and the label is never printed over a finger.";

export function buildClosureLogicFragment(input: HyperrealisticInput): string {
  const behaelter = input.behaelter ?? (input.glasTyp ? "B" : "F");
  if (behaelter === "G") return "";
  const istDose = isDoseTyp(input.flaschenTyp);
  const istBuegel = input.flaschenTyp.startsWith("buegel");
  const istSchraub = FLASCHEN_TYPEN[input.flaschenTyp]?.closure === "schraub";
  const noun = istDose ? "can" : "bottle";
  const closureWord = istDose
    ? "stay-tab still unopened"
    : istBuegel
      ? "swing-top porcelain stopper still clamped shut"
      : istSchraub
        ? "screw cap still tightened on"
        : "crown cap still on the mouth";
  const openState = istDose
    ? "the stay-tab popped open at the top of the can"
    : istBuegel
      ? SWING_TOP_OPEN
      : istSchraub
        ? "the screw cap removed — no cap on the bottle mouth"
        : "the crown cap removed — no cap on the bottle mouth";
  const capNever = istDose
    ? "the stay-tab must be popped open — never an unopened can next to a full glass."
    : istBuegel
      ? "the porcelain stopper must NEVER sit clamped on the bottle mouth."
      : istSchraub
        ? "a screw cap must NEVER sit on the bottle mouth, even if the product photo shows it sealed; the cap may lie on the table."
        : "a crown cap must NEVER sit on the bottle mouth, even if the product photo shows it sealed; the cap may lie on the table.";

  const modus = input.personenModus ?? (input.personImBild ? "D" : "A");
  // Freitext-Szenen („jemand schenkt ein“) können Hände mitbringen, auch ohne Personen-Modus.
  const peoplePossible = modus !== "A" || Boolean(customerSceneText(input.zusatzWunsch));
  const poured = behaelter === "B";
  const lines: string[] = [`${CLOSURE_LOGIC_MARKER}:`];
  if (peoplePossible) lines.push(HAND_BOTTLE_CONTACT);
  if (poured || peoplePossible) lines.push(`OPEN STATE: ${openState}.`);
  if (poured) {
    const drink = inputProduktKategorie(input) === "bier" ? "beer" : beverageDrinkNoun(input);
    lines.push(`OPEN SERVING: a glass is already poured, so the ${noun} is OPEN. HARD RULE: once ${drink} is poured, ${capNever}`);
  }
  if (peoplePossible) {
    lines.push(
      `Anyone drinking from, raising, clinking or toasting (Prost) a ${noun} holds an OPEN one; doing that with a sealed ${noun} (${closureWord}) is FORBIDDEN.`,
    );
  }
  if (!poured) {
    lines.push(`A sealed ${noun} (${closureWord}) is only correct when nobody drinks from it and no glass is poured.`);
  }

  return lines.join(" ");
}

/** Vorn anhängen — Prompt-Kürzung am Ende darf die Einschenk-Regel nicht streichen. */
export function ensureClosureLogic(prompt: string, input: HyperrealisticInput): string {
  const closure = buildClosureLogicFragment(input);
  if (!closure) return prompt;
  if (prompt.includes(CLOSURE_LOGIC_MARKER)) return prompt;
  return `${closure} ${prompt}`;
}

export function resolvePhotoStyle(
  input: Pick<HyperrealisticInput, "contentPreset" | "photoStyle" | "stimmungTrend" | "personenModus" | "personImBild">,
): NonNullable<HyperrealisticInput["photoStyle"]> {
  if (input.photoStyle) return input.photoStyle;
  if (input.contentPreset === "campaign_social") return "campaign";
  const hasPeople = (input.personenModus ?? (input.personImBild ? "D" : "A")) !== "A";
  if (!hasPeople && (input.stimmungTrend === "premium" || input.stimmungTrend === "modern")) return "premium";
  return "reportage";
}

export const PHOTO_STYLE_LOCK_MARKER = "PHOTO STYLE LOCK (NON-NEGOTIABLE)";

export const REALISM_BASE_MARKER = "REALISM BASE (ALWAYS ON)";

/**
 * Immer aktive Realismus-Schicht (ersetzt den früheren Hyperreal-Schalter). Stilneutral:
 * Kamera, Licht, Bokeh und Körnung bestimmt allein der PHOTO STYLE LOCK.
 */
export function buildRealismBaseFragment(input: HyperrealisticInput): string {
  const isBeer = inputProduktKategorie(input) === "bier";
  const behaelter = input.behaelter ?? (input.glasTyp ? "B" : "F");
  const poured = isBeer && behaelter !== "F";
  return [
    `${REALISM_BASE_MARKER}: a real photograph from a physical camera — never CGI, 3D render, illustration or AI-art gloss.`,
    isBeer
      ? "Beer physics: correct refraction through glass and liquid, clarity exactly as locked above, small CO2 bubbles of varied size, irregular foam with real pores and a slightly uneven top, lacing where the beer has dropped."
      : "Drink physics: correct refraction through glass and liquid, bubbles only where the product has them, no beer foam.",
    // Schaumhöhe gehört hierher (nie gekürzt) — sie ist der stärkste Hebel gegen den KI-Look.
    poured ? `Head height as a brewer serves this style: ${resolveBeerPhysics(input.bierstil).head}.` : "",
    poured ? weizenPourNote(input.bierstil, behaelter) : "",
    "Condensation only on a cold drink: droplets of varied size, some already run down — never a uniform droplet grid.",
    // Früher nur mit Hyperreal-Schalter — ohne diese Zeilen fallen Gesichter sofort in glatte KI-Haut zurück.
    "HUMAN REALISM (every visible face and hand): unretouched skin with visible pores, fine lines, small blemishes, freckles or moles, uneven redness, under-eye texture, slight shine on nose and forehead; stray and flyaway hairs, real stubble; natural imperfect teeth; asymmetric mid-moment expressions.",
    "Hands: knuckle creases, veins, nail detail, correct finger count, believable grip pressure. Ordinary everyday people, not models — no symmetric model faces, no perfect white teeth, no airbrushed or doll-like skin.",
    "Real surfaces carry wear: scratched wood grain, rings from glasses, crumbs, creased fabric, scuffed floors — never sterile CGI-clean.",
    "Neutral color and believable dynamic range; mild camera noise and real optical softness are fine.",
    "Forbidden: beauty retouch, smooth wax or plastic skin, skin-smoothing filter, HDR, teal-orange grade, lens-flare glow, plastic foam dome, sticker-like label.",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Später, kurzer Stil-Lock für das Bildmodell. Er darf nicht vom allgemeinen
 * Hyperreal-Layer oder einem vorgelagerten Prompt-Rewrite nivelliert werden.
 */
/**
 * Gegen den „reinkopiert“-Look (Flasche wie ein Sticker auf dem Foto): konkrete optische Merkmale,
 * an denen man ein echt fotografiertes Produkt erkennt. „Not a cutout“ allein reicht dem Modell nicht.
 */
/** Freitext spielt in oder an einem Fahrzeug (Auto, Bulli, Traktor, Bus …). */
export function isVehicleScene(raw: string | undefined): boolean {
  if (!raw) return false;
  return /(?:^|[^a-zäöüß])(?:auto|autos|pkw|wagen|cabrio|bulli|camper|wohnmobil|roadtrip|beifahrer(?:in)?|fahrer(?:in)?|lenkrad|traktor|bulldog|fahren|f[aä]hrt|autofahrt|car|driving|driver)(?![a-zäöüß])/i.test(raw);
}

/**
 * Werberegeln + Brauerlogik im Fahrzeug: Der Fahrer trinkt nie und hält nichts — auch bei Alkoholfrei,
 * weil das Etikett die Marke des normalen Biers trägt. Im Fahrzeug wird nicht aus dem Glas getrunken.
 */
export const VEHICLE_RULE =
  "VEHICLE RULE (MANDATORY): The driver never holds, drinks from or touches any bottle, can or glass — both hands on the steering wheel, eyes on the road. Only passengers hold the product.";
const VEHICLE_NO_GLASS = "Inside a vehicle there is no poured glass; passengers drink from the bottle or can.";

export function buildVehicleRuleFragment(input: HyperrealisticInput): string {
  if (!isVehicleScene(input.zusatzWunsch)) return "";
  // Ein Glas im Auto nur, wenn der Kunde es ausdrücklich verlangt (dann steht behaelter auf B).
  return input.behaelter === "B" ? VEHICLE_RULE : `${VEHICLE_RULE} ${VEHICLE_NO_GLASS}`;
}

export const PRODUCT_INTEGRATION_LOCK = [
  "PRODUCT IN-CAMERA INTEGRATION (MANDATORY): the bottle/can was physically in this scene when the photo was taken.",
  "Same light as the scene: identical sun/key-light direction, color temperature and contrast on the product as on the people and table — the product is never brighter, cleaner or more saturated than its surroundings and never evenly front-lit.",
  "The label is printed paper wrapped around a curved body: it follows the cylinder, text lines bend slightly with perspective, and the label darkens and compresses toward the left and right edges; label colors take on the scene's light and shade.",
  "Glass shows the environment: soft highlight streak matching the light direction, darker edges, faint reflections of the surroundings, the liquid level visible through the glass.",
  "Grounded: soft contact shadow and slight reflection where it stands on the surface; on a cold bottle, condensation also sits on the label.",
  "Same lens, focus falloff, grain and white balance as the rest of the frame — no extra-crisp product on a soft background, no hard mask edge or halo, no flat sticker, no collage.",
].join(" ");

export function buildPhotoStyleLockFragment(input: HyperrealisticInput, options?: { social?: boolean }): string {
  // Nur-Glas-Motive haben keine Flasche — der Block würde sonst eine ins Bild holen.
  const behaelter = input.behaelter ?? (input.glasTyp ? "B" : "F");
  const core = buildPhotoStyleCore(input, Boolean(options?.social));
  return behaelter === "G" ? core : `${core} ${PRODUCT_INTEGRATION_LOCK}`;
}

const LOOK_GRAMMAR_RULE =
  "LOOK references own the photographic grammar (crop, light, scale); USER SCENE only adds people, place and action inside it.";

const LOCAL_PEOPLE =
  "People are ordinary local adults, not models: mixed ages (20s to 60s), different body types, real skin with pores and wrinkles, everyday clothes with creases, mid-conversation expressions — never everyone smiling into the lens, never look-alike faces.";

function buildPhotoStyleCore(input: HyperrealisticInput, social: boolean): string {
  const style = resolvePhotoStyle(input);
  if (style === "premium") {
    return [
      `${PHOTO_STYLE_LOCK_MARKER}: QUIET PREMIUM PRODUCT PHOTOGRAPHY.`,
      LOOK_GRAMMAR_RULE,
      "The customer's product is the clear subject: sharp, label readable, in the foreground or on a real surface — photographed in a real place (beer garden, Wirtshaus, dark wood table, vaulted cellar, brewhouse), never on a studio pedestal.",
      "Calm order: few restrained props that belong to the place, one clear visual hierarchy, natural optical bokeh behind the product. 85mm perspective, steady camera, soft available light with true falloff.",
      "People are optional and secondary — soft in the background or a hand at the edge of frame, never the subject.",
      LOCAL_PEOPLE,
      "LOOK references set only calm, bokeh and light. Never reproduce a face, hair, outfit, brand, logo or lettering from them.",
      "Forbidden: direct flash, snapshot crop, product thrust toward the lens, saturated campaign color fields, studio packshot on a pedestal, beauty rim light on hair, wax skin, melted pretzel props, stock-model smiles.",
    ].join(" ");
  }
  if (style === "campaign") {
    return [
      `${PHOTO_STYLE_LOCK_MARKER}: ART-DIRECTED CAMPAIGN MOTIF.`,
      LOOK_GRAMMAR_RULE,
      "A staged campaign still with one bold idea: the product dominates the frame — handoff between hands, bottles mid-toast, low-angle hero against the sky, or overhead on grass.",
      social
        ? "FEED LAYOUT: keep product and hands in the lower 62% of the frame; the upper part stays calm (sky, wall, grass) for the headline. The product is still large and dominant inside its zone."
        : "Tight crop on hands and product; faces may be cropped out.",
      "Clear, strong light as in the LOOK references — not a cinematic sunset wash or HDR glow.",
      "The customer's labeled product is the only brand in frame. LOOK references give only scale, angle, light, gesture and material honesty — never their people, packages, logos or lettering, and never turn a bottle into a can.",
      "Forbidden: quiet bottle standing on a wooden beer-garden table, soft-focus toasting couple, pretzel/radish still life, Maßkrug postcard, beauty-retouched or wax-smooth hands, uniform sticker condensation.",
    ].join(" ");
  }
  return [
    `${PHOTO_STYLE_LOCK_MARKER}: CANDID FLASH REPORTAGE.`,
    LOOK_GRAMMAR_RULE,
    "A raw snapshot from a real beer occasion — Stammtisch, Wirtshaus, beer garden, village fest, keg tapping, garage party, brewhouse after work: friends in motion, mid-laugh, mid-sentence, looking away. Not a staged ad.",
    "Shot like a 35mm point-and-shoot with on-camera direct flash — also as fill flash in daylight: hard light on the nearest people, quick falloff into a darker background, small hard shadows, slightly blown highlights, film-snapshot color and grain.",
    "Imperfect crop: tilted frame, someone cut off at the edge, the blurred shoulder or back of another guest in the foreground, people overlapping — every limb clearly belongs to one person.",
    "The customer's product is casually part of the moment, placed or held as the user scene requires — embedded in the scene, never the polished hero and never thrust toward the lens. No additional standing bottle or table arrangement is required.",
    LOCAL_PEOPLE,
    "Invent new people every time — never reuse a face, hair, cap, tattoo, jewelry or outfit from LOOK references.",
    "Forbidden: posed smiles into the lens, studio light, soft hospitality bokeh, saturated flat campaign color fields, catalogue packshot, beauty-retouched skin, cigarettes or smoking.",
  ].join(" ");
}

export function buildHyperrealismLockFragment(
  input?: Pick<HyperrealisticInput, "contentPreset" | "photoStyle" | "stimmungTrend" | "personenModus" | "personImBild">,
): string {
  const style = input ? resolvePhotoStyle(input) : "reportage";
  const intent = style === "campaign"
    ? "Output must look like a real photographed brand campaign on a physical set — art-directed but shot on camera, never CGI."
    : style === "premium"
      ? "Output must look like premium hospitality photography in a real beer garden or dining setting, with soft natural light, restrained precision, and no CGI rendering."
      : "Output must look like a candid flash snapshot from a real beer occasion — raw, imperfectly framed, no CGI rendering.";
  if (style === "campaign") {
    return [
      "HYPERREALISM LOCK:",
      intent,
      "Prefer LOOK-reference light and materials over any cinematic grading. Keep ordinary camera response: mild noise, uneven skin, irregular condensation.",
      "Avoid sterile CGI smoothness, beauty retouch, and stock-ad glow.",
      "Do not describe this as photorealistic, ultra-detailed, high-fidelity, or professionally retouched — those words produce the AI-ad look.",
      "Strictly forbid illustration, cartoon, painting, CGI, 3D render, or stylized AI-art aesthetics.",
    ].join(" ");
  }
  if (style === "premium") {
    return [
      "HYPERREALISM LOCK:",
      intent,
      "Prefer LOOK-reference hospitality light and materials. Keep ordinary camera response: mild noise, visible pores, slight skin unevenness, irregular condensation.",
      "Quiet premium is still a real photograph — never beauty-magazine retouch or stock-ad glow.",
      "Do not describe this as photorealistic, ultra-detailed, high-fidelity, or professionally retouched — those words produce the AI-ad look.",
      "Strictly forbid illustration, cartoon, painting, CGI, 3D render, or stylized AI-art aesthetics.",
    ].join(" ");
  }
  return [
    "HYPERREALISM LOCK:",
    intent,
    "Enforce physically plausible lighting, real material response, true-to-life reflections, natural shadow penumbra, and subtle real-world imperfections.",
    "Include at least three concrete environmental micro-details and believable surface wear — avoid sterile CGI smoothness.",
    "Do not describe this as photorealistic, ultra-detailed, high-fidelity, or professionally retouched — those words produce the AI-ad look.",
    "Strictly forbid illustration, cartoon, painting, CGI, 3D render, or stylized AI-art aesthetics.",
  ].join(" ");
}

/** Eindeutiger Marker, damit der Authentizitaets-Block nicht doppelt angehaengt wird. */
export const AUTHENTICITY_MARKER = "ANTI-AI AUTHENTICITY (MANDATORY)";

/**
 * Gegen den typischen "KI-Werbebild"-Look: Der Block zwingt das Modell in eine
 * dokumentarisch-editoriale Aesthetik (Reportage statt Hochglanz-Render).
 * Wird bewusst spaet im Prompt platziert — gpt-image-2 gewichtet spaete
 * Anweisungen staerker, und der Block ueberlebt so den Claude-Rewrite.
 */
export function buildAuthenticityFragment(input: HyperrealisticInput): string {
  const modus = input.personenModus ?? (input.personImBild ? "D" : "A");
  const style = resolvePhotoStyle(input);
  const campaign = style === "campaign";
  const premiumProduct = style === "premium";
  const lines = [
    `${AUTHENTICITY_MARKER}:`,
    campaign
      ? "This must read as a real camera campaign still from a brand shoot: product-forward and staged, but with ordinary photographic texture — not a glossy AI key visual."
      : premiumProduct
        ? "This must read as real hospitality photography from a beer garden or dining set: calm, soft optical bokeh, readable drink — not a glossy AI lifestyle ad."
        : "This must read as a candid flash snapshot: raw, social, slightly imperfect, and unposed.",
    "Neutral color response and believable dynamic range — never a warm amber wash, teal-orange grading, HDR, golden-hour bloom, or beauty-retouched skin.",
    campaign
      ? "Lighting follows the LOOK references' real light (sun angle, contrast, color temperature) — not a cinematic sunset wash or beauty-dish glow. Mild highlight clip is fine; lens flare bloom is not."
      : premiumProduct
        ? "Lighting follows LOOK-reference hospitality light (window, overcast, soft evening practicals) with true falloff and some shadow. No beauty dish, no rim-light hero glow on hair, no cinematic sunset wash."
        : "Lighting is on-camera direct flash over the light of the place (fill flash by day): hard shadows, quick background falloff, slight flash hotspots are correct. No soft catalogue beauty dish.",
    campaign
      ? "The customer's product dominates the foreground — held toward the camera or filling the lower/center frame. Condensation must be sparse and irregular, never a perfect droplet grid. Not a quiet bottle standing alone on a beer-garden table."
      : premiumProduct
        ? modus === "A"
          ? "The product rests on a real surface with a natural contact shadow. Glass reflects this room, not a white studio cove. Props stay physically real — no melted pretzel mush."
          : "If the product is held or mid-toast: believable adult hands with knuckles, pores, and a firm grip; contact shadows on glass — not wax CGI hands or a cutout packshot floating in the frame."
        : "The product is casually present — in a hand, pocket of the crowd, or on a cluttered surface. People and place carry the frame; the bottle is not a centered hero packshot.",
    campaign || premiumProduct
      ? "Composition is intentional and clean, with one clear visual hierarchy; depth of field remains physically believable optical bokeh — not uniform CGI circles."
      : "Composition feels grabbed mid-moment: slight tilt, limbs may leave the frame, people may overlap — each body stays intact and separate, not carefully art-directed hierarchy.",
  ];
  if (!campaign && (modus === "B" || modus === "C")) {
    lines.push(
      "Visible hands are real adult hands: knuckles, pores, veins, slightly imperfect skin, a firm believable grip — not smooth CGI, not beauty-retouched.",
    );
  }
  if (!campaign && (modus === "D" || modus === "E")) {
    lines.push(
      premiumProduct
        ? "People are ordinary guests, not models: visible pores, slight skin unevenness, stray hairs, natural imperfect teeth, asymmetric mid-moment expressions. Soft hospitality light is fine — beauty-filter wax skin and perfect stock smiles are not."
        : "People look like friends caught mid-moment: uneven flash-lit skin, stray hairs, mid-gesture faces, someone looking away or half out of frame. No beauty-filter, no posed stock-photo smile toward the lens.",
    );
  }
  if (campaign && (modus === "B" || modus === "C" || modus === "D" || modus === "E")) {
    lines.push(
      "Hands and people stay physically real: visible knuckles, pores, veins, slight skin unevenness, firm believable grip — never wax-smooth CGI hands or beauty-filter faces. Energetic campaign pose is fine; plastic stock-model skin is not.",
    );
  }
  return lines.join(" ");
}

export function ensureHyperrealismDirectives(prompt: string, input: HyperrealisticInput): string {
  let next = prompt.trim();
  const lower = next.toLowerCase();

  if (!/high-fidelity photorealistic|hyperrealism lock|indistinguishable from a real camera/i.test(lower)) {
    next = `${buildHyperrealismLockFragment(input)}\n\n${next}`;
  }

  if (!/liquid physics|srm \d|approx\. hex/i.test(lower)) {
    const behaelter = input.behaelter ?? (input.glasTyp ? "B" : "F");
    next = `${next}\n\n${buildLiquidPhysicsFragment(input, behaelter)}`;
  }

  if (!/scene texture anchors|micro-realism/i.test(lower)) {
    next = `${next}\n\n${buildSceneTextureAnchors(input.szene)}`;
  }

  const modus = input.personenModus ?? (input.personImBild ? "D" : "A");
  if (modus !== "A" && !/human realism|waxy plastic skin|artifact-free/i.test(lower)) {
    next = `${next}\n\n${buildHumanRealismFragment(input)}`;
  }

  if (!/shot on.*full-frame|canon eos|35mm|50mm|85mm|100mm/i.test(lower)) {
    next = `${next}\n\nCAMERA: ${buildCameraFragment(input.shotType, input.aspectRatio, input)}`;
  }

  if (!/cgi|3d render|plastic-looking foam|waxy plastic skin/i.test(lower.slice(-600))) {
    next = `${next}\n\nNEGATIVE (hyperreal): ${HYPERREALISM_NEGATIVE}`;
  }

  if (!next.includes(GLASS_SHAPE_LOCK_MARKER)) {
    const glassLock = buildGlassShapeLockFragment(input);
    if (glassLock) next = `${next}\n\n${glassLock}`;
  }

  // Immer spaet anhaengen: dokumentarische Authentizitaet gegen den KI-Werbe-Look.
  if (!next.includes(AUTHENTICITY_MARKER)) {
    next = `${next}\n\n${buildAuthenticityFragment(input)}`;
  }

  if (!next.includes(LABEL_LOCK_MARKER)) {
    const labelLock = buildLabelLockFragment(input);
    if (labelLock) next = `${next}\n\n${labelLock}`;
  }

  return next.trim();
}
