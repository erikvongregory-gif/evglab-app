import { FLASCHEN_TYPEN, GLAS_TYPEN, containerMaterialPhrase, flascheVolumeMl, glassPourPromptDescription, isDoseTyp, pouredGlassFillMl } from "../brewing-knowledge";
import type { HyperrealisticInput } from "../schemas";
import { sanitizeProduktKategorie, type ProduktKategorie } from "@/lib/dashboard/metadata";

type BeerPhysicsProfile = {
  srm: string;
  hex: string;
  liquid: string;
  foam: string;
  carbonation: string;
};

const BEER_PHYSICS: Record<string, BeerPhysicsProfile> = {
  helles: {
    srm: "3–5",
    hex: "#F8D975",
    liquid: "crystal-clear pale golden lager with warm glow-through when backlit",
    foam: "dense ivory-white foam crown with fine uniform pores and delicate lacing on glass walls",
    carbonation: "fine ascending pearl-like bubbles in steady streams",
  },
  pils: {
    srm: "2–4",
    hex: "#F5E08A",
    liquid: "brilliant pale straw-gold Pilsner with crystal clarity and crisp brilliance",
    foam: "tight compact brilliant-white foam cap with micro-fine pores and clean lacing rings",
    carbonation: "lively fine carbonation with crisp ascending bubble trails",
  },
  hefeweizen: {
    srm: "4–6",
    hex: "#F5A623",
    liquid: "hazy golden-orange wheat beer with natural yeast turbidity and warm glowing opacity",
    foam: "towering fluffy white foam head with large irregular pores, spectacular retention, never plastic-dome shaped",
    carbonation: "vigorous effervescent streams rising through the haze",
  },
  kristallweizen: {
    srm: "3–5",
    hex: "#F0C850",
    liquid: "crystal-clear filtered golden wheat beer with brilliant clarity",
    foam: "firm white foam cap with moderate retention and natural irregular edge",
    carbonation: "steady medium-fine carbonation streams",
  },
  maerzen: {
    srm: "9–14",
    hex: "#C87941",
    liquid: "warm burnished copper-amber Märzen with deep orange-copper glow and ruby edge in backlight",
    foam: "firm dense white foam crown with good retention, traditional Bavarian head",
    carbonation: "steady medium carbonation with natural bubble trails",
  },
  kellerbier: {
    srm: "8–12",
    hex: "#D4A850",
    liquid: "naturally cloudy hazy pale golden-amber Kellerbier with gentle yeast turbidity",
    foam: "soft hazy off-white foam with rustic texture and moderate retention",
    carbonation: "low to moderate gentle carbonation bubbles",
  },
  bock: {
    srm: "14–22",
    hex: "#9B5523",
    liquid: "rich deep amber to dark copper-brown Bock with warm chestnut tones and ruby edge glow",
    foam: "moderate dense off-white to cream foam, thick and persistent",
    carbonation: "moderate smooth carbonation streams",
  },
  koelsch: {
    srm: "3–5",
    hex: "#F8D975",
    liquid: "pale straw-gold Kölsch with brilliant clarity",
    foam: "delicate thin white foam cap, quickly dissipating, minimal lacing",
    carbonation: "moderate fine carbonation, clean streams",
  },
  altbier: {
    srm: "11–19",
    hex: "#9B4521",
    liquid: "deep amber to copper-brown Altbier with warm reddish-copper tones",
    foam: "tight compact tan-white foam with moderate retention",
    carbonation: "moderate fine carbonation, clean streams",
  },
  ipa: {
    srm: "8–14",
    hex: "#D4843A",
    liquid: "deep amber to copper IPA with slight haze and warm orange-amber clarity",
    foam: "moderate off-white foam with medium pores and light sticky lacing",
    carbonation: "moderate effervescence with scattered bubble trails",
  },
  neipa: {
    srm: "4–7",
    hex: "#F5C842",
    liquid: "opaque pale citrus-yellow hazy NEIPA with dense unfiltered protein haze and juicy opacity",
    foam: "soft pillowy white foam with silky texture and moderate retention",
    carbonation: "gentle lazy carbonation with soft bubble clusters visible through haze",
  },
  stout: {
    srm: "35–40+",
    hex: "#160800",
    liquid: "opaque jet-black stout with absolutely no light transmission, velvety black body",
    foam: "thick velvety cream-colored mousse-like nitrogen foam with extremely fine texture",
    carbonation: "minimal surface carbonation with occasional slow bubbles, nitrogen cascade feel",
  },
  porter: {
    srm: "25–30",
    hex: "#3D1105",
    liquid: "deep mahogany-brown porter with ruby-garnet edge translucency when backlit",
    foam: "thin tan-brown foam layer with medium pores",
    carbonation: "gentle steady carbonation streams",
  },
  saison: {
    srm: "5–14",
    hex: "#E0A030",
    liquid: "golden to amber saison with light rustic yeast haze and warm golden turbidity",
    foam: "dense fluffy white foam with large pores, very high retention, Belgian-style rocky head",
    carbonation: "vigorous fine streams, lively effervescence",
  },
  radler: {
    srm: "2–5",
    hex: "#FAE86B",
    liquid: "hazy pale golden-lemon Radler with cloudy lemon-gold body and subtle citrus particles",
    foam: "light bubbly white foam, quickly fading",
    carbonation: "sparkling lively effervescence",
  },
  alkoholfrei_pilsner: {
    srm: "3–4",
    hex: "#F8E080",
    liquid: "brilliant pale golden alcohol-free Pilsner, clean and fresh straw gold",
    foam: "light airy white foam with moderate retention",
    carbonation: "crisp lively micro-bubbles",
  },
};

