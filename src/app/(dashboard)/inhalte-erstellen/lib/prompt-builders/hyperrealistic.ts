import { FLASCHEN_TYPEN, GLAS_TYPEN, flascheVolumeMl, glassPourPromptDescription, isDoseTyp, pouredGlassFillMl } from "../brewing-knowledge";
import type { HyperrealisticInput } from "../schemas";
import {
  buildBeerPhysicsFragment,
  buildBottleShapeLockFragment,
  buildCameraFragment,
  buildClosureLogicFragment,
  buildGlassShapeLockFragment,
  buildHumanRealismFragment,
  buildHyperrealismLockFragment,
  buildAuthenticityFragment,
  buildSceneTextureAnchors,
  HYPERREALISM_NEGATIVE,
} from "./hyperrealism-blocks";

const SZENE_DESCRIPTIONS = {
  biergarten_sommer:
    "traditional German Biergarten, wooden bench and table, gravel ground, chestnut tree shade with dappled sunlight, other guests blurred in background",
  wirtshaus_innen: "cozy Bavarian Wirtshaus interior, dark wood paneling, warm tungsten lighting, checkered tablecloth",
  kueche_zuhause: "modern home kitchen, marble countertop, soft window light",
  wiese_picknick: "summer meadow picnic, blanket, wildflowers, soft natural light",
  strand_sonnenuntergang: "beach at sunset, warm golden light, gentle waves in background",
  alpenpanorama: "alpine mountain hut terrace, snow-capped peaks in background, crisp blue sky",
  stadtbalkon_abend: "urban balcony at dusk, city in the background, mixed evening light",
  brauereihof: "brewery courtyard, copper brewing kettles visible in background, industrial-rustic atmosphere",
  fussball_public_viewing:
    "outdoor football public viewing party (German Fanmeile / WM or EM watch event), large LED screen or projector showing a live football match clearly visible in background, fans in jerseys or scarves cheering, standing and seated crowd, screen glow on faces — NOT a Biergarten, NOT a cozy Wirtshaus interior",
} as const;

const TAGESZEIT_LIGHTING = {
  goldene_stunde: "late-afternoon sunlight with natural color temperature, long soft shadows — not a cinematic orange grade",
  mittag: "bright midday sunlight, slight haze, hard-ish shadows",
  abend_warm: "warm evening mixed light from sky and nearby lamps, not studio fill",
  blaue_stunde: "blue-hour twilight, cool ambient with a bit of warm practical light",
} as const;

const STIMMUNG_TREND_PROMPT = {
  nachhaltig:
    "rustic craft atmosphere, earth tones, muted greens, natural brown, honey-yellow palette, farm-to-brew authenticity",
  modern:
    "quiet contemporary mood, concrete grey, daylight whites, one brand accent, calm interior — not a geometry catalog",
  nostalgie:
    "nostalgic Bavarian beer-hall mood, slight sepia warmth, deep gold accents, analog grain",
  aktiv:
    "fresh outdoor daylight, citrus yellow and sky blue, energetic but unstyled",
  premium:
    "quiet premium interior, dark materials, restrained color, real room light — not a jewelry-ad spotlight",
} as const;

const SHOT_TYPE_PROMPT = {
  A: "slight 45° angle, ordinary documentary framing — not a commercial hero poster",
  B: "eye-level frontal shot, natural perspective",
  C: "slight low angle, physically plausible, not superhero",
  D: "top-down view, naturally arranged, not a graphic poster",
  E: "close-up of foam, condensation and label",
  F: "wide environmental shot of the real venue",
  G: "drone / aerial top-down perspective",
  H: "over-the-shoulder handheld, first-person hold",
} as const;

const PERSON_FRAGMENTS = {
  A: "No people, no hands, no human presence — product only.",
  B: "Real adult hands holding the glass or bottle, cropped at the wrist, no face — knuckles and skin texture visible, believable grip.",
  C: "A person visible from behind, face turned away, body silhouette only.",
} as const;

function groupSettingPhrase(input: HyperrealisticInput): string {
  return `in ${SZENE_DESCRIPTIONS[input.szene]}`;
}

function groupSeatedPhrase(szene: HyperrealisticInput["szene"]): string {
  if (szene === "fussball_public_viewing") {
    return "sitting on picnic benches or standing among fans";
  }
  if (szene === "biergarten_sommer" || szene === "wirtshaus_innen" || szene === "brauereihof") {
    return "sitting together at a rustic wooden table";
  }
  return "sitting together";
}

