import { FLASCHEN_TYPEN, GLAS_TYPEN, isDoseTyp } from "../brewing-knowledge";
import type { HyperrealisticInput } from "../schemas";
import {
  buildBeerPhysicsFragment,
  buildBottleShapeLockFragment,
  buildCameraFragment,
  buildClosureLogicFragment,
  buildHumanRealismFragment,
  buildHyperrealismLockFragment,
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
  stadtbalkon_abend: "urban rooftop balcony at dusk, city lights bokeh background",
  brauereihof: "brewery courtyard, copper brewing kettles visible in background, industrial-rustic atmosphere",
  fussball_public_viewing:
    "outdoor football public viewing party (German Fanmeile / WM or EM watch event), large LED screen or projector showing a live football match clearly visible in background, fans in jerseys or scarves cheering, standing and seated crowd, screen glow on faces — NOT a Biergarten, NOT a cozy Wirtshaus interior",
} as const;

const TAGESZEIT_LIGHTING = {
  goldene_stunde: "golden hour lighting, warm 3200K tones, long soft shadows",
  mittag: "bright midday sunlight, slight haze for softness",
  abend_warm: "warm evening light, candle or lantern fill",
  blaue_stunde: "blue hour twilight, cool ambient + warm artificial fill",
} as const;

const STIMMUNG_TREND_PROMPT = {
  nachhaltig:
    "rustic sustainable craft atmosphere, warm earth tones, muted greens, natural brown, honey-yellow palette, farm-to-brew authenticity",
  modern:
    "clean minimalist contemporary mood, concrete grey, brilliant whites, single brand accent, geometric shadow play, architectural calm",
  nostalgie:
    "nostalgic vintage Bavarian beer hall mood, sepia warmth, vintage typography, deep gold accents, slight film-grain aesthetic",
  aktiv:
    "high-key fresh active outdoor vibe, bright daylight, citrus yellow and sky blue, energetic and vital",
  premium:
    "premium luxury atmosphere, deep blacks, gold leaf accents, dark marble, chiaroscuro spotlight, exclusive sophistication",
} as const;

const SHOT_TYPE_PROMPT = {
  A: "classic 45° hero shot, balanced commercial framing",
  B: "eye-level frontal shot, neutral classic perspective",
  C: "low angle from below, imposing heroic look",
  D: "flat lay / top-down view, organized graphic composition",
  E: "extreme close-up detail of foam, condensation and label, razor-thin focal plane",
  F: "wide environmental shot showing the brewery / venue as narrative context",
  G: "drone / aerial top-down perspective",
  H: "POV / over-the-shoulder perspective, immersive first-person framing",
} as const;

const PERSON_FRAGMENTS = {
  A: "No people, no hands, no human presence — pure product shot.",
  B: "Anonymous hands holding the glass or bottle, cropped at wrist level, no face visible, no body.",
  C: "A person visible from behind, face fully turned away from camera, body silhouette only, anonymous.",
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
    return `Anonymous lifestyle model — a fictional ${gender} ${age}, ${body}, ${mood}${freitext}. No specific real person, no celebrity likeness.`;
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

  const glasPart =
    behaelter === "F"
      ? ""
      : glas
        ? `HERO SUBJECT: A poured ${glas.promptDescription} ${behaelter === "B" ? `stands next to the ${gebindeNoun}` : "in centered hero position — ONLY the glass, absolutely NO bottle or can anywhere in frame"}. The beer color matches the style "${input.bierstil}".${
            etikettModus === "marke" && options?.breweryName?.trim()
              ? ` EXACT TEXT on the glass: "${options.breweryName.trim()}". The glass MUST show this logo/branding clearly on the glass surface — never plain/unbranded, never a different brewery name.`
              : ""
          }${behaelter === "B" ? ` Maintain correct proportional scale: "${gebindeNoun} and glass shown in correct proportional scale, glass volume visually matches ${gebindeNoun} content".` : ""}`
        : "";

  const subjectBlock =
    behaelter === "G"
      ? `SUBJECT: ${glasPart || "Branded beer glass hero shot — glass only, no bottle."}`
      : `SUBJECT: ${bottlePart}\n\n${glasPart}`.trim();

  const bottleShapeLock = behaelter === "G" ? "" : buildBottleShapeLockFragment(input);
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
${bottleShapeLock ? `\n${bottleShapeLock}\n` : ""}${closureLogic ? `\n${closureLogic}\n` : ""}
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