const CAMERA_BY_SHOT: Record<NonNullable<HyperrealisticInput["shotType"]>, string> = {
  A: "Handheld Canon EOS R6, 50mm at f/4, slight 45° angle, available light, product sharp, background naturally falling off — not cinematic bokeh",
  B: "Handheld Canon EOS R6, 50mm at f/4, eye-level, natural perspective, label fully sharp",
  C: "Handheld Canon EOS R6, 35mm at f/4, slight low angle, physically plausible perspective, no superhero tilt",
  D: "Handheld Canon EOS R6, 50mm at f/5.6, top-down, natural shadow falloff",
  E: "Handheld Canon EOS R6, 85mm at f/4, close-up of glass, condensation and label texture, thin but honest focal plane",
  F: "Handheld Canon EOS R6, 35mm at f/5.6, wide environmental framing, authentic venue scale",
  G: "Aerial drone perspective at moderate altitude, 24mm equivalent, realistic geometry",
  H: "Over-shoulder handheld, 35mm at f/2.8, first-person, believable hand scale, slight motion of a real hold",
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
      carbonation: "natural carbonation bubbles with varied size and spacing",
    }
  );
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
  if (/hefeweizen|kellerbier|neipa|zwickel|rauchbier/.test(stil)) return "trueb";
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
      ? `visibly NATURTRÜB / UNFILTERED beer in ${profile.hex} gold — dense soft yeast haze, milky-cloudy opacity like Kellerbier or Hefeweizen, light scatters in the body so you cannot see sharp detail through the liquid, NEVER crystal-clear filtered lager`
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
    `Foam: ${profile.foam}.`,
    `Carbonation: ${profile.carbonation}.`,
    "Glass: ordinary real glass. Highlights come from this room (window, sky, lamps), not a studio HDRI. Reflections show the actual setting. Condensation only if the drink is cold — sparse, irregular, some droplets already slid.",
    "Condensation: fine irregular perspiration droplets with varied size and spacing slowly sliding down chilled glass — never uniform sticker dots.",
    "Avoid unnaturally stiff, plastic-looking, or perfectly symmetrical foam domes.",
  ].join(" ");
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

function lemonadeColorFromName(bierstil: string): string {
  const key = bierstil.trim().toLowerCase();
  if (/\bspezi\b/.test(key)) return "cola-orange Spezi color matching the product label/photo";
  if (/\bcola\b/.test(key)) return "dark cola-brown matching the product label/photo";
  if (/orange/.test(key)) return "orange lemonade color matching the product label/photo";
  if (/zitrone|lemon/.test(key)) return "pale lemon lemonade color matching the product label/photo";
  return "lemonade color taken only from the product label/photo — do not invent beer amber or hops";
}