function buildBrandLockFragment(input: HyperrealisticInput, breweryName?: string): string {
  if ((input.etikettModus ?? "marke") !== "marke" || !breweryName?.trim()) return "";
  const brand = breweryName.trim();
  const behaelter = input.behaelter ?? (input.glasTyp ? "B" : "F");
  if (behaelter === "G") {
    return `
GLASS BRAND LOCK (MANDATORY): Every beer glass in frame MUST display the "${brand}" logo/branding (etched or printed on glass), matching reference label artwork — correct colors, legible typography.
FORBIDDEN: plain unbranded glasses, wrong brewery names on glass, fictional brands, missing logos.
COMPOSITION: GLASS ONLY — no bottle, no can, no packaging anywhere in the image.`;
  }
  const brandSurface = isDoseTyp(input.flaschenTyp) ? "can wrap-around artwork" : "bottle label";
  const brandVessel = isDoseTyp(input.flaschenTyp) ? "can" : "bottle";
  return `
BRAND IDENTITY LOCK (MANDATORY): Every visible brand touchpoint — ${brandSurface}, glass logo/etching, coasters, napkins, signage — MUST show "${brand}" only, matching the reference label artwork.
FORBIDDEN: any other brewery names, fictional brands, wrong logos on glasses (e.g. random text like "Brauhaus Weißbach"), unbranded glasses when a branded ${brandVessel} is present, or mixed competing brands in one frame.
All beer glasses in frame must carry the same "${brand}" branding as the ${brandVessel} — consistent logo placement, legible, not distorted.`;
}

function buildPersonFragment(input: HyperrealisticInput, behaelter: NonNullable<HyperrealisticInput["behaelter"]>): string {
  // Legacy-Kompat: ältere Aufrufer ohne personenModus aber mit personImBild + Freitext.
  if (!input.personenModus && input.personImBild && input.personBeschreibung) {
    return `A person (${input.personBeschreibung}) holding or sitting next to the bottle, natural authentic body language, no posing.`;
  }
  const modus = input.personenModus ?? (input.personImBild ? "D" : "A");
  if (modus === "A" || modus === "C") {
    return PERSON_FRAGMENTS[modus];
  }
  if (modus === "B") {
    if (behaelter === "G") {
      return "Anonymous hands holding a branded beer glass only — NO bottle, NO can — cropped at wrist level, no face visible, no body.";
    }
    if (behaelter === "F") {
      return "Anonymous hands holding the branded bottle only — NO glass — cropped at wrist level, no face visible, no body.";
    }
    return PERSON_FRAGMENTS.B;
  }
  if (modus === "D") {
    const gender =
      input.personGender === "weiblich"
        ? "young woman"
        : input.personGender === "maennlich"
          ? "young man"
          : "androgynous young adult";
    const age =
      input.personAlter === "mittel"
        ? "in their 30s to 40s"
        : input.personAlter === "aelter"
          ? "in their 50s"
          : "in their mid-20s";
    const body =
      input.personKoerper === "ganzkoerper"
        ? "full body visible"
        : input.personKoerper === "halbkoerper"
          ? "half body visible"
          : "head and shoulders only";
    const mood =
      input.personMood === "lachend"
        ? "laughing naturally"
        : input.personMood === "nachdenklich"
          ? "calm and contemplative"
          : input.personMood === "aktiv"
            ? "active and dynamic"
            : "relaxed and natural";
    const freitext = input.personBeschreibung ? `, ${input.personBeschreibung}` : "";
    return `An ordinary adult — a fictional ${gender} ${age}, ${body}, ${mood}${freitext}. No model-agency look, no specific real person, no celebrity likeness.`;
  }
  const n =
    input.gruppenAnzahl === "2"
      ? "two"
      : input.gruppenAnzahl === "3"
        ? "three"
        : "four to five";
  const setting = groupSettingPhrase(input);
  const groupVessel =
    behaelter === "G"
      ? "branded beer glasses"
      : behaelter === "F"
        ? "branded beer bottles"
        : "branded beer glasses and bottles";
  switch (input.gruppenDynamik) {
    case "E1":
      return `Candid POV selfie-style group shot, ${n} anonymous adults in their mid-20s holding ${groupVessel} stretched toward the camera, laughing naturally into lens, one hand extended holding phone, tight energetic framing, spontaneous unposed atmosphere ${setting}.`;
    case "E2":
      return `Group of ${n} anonymous adults raising and clinking ${groupVessel} together, mid-toast, genuine joyful expressions, ${setting}, natural celebration energy — not staged stock-photo posing.`;
    case "E3":
      return `Group of ${n} anonymous adults ${groupSeatedPhrase(input.szene)} ${setting}, relaxed and laughing candidly, each holding ${groupVessel.replace(" and bottles", "")}, warm authentic social atmosphere with natural body language.`;
    case "E4":
      return `Group of ${n} anonymous adults walking ${setting}, casually holding ${groupVessel}, smiling and talking, candid natural movement with believable stride and hand grip.`;
    default:
      return `Group of ${n} anonymous adults enjoying beer together ${setting}, candid documentary lifestyle moment, no specific real persons, no catalog-model posing.`;
  }
}

export function buildHyperrealisticPrompt(input: HyperrealisticInput, options?: { breweryName?: string }): string {
  const flasche = FLASCHEN_TYPEN[input.flaschenTyp];
  const glas = input.glasTyp ? GLAS_TYPEN[input.glasTyp] : null;
  const szene = SZENE_DESCRIPTIONS[input.szene];
  const lighting = TAGESZEIT_LIGHTING[input.tageszeit];
  const trend = STIMMUNG_TREND_PROMPT[input.stimmungTrend ?? "nachhaltig"];
  const personenModus = input.personenModus ?? (input.personImBild ? "D" : "A");
  const shot = SHOT_TYPE_PROMPT[input.shotType ?? "A"];
  const behaelter = input.behaelter ?? (glas ? "B" : "F");
  const etikettModus = input.etikettModus ?? "marke";
  const brandLock = buildBrandLockFragment(input, options?.breweryName);

  const flaschenfarbeText = {
    braun: "amber-brown glass",
    gruen: "green glass",
    klar: "clear flint glass",
  }[input.flaschenfarbe];
  const istDose = isDoseTyp(input.flaschenTyp);
  const gebindeNoun = istDose ? "can" : "bottle";
  const materialClause = istDose ? "" : `, made of ${flaschenfarbeText}`;

  const personPart = buildPersonFragment(input, behaelter);
  const humanRealismPart = buildHumanRealismFragment(input);
  const beerPhysicsPart = buildBeerPhysicsFragment(input.bierstil, behaelter);
  const sceneTexturePart = buildSceneTextureAnchors(input.szene);
  const cameraPart = buildCameraFragment(input.shotType ?? "A", input.aspectRatio);

  const bottlePart =
    behaelter === "G"
      ? ""
      : etikettModus === "marke"
        ? `${flasche.promptDescription}${materialClause}. The ${istDose ? "wrap-around artwork on the can" : "label on the bottle"} MUST be reproduced 1:1 EXACTLY from the reference image — same artwork, same typography, same colors, same proportions, no reinterpretation, no stylization. Treat the ${istDose ? "can artwork as a fixed graphic asset wrapped around the cylindrical can body" : "label as a fixed graphic asset to be applied flat-perspective-corrected onto the bottle"}.`
        : `${flasche.promptDescription}${materialClause}. Design an original, professionally branded ${istDose ? "wrap-around can artwork" : "beer label"} that fits the beer style "${input.bierstil}" and the overall mood — invent a plausible FICTIONAL brand name and matching logo (NOT any real existing brewery), with clean legible typography, a coherent color palette and a tasteful, realistic layout. The ${gebindeNoun} MUST look professionally ${istDose ? "printed" : "labelled"}, never blank, never unlabelled.`;

  const glasFillMl =
    behaelter !== "F" && input.glasTyp ? pouredGlassFillMl(input.glasTyp, input.flaschenTyp, behaelter) : 0;
  const glasPour = input.glasTyp && glasFillMl ? glassPourPromptDescription(input.glasTyp, glasFillMl) : "";

  const glasPart =
    behaelter === "F"
      ? ""
      : glas
        ? `HERO SUBJECT: A poured ${glasPour} ${behaelter === "B" ? `stands next to the ${gebindeNoun}` : "in centered hero position — ONLY the glass, absolutely NO bottle or can anywhere in frame"}. The beer color matches the style "${input.bierstil}".${
            etikettModus === "marke" && options?.breweryName?.trim()
              ? ` EXACT TEXT on the glass: "${options.breweryName.trim()}". The glass MUST show this logo/branding clearly on the glass surface — never plain/unbranded, never a different brewery name.`
              : etikettModus !== "marke"
                ? ` Design an original, professionally branded glass: invent a plausible FICTIONAL brewery name and matching logo (NOT any real existing brewery) and show it tastefully etched or printed on the glass surface with clean legible typography — the glass MUST look professionally branded, never a plain unbranded glass.`
                : ""
          }${behaelter === "B" ? ` Maintain correct proportional scale: the glass is a single pour from this ${flascheVolumeMl(input.flaschenTyp) / 1000} L ${gebindeNoun} (${glasFillMl} ml) — never a larger mug than the container.` : ""}`
        : "";

  const subjectBlock =
    behaelter === "G"
      ? `SUBJECT: ${glasPart || "Branded beer glass hero shot — glass only, no bottle."}`
      : `SUBJECT: ${bottlePart}\n\n${glasPart}`.trim();

  const bottleShapeLock = behaelter === "G" ? "" : buildBottleShapeLockFragment(input);
  const glassShapeLock = buildGlassShapeLockFragment(input);
  const closureLogic = behaelter === "G" ? "" : buildClosureLogicFragment(input);

  const sceneBlock = `SCENE: ${szene}.`;
  const shotBlock = personenModus === "E" ? "" : `SHOT: ${shot}.`;

  const glassOnlyNegative =
    behaelter === "G"
      ? "beer bottle, bottle on table, bottle in hand, beer can, packaging, unbranded plain glass, wrong brewery logo on glass, "
      : "";

  const sceneNegative =
    input.szene === "fussball_public_viewing"
      ? "biergarten, beer garden, chestnut tree shade, wirtshaus interior, cozy tavern, alpine hut, "
      : "";

  const bottleShapeNegative =
    behaelter === "G"
      ? ""
      : istDose
        ? "glass bottle, crown-cap bottle, swing-top bottle, bottle neck, wrong container shape, wrong container size, slim tall energy-drink can, mismatched can volume, "
        : "wrong bottle shape, wrong bottle size, short stubby Steinie when a tall bottle is required, tall bottle when a stubby Steinie is required, swing-top closure when a crown cap is required, crown cap when a swing-top is required, aluminium can, mismatched bottle volume, ";

  // Unlogische Verschluss-Situationen verbieten (versiegelt trotz vollem Glas / beim Trinken / beim Anstoßen).
  const closureBase =
    behaelter === "B"
      ? istDose
        ? "sealed unopened can with stay-tab still closed next to a full poured glass, "
        : "sealed bottle with crown cap still on next to a full poured glass, capped bottle beside an already poured glass, "
      : behaelter === "F" && personenModus !== "A"
        ? istDose
          ? "person drinking from a sealed unopened can, "
          : "person drinking from a sealed bottle with the crown cap still on, capped bottle held to the mouth, "
        : "";
  const toastNegative =
    personenModus === "E" && behaelter !== "G"
      ? istDose
        ? "toasting or clinking with sealed unopened cans, "
        : "toasting or clinking with sealed bottles, clinking capped crown-cap bottles together, "
      : "";
  // Bügelverschluss sauber halten — kein chaotisch baumelnder Drahtbügel/Stopfen.
  const istBuegel = !istDose && input.flaschenTyp.startsWith("buegel");
  const buegelNegative =
    istBuegel && behaelter !== "G"
      ? "messy tangled dangling swing-top wire bail, chaotic floating porcelain stopper, swing-top mechanism hanging awkwardly across the bottle, deformed or bent wire clip, stopper covering the label, duplicated swing-top parts, "
      : "";
  const closureNegative = `${closureBase}${toastNegative}${buegelNegative}`;

  // Etikett-Negatives: bei "marke" Label-Verzerrung vermeiden; bei "generisch"
  // ein nacktes Gebinde verhindern (die KI soll ein Etikett designen).
  const labelNegative =
    etikettModus === "marke"
      ? "distorted label, warped text on label, wrong brewery name on glass, unbranded glass with branded product, mixed competing beer brands, floating bottle, unrealistic bottle placement, "
      : behaelter === "G"
        ? ""
        : "blank unlabelled container, plain label-less bottle or can, missing label, missing can artwork, real existing brewery logo or trademark, floating bottle, unrealistic bottle placement, ";

  return `
${buildHyperrealismLockFragment()}

${subjectBlock}
${bottleShapeLock ? `\n${bottleShapeLock}\n` : ""}${glassShapeLock ? `\n${glassShapeLock}\n` : ""}${closureLogic ? `\n${closureLogic}\n` : ""}
${beerPhysicsPart}

${personPart}
${humanRealismPart ? `\n${humanRealismPart}` : ""}

${sceneBlock}
${sceneTexturePart}
LIGHTING: ${lighting}.
MOOD: ${trend}.

${shotBlock}
${brandLock}

CAMERA: ${cameraPart}

${input.zusatzWunsch ? `ADDITIONAL: ${input.zusatzWunsch}` : ""}

NEGATIVE: ${sceneNegative}${bottleShapeNegative}${closureNegative}${glassOnlyNegative}${labelNegative}${HYPERREALISM_NEGATIVE}.
  `.trim();
}