function waterCarbonationFromName(input: HyperrealisticInput): string {
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
      ? "Full-frame camera, 24–35mm lens at f/5.6, ISO 100, low or forced perspective with the product dominant in frame"
      : style === "premium"
        ? "Full-frame camera, 85mm lens at f/5.6, ISO 100, controlled product focus with natural optical falloff"
        : "Handheld compact or full-frame camera, 28–35mm lens at f/2.8–f/5.6, ISO 400–1600, candid snapshot framing with imperfect edges";
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
 * Wird bewusst spät im Prompt platziert, da gpt-image-2 spätere Anweisungen
 * stärker gewichtet — und überlebt so auch den Claude-Rewrite.
 */
export function buildBottleShapeLockFragment(input: HyperrealisticInput): string {
  const behaelter = input.behaelter ?? (input.glasTyp ? "B" : "F");
  if (behaelter === "G") return "";
  const flasche = FLASCHEN_TYPEN[input.flaschenTyp];
  if (!flasche) return "";
  const istDose = isDoseTyp(input.flaschenTyp);
  const istSchraub = flasche.closure === "schraub";
  const noun = istDose ? "aluminium beverage can" : "bottle";
  const nounCap = istDose ? "Can" : "Bottle";
  const colorClause = istDose ? "" : `, made of ${containerMaterialPhrase(input.flaschenTyp, input.flaschenfarbe)}`;
  const poured = isPouredGlassServing(input);
  const drink = beverageDrinkNoun(input);
  const isBeer = inputProduktKategorie(input) === "bier";
  const litres = flascheVolumeMl(input.flaschenTyp) / 1000;
  const openServing = poured
    ? istDose
      ? `OPEN SERVING (overrides any catalog 'sealed' wording): ${isBeer ? "beer" : drink} is already poured, so the can MUST be opened with the stay-tab pulled — never an unopened sealed can next to a full glass.`
      : istSchraub
        ? `OPEN SERVING (overrides any catalog 'sealed' wording): ${isBeer ? "beer" : drink} is already poured into a glass, so the bottle mouth MUST be uncapped — no screw cap on the mouth. The screw cap may rest on the table, never on the bottle.`
        : `OPEN SERVING (overrides any catalog 'sealed with crown cap' wording): ${isBeer ? "beer" : drink} is already poured into a glass, so the bottle mouth MUST be uncapped — no crown cap, no cork, no foil on the mouth. The crown cap may rest on the table, never on the bottle.`
    : "";
  return [
    `${BOTTLE_SHAPE_LOCK_MARKER}:`,
    `The ${noun} MUST be ${bottleGeometryPrompt(input, flasche.promptDescription)}${colorClause}.`,
    `${nounCap} shape and size are defined by this specification — ${flasche.forbidden}.`,
    openServing,
    poured
      ? `EXACTLY ONE ${noun} of this product in the frame: the ${noun} being poured from (or standing open next to the glass) IS the product — never add a second, extra ${noun} beside it.`
      : "",
    `If a bottle-shape reference photo is attached, copy that silhouette, neck length, shoulder and proportions exactly.`,
    `If the product photo shows several bottles/sizes side by side, the product here is ONLY the ${litres} L one — ignore the other sizes completely (their height, label and closure).`,
    smallSizeCue(input.flaschenTyp, noun),
    `Label/artwork photos only supply printed graphics to apply onto this ${noun} — they must not replace the ${noun} with a different type.`,
    `Bottles, cans or glasses visible in LOOK/style references are NOT this product — never copy their shape, neck or shoulder.`,
    `Render the ${noun} at physically correct real-world scale so its ${litres} L size is unmistakable.`,
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

const GLASS_FORBIDDEN: Record<NonNullable<HyperrealisticInput["glasTyp"]>, string> = {
  willibecher:
    "NOT a stemmed Pilsner flute or tulip, NOT a curvy Weizen vase, NOT a Maßkrug with handle, NOT a Teku, NOT a Kölsch Stange, NOT an American shaker pint, NOT a straight highball/water tumbler",
  pils_tulpe:
    "NOT a stemless Willibecher tumbler, NOT a Weizen vase, NOT a Maßkrug, NOT a Teku, NOT a shaker pint, NOT a cylindrical water glass",
  weizen: "NOT a Willibecher tumbler, NOT a stemmed Pilsner flute, NOT a Maßkrug, NOT a Stange, NOT a shaker pint",
  masskrug: "NOT a Willibecher, NOT a Pilsner flute, NOT a Weizen vase, NOT a stemless tumbler without handle",
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
  "LABEL ORIENTATION (PHYSICAL, MANDATORY — INVALID IF VIOLATED): Treat the label as already glued on the real bottle from Image 1. Anchor A = the label edge that faces the NECK/shoulder on the reference; Anchor B = the label edge that faces the HEEL/base on the reference. In EVERY pose (standing, tilted, pouring) Anchor A stays toward the neck and Anchor B toward the base — the printed artwork rotates with the glass body, never independently. During pouring the brand text MAY appear upside-down or sideways to the camera; that is REQUIRED and correct. FORBIDDEN: flipping/rotating the label so text reads upright to the camera while the bottle is tilted; upside-down label relative to the bottle base; mirrored label. Prefer a pour tilt of about 45–70° from upright (not a full base-to-sky invert) so orientation stays unambiguous.";

export function buildLabelLockFragment(input: HyperrealisticInput): string {
  if ((input.etikettModus ?? "marke") !== "marke") return "";
  const product = input.beerName?.trim();
  const noun = isDoseTyp(input.flaschenTyp) ? "can" : "bottle";
  return [
    `${LABEL_LOCK_MARKER}:`,
    product ? `The attached reference photo IS the product "${product}".` : "The attached reference photo IS this exact product.",
    `If the reference shows more than one ${noun}, copy the artwork of only one of them — never blend two labels into one.`,
    "Label text stays clean and correctly spelled exactly as on the reference; no warped, smeared, doubled or invented letters, no text running in a different direction than on the reference.",
    `Copy the printed ${noun} artwork 1:1 — same logo, same crest, same typography, same colors, same layout, same words.`,
    "Do not redesign, restyle, recolor, translate, abbreviate, or invent a variant (no new names, no extra badges, no swapped colorways).",
    "Every letter that is readable on the reference must appear the same on the generated label.",
    isDoseTyp(input.flaschenTyp) ? "" : LABEL_ORIENTATION_LOCK,
    inputProduktKategorie(input) === "bier"
      ? "The result is a new photograph of that same physical product in a new scene — not a collage and not a different beer."
      : "The result is a new photograph of that same physical product in a new scene — not a collage and not a different drink.",
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
      ? `POUR VOLUME: the glass is a single pour from this ${bottleMl / 1000} L bottle/can (${fillMl} ml). It must look like it was filled from that one container — never a larger mug.`
      : "";
  return [
    `${GLASS_SHAPE_LOCK_MARKER} — INVALID IF WRONG GLASS:`,
    `Selected glass type code: ${input.glasTyp} (${glas.label}).`,
    isBeer
      ? `Every beer glass in frame MUST be exactly ${pour}.`
      : `Every glass in frame MUST be exactly ${withoutBeerFoam(pour)}. Liquid is ${drink}; do not render beer foam or hop haze.`,
    `${GLASS_FORBIDDEN[input.glasTyp]}.`,
    input.glasTyp !== "willibecher"
      ? "ANTI-DEFAULT: Models often fall back to a German Willibecher / conical tumbler for beer pours — that is FORBIDDEN here. Match the selected glass silhouette instead."
      : "",
    volumeLock,
    "If a glass-shape reference image is attached, copy that silhouette and proportions exactly (stem, foot, bowl, height). Do not substitute any other glass type.",
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
      "Sorten-Filtrierung = unfiltriert. Every poured beer in frame MUST be densely NATURTRÜB.",
      "Look: cloudy Kellerbier / Zwickelbier — milky-golden yeast haze, soft turbidity, nearly opaque body like unfiltered wheat beer.",
      "Light scatters inside the liquid; the far glass wall and background must NOT read sharply through the beer.",
      "IMAGE-1 LIQUID OVERRIDE (MANDATORY): The product photo may show clear beer through bottle glass — IGNORE that completely.",
      "Do NOT copy Image 1 bottle-liquid clarity, transparency, or filtered-lager look into the poured glass.",
      "Poured beer clarity is locked by this text (and by any LIQUID reference image), never by Image 1.",
      "Style words like Helles/Lager must NOT make the pour crystal-clear — this pour is unfiltered and cloudy.",
      "FORBIDDEN: crystal-clear filtered lager, water-like transparency, brilliant see-through gold, Pils clarity, reading bubbles as sharp dots through the full glass depth.",
    ].join(" ");
  }
  return [
    `${UNFILTERED_LIQUID_LOCK_MARKER} — INVALID IF CLOUDY:`,
    "Sorten-Filtrierung = filtriert. The poured beer MUST look crystal-clear and filtered.",
    "FORBIDDEN: naturtrüb cloudiness, milky opacity, unfiltered haze.",
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
const SWING_TOP_OPEN = [
  "the swing-top OPEN, built exactly like a real German Bügelverschluss: ONE thin wire ring clamped around the neck just below the lip, TWO thin parallel wire arms hinged on that ring, and at their end ONE white porcelain stopper with its rubber gasket",
  "— in the open state the arms are swung back over the lip and the stopper hangs down against the side of the neck by gravity (on a tilted pouring bottle it dangles below the neck, beside the beer stream, never in it)",
  "— count: exactly ONE stopper in ONE color (as on the reference), exactly ONE wire bail; the round bottle mouth is completely free; wires are smooth, symmetric and attached; NO second wire loop, NO extra stopper, NO two stoppers of different colors, NO twisted, tangled or doubled wire, NO stopper standing upright on top of the bottle, NOT covering the neck label",
].join(" ");

/** Hand an Flasche: Finger liegen außen am Glas — nie durch das Glas sichtbar oder im Etikett „versunken“. */
export const HAND_BOTTLE_CONTACT =
  "HAND–BOTTLE CONTACT: any hand holding the bottle wraps its fingers and thumb around the OUTSIDE of the bottle body and rests on the glass surface, in front of or beside the label. The bottle glass is solid and opaque to the hand: no finger, thumb or part of a hand is ever inside the bottle or seen through the glass, nothing merges or fuses into the bottle, and the label is never printed over, under or through a finger. Natural five-finger pouring grip with contact shadows.";

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
  const capNever = istSchraub
    ? "a screw cap must NEVER sit on the bottle mouth — not even copied from a sealed product photo. The screw cap may lie on the table beside the bottle; the bottle lip is open and empty."
    : "a crown cap must NEVER sit on the bottle mouth — not even copied from a sealed product photo. The metal crown cap may lie on the table beside the bottle; the bottle lip is open and empty.";

  const modus = input.personenModus ?? (input.personImBild ? "D" : "A");
  const pluralNoun = istDose ? "cans" : "bottles";
  const lines: string[] = [`${CLOSURE_LOGIC_MARKER}, physical drinking consistency:`];
  // Auch ohne gewählten Personen-Modus: Freitext-Szenen („jemand schenkt ein“) bringen Hände mit.
  lines.push(HAND_BOTTLE_CONTACT);

  // Glas eingeschenkt + Flasche → Gebinde wurde bereits geöffnet.
  if (behaelter === "B") {
    const drink = beverageDrinkNoun(input);
    const isBeer = inputProduktKategorie(input) === "bier";
    lines.push(
      isBeer
        ? `The adjacent beer glass is already poured, therefore the ${noun} MUST be shown ALREADY OPENED with ${openState}.`
        : `The adjacent glass is already poured, therefore the ${noun} MUST be shown ALREADY OPENED with ${openState}.`,
      `HARD RULE: once ${isBeer ? "beer" : drink} has been poured into a glass, ${capNever}`,
      `Never show a sealed ${noun} (${closureWord}) standing next to a full poured glass.`,
    );
  }

  // Gruppe, die anstößt/prostet → alle hochgehaltenen Gebinde sind offen.
  if (modus === "E") {
    lines.push(
      `When people raise, clink or toast (Anstoßen / Prost / cheers) the ${pluralNoun} together, EVERY raised and clinked ${noun} MUST be OPEN — show ${openState}. Toasting or clinking with sealed, unopened ${pluralNoun} (${closureWord}) is physically wrong and FORBIDDEN.`,
    );
  }

  lines.push(
    `If a person is drinking from, lifting, raising, clinking or toasting the ${noun} toward their lips or with others, the ${noun} MUST already be OPEN — show ${openState}. Drinking from, or toasting/clinking with, a still-sealed ${noun} (${closureWord}) is physically impossible and FORBIDDEN.`,
    `Only show a fully sealed/closed ${noun} for an untouched unopened product shot where nobody is drinking, raising or clinking and no poured glass is present.`,
  );

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

/**
 * Später, kurzer Stil-Lock für das Bildmodell. Er darf nicht vom allgemeinen
 * Hyperreal-Layer oder einem vorgelagerten Prompt-Rewrite nivelliert werden.
 */
/**
 * Gegen den „reinkopiert“-Look (Flasche wie ein Sticker auf dem Foto): konkrete optische Merkmale,
 * an denen man ein echt fotografiertes Produkt erkennt. „Not a cutout“ allein reicht dem Modell nicht.
 */
export const PRODUCT_INTEGRATION_LOCK = [
  "PRODUCT IN-CAMERA INTEGRATION (MANDATORY): the bottle/can was physically in this scene when the photo was taken.",
  "Same light as the scene: identical sun/key-light direction, color temperature and contrast on the product as on the people and table — the product is never brighter, cleaner or more saturated than its surroundings and never evenly front-lit.",
  "The label is printed paper wrapped around a curved body: it follows the cylinder, text lines bend slightly with perspective, and the label darkens and compresses toward the left and right edges; label colors take on the scene's light and shade.",
  "Glass shows the environment: soft highlight streak matching the light direction, darker edges, faint reflections of the surroundings, the liquid level visible through the glass.",
  "Grounded: soft contact shadow and slight reflection where it stands on the surface; condensation drops also sit on top of the label.",
  "Same lens, focus falloff, grain and white balance as the rest of the frame — no extra-crisp product on a soft background, no hard mask edge or halo, no flat sticker, no collage.",
].join(" ");

export function buildPhotoStyleLockFragment(input: HyperrealisticInput): string {
  // Nur-Glas-Motive haben keine Flasche — der Block würde sonst eine ins Bild holen.
  const behaelter = input.behaelter ?? (input.glasTyp ? "B" : "F");
  return behaelter === "G" ? buildPhotoStyleCore(input) : `${buildPhotoStyleCore(input)} ${PRODUCT_INTEGRATION_LOCK}`;
}

function buildPhotoStyleCore(input: HyperrealisticInput): string {
  const style = resolvePhotoStyle(input);
  if (style === "premium") {
    return [
      `${PHOTO_STYLE_LOCK_MARKER}: PREMIUM HOSPITALITY PHOTOGRAPHY.`,
      "LOOK references own the photographic grammar. Freitext only adds people/action — never override LOOK crop, light, or product scale.",
      "Shoot a quiet premium lifestyle frame in a real beer garden or hospitality setting — natural available light, soft optical bokeh, ordered calm.",
      "Keep the customer's product label in focus and readable — photographed with the same lens and light as the scene, not pasted on top; people may share the frame but stay secondary to the drink.",
      "Use an 85–100mm perspective, stable camera, restrained props, and an orderly visual hierarchy — no clutter, no flash snapshot energy.",
      "LOOK references set only this grammar: soft bokeh, warm daylight, hospitality social calm, crisp glass/bottle materials. Invent new adults. Never reproduce a face, hair, age, or outfit from a LOOK reference, and never copy their brands, logos, or lettering.",
      "Match LOOK light as photographed — not an HDR golden-hour stock glow or beauty rim light on hair.",
      "PEOPLE IN PREMIUM are ordinary local guests photographed candidly, not models: mixed ages (20s to 60s), different body types, faces and hair; real skin with pores, wrinkles, redness, uneven beard growth and stray hairs; everyday clothes with creases; relaxed mid-conversation expressions — a half smile, a glance away, mouth mid-word — never everyone laughing open-mouthed at once.",
      "Out-of-focus people still keep real optical blur of real faces and fabric — not smooth painted smudges, not a row of look-alike handsome bearded men.",
      "Forbidden AI-gloss: beauty-retouched wax skin, melted pretzel props, uniform sticker condensation, teal-orange grade, lens-flare bloom, plastic foam, perfect stock-model smiles, symmetrical model faces, identical faces, glowing skin.",
      "Forbidden: on-camera direct flash, imperfect street crop, product thrust toward the lens, saturated flat campaign color fields, studio packshot on a pedestal.",
    ].join(" ");
  }
  if (style === "campaign") {
    return [
      `${PHOTO_STYLE_LOCK_MARKER}: ART-DIRECTED CAMPAIGN MOTIF.`,
      "LOOK references own the photographic grammar. Freitext only adds people/action — never override LOOK crop, light, or product scale with a beer-garden toast postcard.",
      "Match the LOOK references' grammar exactly: product fills a large share of the frame — handoff, can/bottle toast, low-angle hero, or overhead sky toast.",
      "Copy LOOK light character and contrast as photographed — not an HDR/golden-hour CGI glow. Tight crop on hands and product; faces may be cropped out.",
      "The customer's labeled product is the only brand in frame and must dominate the silhouette.",
      "LOOK references: copy only scale, angle, light, gesture, and material honesty. Never copy their people, packages, logos, or lettering.",
      "Forbidden AI-gloss: beauty-retouched skin, wax-smooth faces/hands, uniform sticker condensation, teal-orange grade, lens bloom, oversaturated sky, plastic foam.",
      "Forbidden (this is Premium, not Campaign): quiet bottle standing on a wooden beer-garden table, soft-focus toasting couple in the background, pretzel/radish still life, Maßkrug postcard, church-tower hospitality bokeh.",
    ].join(" ");
  }
  return [
    `${PHOTO_STYLE_LOCK_MARKER}: CANDID REPORTAGE.`,
    "LOOK references own the photographic grammar. Freitext only adds people/action — never override LOOK flash character or imperfect crop with soft hospitality bokeh.",
    "Shoot a raw observed nightlife or street-life moment: friends in motion, imperfect crop, someone mid-laugh or mid-stride — not a staged ad.",
    "Prefer on-camera direct flash or harsh available neon/street light with deep falloff; hard shadows and slight overexposure on faces are welcome.",
    "The customer's product appears casually in hand, on a messy table, or in the crowd — embedded in the event, never the polished hero of the frame.",
    "LOOK references set only flash character, candid energy, and imperfect framing. Invent entirely new fictional adults every time — vary age, gender presentation, and appearance.",
    "Never reuse a face, skin tone, hair, baseball cap, neck tattoo, jewelry, or outfit from LOOK references.",
    "Forbidden: product thrust toward the lens, saturated flat campaign color fields, quiet catalogue packshot, beauty-retouched skin, controlled studio set, repeating the same person across images.",
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
      : "Output must look like a candid flash or street-reportage photograph from a real night out, with imperfect framing and no CGI rendering.";
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
        : "This must read as a candid snapshot or street-reportage frame: raw, social, slightly imperfect, and unposed.",
    "Neutral color response and believable dynamic range — never a warm amber wash, teal-orange grading, HDR, golden-hour bloom, or beauty-retouched skin.",
    campaign
      ? "Lighting follows the LOOK references' real light (sun angle, contrast, color temperature) — not a cinematic sunset wash or beauty-dish glow. Mild highlight clip is fine; lens flare bloom is not."
      : premiumProduct
        ? "Lighting follows LOOK-reference hospitality light (window, overcast, soft evening practicals) with true falloff and some shadow. No beauty dish, no rim-light hero glow on hair, no cinematic sunset wash."
        : "Lighting is on-camera direct flash or harsh available street/neon/practical light with deep background falloff. Hard shadows and slight flash hotspots are correct. No soft catalogue beauty dish.",
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
        : "People look like friends on a night out: uneven flash-lit skin, stray hairs, mid-gesture faces, someone looking away or half out of frame. No beauty-filter, no posed stock-photo smile toward the lens.",
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