const PEOPLE_PLACEMENT: Record<NonNullable<HyperrealisticInput["personenModus"]>, string> = {
  A: "No people and no hands — only the product in the scene.",
  B: "One ordinary adult hand holding a matching beer glass; the bottle from Image 1 stands next to it. Real skin, knuckles, pores. No beauty retouch, no plastic CGI hands.",
  C: "A person seen from behind, face away from camera.",
  D: "One ordinary adult in the scene, unposed, not a model.",
  E: "A small group of ordinary adults, candid, not posing for an ad.",
};

/**
 * Kurzer i2i-Prompt: das Produktfoto bleibt, nur die Szene wechselt.
 * Bewusst ohne Markenname/Etikett-Beschreibung — die Bild-KI soll das Foto kopieren,
 * nicht ein Label aus Text erfinden.
 */
export function buildProductPlacementPrompt(input: HyperrealisticInput): string {
  const behaelter = input.behaelter ?? (input.glasTyp ? "B" : "F");
  const personenModus = input.personenModus ?? (input.personImBild ? "D" : "A");
  const scene = SZENE_DESCRIPTIONS[input.szene];
  const light = TAGESZEIT_LIGHTING[input.tageszeit];
  const people = PEOPLE_PLACEMENT[personenModus] ?? PEOPLE_PLACEMENT.A;
  const vessel =
    behaelter === "G" ? "glass only, no bottle" : behaelter === "F" ? "the bottle from Image 1 only, no poured glass" : "the bottle from Image 1 plus a poured beer glass beside it";
  const extra = input.zusatzWunsch?.trim();
  const glassPour =
    behaelter !== "F" && input.glasTyp
      ? glassPourPromptDescription(input.glasTyp, pouredGlassFillMl(input.glasTyp, input.flaschenTyp, behaelter))
      : "";
  const bottleLitres = flascheVolumeMl(input.flaschenTyp) / 1000;
  const pourLock =
    behaelter === "B" && glassPour
      ? `Beside it: one poured ${glassPour}. The glass is a single pour from this ${bottleLitres} L bottle — never a larger mug than the bottle (no 0.5 L Seidel next to a 0.33 L bottle, no 1 L Maß).`
      : "";

  return [
    "Image 1 is a photograph of the real beer bottle. Place that exact same physical bottle into a new photograph — preserve the product, invent only the environment (product-preservation, not a redraw).",
    "Keep unchanged from Image 1: bottle silhouette, glass color, and the entire printed label — logo, crest, pattern, colors, layout, and every letter. Do not redraw, restyle, recolor, or invent a different label. Do not add new brand names or badges.",
    "The bottle sits on a real surface with a natural contact shadow. Bottle glass reflects THIS room, not a white studio cove.",
    `Composition: ${vessel}.`,
    pourLock,
    people,
    `Setting: ${scene}.`,
    `Light: ${light}. Large soft source on the packaging (window or overcast sky), not a beauty dish, not rim-light hero glow. Some shadow remains.`,
    extra ? `Scene detail: ${extra}` : "",
    "Camera: handheld Canon EOS R6, 50mm f/4, Kodak Portra 400, ISO 400, fine analog grain. Slightly muted color. Not centered. Not everything razor-sharp.",
    "This is not an advertisement, not CGI, not cinematic orange glow, not beauty-filtered skin.",
    "Forbidden look: Octane/Unreal, catalog packshot, HDR, photorealistic commercial product shot, ultra-detailed, professionally retouched, plastic foam, uniform condensation stickers, floating product.",
    buildAuthenticityFragment(input),
  ]
    .filter(Boolean)
    .join(" ");
}
