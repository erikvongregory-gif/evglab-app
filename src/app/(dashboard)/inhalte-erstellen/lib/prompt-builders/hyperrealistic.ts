import { correctAlcoholFreeStyle, resolveGlasTyp } from "../beer-styles";
import { FLASCHEN_TYPEN, GLAS_TYPEN, containerMaterialPhrase, flascheVolumeMl, glassPourPromptDescription, isDoseTyp, isPetTyp, pouredGlassFillMl } from "../brewing-knowledge";
import type { HyperrealisticInput } from "../schemas";
import {
  buildBottleShapeLockFragment,
  buildCameraFragment,
  buildClosureLogicFragment,
  buildGlassShapeLockFragment,
  buildHumanRealismFragment,
  buildHyperrealismLockFragment,
  buildAuthenticityFragment,
  buildLiquidPhysicsFragment,
  buildSceneTextureAnchors,
  buildUnfilteredLiquidLockFragment,
  CLARITY_NOTE_KLAR,
  CLARITY_NOTE_TRUEB,
  customerSceneText,
  beverageContainerNoun,
  beverageDrinkNoun,
  bottleGeometryPrompt,
  inputProduktKategorie,
  LABEL_ORIENTATION_LOCK,
  resolveBeerClarity,
  withoutBeerFoam,
  HYPERREALISM_NEGATIVE,
  isVehicleScene,
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
  tageslicht: "natural daylight that fits the place and season, true shadows, neutral color",
  goldene_stunde: "late-afternoon sunlight with natural color temperature, long soft shadows — not a cinematic orange grade",
  mittag: "bright midday sunlight, slight haze, hard-ish shadows",
  abend_warm: "warm evening mixed light from sky and nearby lamps, not studio fill",
  blaue_stunde: "blue-hour twilight, cool ambient with a bit of warm practical light",
  nacht: "night: warm practical lamps, string lights or street light with deep shadows; on-camera flash is fine",
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
  const drinkGlass = inputProduktKategorie(input) === "bier" ? "beer glass" : "glass";
  if (behaelter === "G") {
    return `
GLASS BRAND LOCK (MANDATORY): Every ${drinkGlass} in frame MUST display the "${brand}" logo/branding (etched or printed on glass), matching reference label artwork — correct colors, legible typography.
FORBIDDEN: plain unbranded glasses, wrong brewery names on glass, fictional brands, missing logos.
COMPOSITION: GLASS ONLY — no bottle, no can, no packaging anywhere in the image.`;
  }
  const brandSurface = isDoseTyp(input.flaschenTyp) ? "can wrap-around artwork" : "bottle label";
  const brandVessel = isDoseTyp(input.flaschenTyp) ? "can" : "bottle";
  const glassLock = inputProduktKategorie(input) === "bier" ? "beer glasses" : "glasses";
  return `
BRAND IDENTITY LOCK (MANDATORY): Every visible brand touchpoint — ${brandSurface}, glass logo/etching, coasters, napkins, signage — MUST show "${brand}" only, matching the reference label artwork.
FORBIDDEN: any other brewery names, fictional brands, wrong logos on glasses (e.g. random text like "Brauhaus Weißbach"), unbranded glasses when a branded ${brandVessel} is present, or mixed competing brands in one frame.
All ${glassLock} in frame must carry the same "${brand}" branding as the ${brandVessel} — consistent logo placement, legible, not distorted.`;
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
      return inputProduktKategorie(input) === "bier"
        ? "Anonymous hands holding a branded beer glass only — NO bottle, NO can — cropped at wrist level, no face visible, no body."
        : `Anonymous hands holding a branded ${beverageDrinkNoun(input)} glass only — NO bottle, NO can — cropped at wrist level, no face visible, no body.`;
    }
    if (behaelter === "F") {
      return "Anonymous hands holding the branded bottle only — NO glass — cropped at wrist level, no face visible, no body.";
    }
    return PERSON_FRAGMENTS.B;
  }
  if (modus === "D") {
    if (input.characterAppearanceLock?.trim() || input.characterName?.trim()) {
      const lock =
        input.characterAppearanceLock?.trim() ||
        `identical original adult character (${[input.characterName?.trim(), input.characterRole?.trim()].filter(Boolean).join(", ")})`;
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
      // ponytail: Text-Lock wie Higgsfield Character Sheet — keine Face-Fotos an OpenAI.
      return `${lock}, ${body}, ${mood}. Keep this same original character consistent. Natural authentic body language, no catalog-model posing.`;
    }
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
  const drink = beverageDrinkNoun(input);
  const isBeer = inputProduktKategorie(input) === "bier";
  const groupVessel =
    behaelter === "G"
      ? isBeer
        ? "branded beer glasses"
        : `branded ${drink} glasses`
      : behaelter === "F"
        ? isBeer
          ? "branded beer bottles"
          : `branded ${beverageContainerNoun(input)}s`
        : isBeer
          ? "branded beer glasses and bottles"
          : `branded ${drink} glasses and bottles`;
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
      return `Group of ${n} anonymous adults enjoying ${drink} together ${setting}, candid documentary lifestyle moment, no specific real persons, no catalog-model posing.`;
  }
}

export function buildHyperrealisticPrompt(input: HyperrealisticInput, options?: { breweryName?: string }): string {
  const flasche = FLASCHEN_TYPEN[input.flaschenTyp];
  const glas = input.glasTyp ? GLAS_TYPEN[input.glasTyp] : null;
  const szene = SZENE_DESCRIPTIONS[input.szene];
  const lighting = TAGESZEIT_LIGHTING[input.tageszeit];
  const trend = STIMMUNG_TREND_PROMPT[input.stimmungTrend ?? "nachhaltig"];
  const personenModus = input.personenModus ?? (input.personImBild ? "D" : "A");
  const behaelter = input.behaelter ?? (glas ? "B" : "F");
  const etikettModus = input.etikettModus ?? "marke";
  const brandLock = buildBrandLockFragment(input, options?.breweryName);

  const istDose = isDoseTyp(input.flaschenTyp);
  const istPet = isPetTyp(input.flaschenTyp);
  const istSchraub = !istDose && flasche.closure === "schraub";
  const gebindeNoun = istDose ? "can" : "bottle";
  const materialClause = istDose ? "" : `, made of ${containerMaterialPhrase(input.flaschenTyp, input.flaschenfarbe)}`;

  const personPart = buildPersonFragment(input, behaelter);
  const humanRealismPart = buildHumanRealismFragment(input);
  const beerPhysicsPart = buildLiquidPhysicsFragment(input, behaelter);
  const sceneTexturePart = buildSceneTextureAnchors(input.szene);
  const cameraPart = buildCameraFragment(input.shotType ?? "A", input.aspectRatio, input);
  const drink = beverageDrinkNoun(input);
  const isBeer = inputProduktKategorie(input) === "bier";
  const productLabelNoun = isBeer ? "beer label" : "product label";
  const shot =
    !isBeer && (input.shotType ?? "A") === "E"
      ? "close-up of condensation and label"
      : SHOT_TYPE_PROMPT[input.shotType ?? "A"];

  const bottlePart =
    behaelter === "G"
      ? ""
      : etikettModus === "marke"
        ? `${bottleGeometryPrompt(input, flasche.promptDescription)}${materialClause}. The ${istDose ? "wrap-around artwork on the can" : "label on the bottle"} MUST be reproduced 1:1 EXACTLY from the reference image — same artwork, same typography, same colors, same proportions, no reinterpretation, no stylization. Treat the ${istDose ? "can artwork as a fixed graphic asset wrapped around the cylindrical can body" : "label as a fixed graphic asset to be applied flat-perspective-corrected onto the bottle"}.`
        : `${bottleGeometryPrompt(input, flasche.promptDescription)}${materialClause}. Design an original, professionally branded ${istDose ? "wrap-around can artwork" : productLabelNoun} that fits the ${isBeer ? `beer style "${input.bierstil}"` : `${drink} product`} and the overall mood — invent a plausible FICTIONAL brand name and matching logo (NOT any real existing ${isBeer ? "brewery" : "brand"}), with clean legible typography, a coherent color palette and a tasteful, realistic layout. The ${gebindeNoun} MUST look professionally ${istDose ? "printed" : "labelled"}, never blank, never unlabelled.`;

  const glasFillMl =
    behaelter !== "F" && input.glasTyp ? pouredGlassFillMl(input.glasTyp, input.flaschenTyp, behaelter) : 0;
  const glasPourRaw = input.glasTyp && glasFillMl ? glassPourPromptDescription(input.glasTyp, glasFillMl) : "";
  const glasPour = isBeer ? glasPourRaw : withoutBeerFoam(glasPourRaw);

  const glasPart =
    behaelter === "F"
      ? ""
      : glas
        ? `HERO SUBJECT: A poured ${glasPour} ${behaelter === "B" ? `stands next to the ${gebindeNoun}` : "in centered hero position — ONLY the glass, absolutely NO bottle or can anywhere in frame"}. The ${isBeer ? `beer color matches the style "${input.bierstil}"` : `${drink} matches the product photo — no beer color or beer foam`}.${
            etikettModus === "marke" && options?.breweryName?.trim()
              ? ` EXACT TEXT on the glass: "${options.breweryName.trim()}". The glass MUST show this logo/branding clearly on the glass surface — never plain/unbranded, never a different brewery name.`
              : etikettModus !== "marke"
                ? ` Design an original, professionally branded glass: invent a plausible FICTIONAL ${isBeer ? "brewery" : "brand"} name and matching logo (NOT any real existing ${isBeer ? "brewery" : "brand"}) and show it tastefully etched or printed on the glass surface with clean legible typography — the glass MUST look professionally branded, never a plain unbranded glass.`
                : ""
          }${behaelter === "B" ? ` Maintain correct proportional scale: the glass is a single pour from this ${flascheVolumeMl(input.flaschenTyp) / 1000} L ${gebindeNoun} (${glasFillMl} ml) — never a larger mug than the container.` : ""}`
        : "";

  const subjectBlock =
    behaelter === "G"
      ? `SUBJECT: ${glasPart || `Branded ${isBeer ? "beer glass" : `${drink} glass`} hero shot — glass only, no bottle.`}`
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
        : istPet
          ? "glass bottle, crown cap, swing-top closure, beer bottle, aluminium can, wrong bottle size, "
          : istSchraub
            ? "PET plastic, crown cap, swing-top closure, aluminium can, wrong bottle size, "
            : "wrong bottle shape, wrong bottle size, short stubby Steinie when a tall bottle is required, tall bottle when a stubby Steinie is required, swing-top closure when a crown cap is required, crown cap when a swing-top is required, aluminium can, mismatched bottle volume, ";

  // Unlogische Verschluss-Situationen verbieten (versiegelt trotz vollem Glas / beim Trinken / beim Anstoßen).
  const closureBase =
    behaelter === "B"
      ? istDose
        ? "sealed unopened can with stay-tab still closed next to a full poured glass, "
        : istSchraub
          ? "sealed bottle with the screw cap still on next to a full poured glass, capped bottle beside an already poured glass, "
          : "sealed bottle with crown cap still on next to a full poured glass, capped bottle beside an already poured glass, "
      : behaelter === "F" && personenModus !== "A"
        ? istDose
          ? "person drinking from a sealed unopened can, "
          : istSchraub
            ? "person drinking from a sealed bottle with the screw cap still on, capped bottle held to the mouth, "
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
      ? "messy tangled dangling swing-top wire bail, double wire loop, two wire bails, chaotic floating porcelain stopper, stopper standing upright on the bottle mouth, swing-top mechanism hanging awkwardly across the bottle, deformed or bent wire clip, stopper covering the label, duplicated swing-top parts, two porcelain stoppers, second stopper in another color, "
      : "";
  const handNegative =
    behaelter !== "G" ? "fingers inside the bottle, hand visible through the bottle glass, thumb fused into the label, " : "";
  const closureNegative = `${closureBase}${toastNegative}${buegelNegative}${handNegative}`;

  // Etikett-Negatives: bei "marke" Label-Verzerrung vermeiden; bei "generisch"
  // ein nacktes Gebinde verhindern (die KI soll ein Etikett designen).
  const labelNegative =
    etikettModus === "marke"
      ? "distorted label, warped text on label, wrong brewery name on glass, unbranded glass with branded product, mixed competing beer brands, floating bottle, unrealistic bottle placement, "
      : behaelter === "G"
        ? ""
        : "blank unlabelled container, plain label-less bottle or can, missing label, missing can artwork, real existing brewery logo or trademark, floating bottle, unrealistic bottle placement, ";

  return `
${buildHyperrealismLockFragment(input)}

${input.zusatzWunsch ? `CLIENT INTENT OVERRIDES PRESETS (fulfill exactly — location, action, people): ${input.zusatzWunsch}` : ""}

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

${input.zusatzWunsch ? `CLIENT INTENT WINS OVER SCENE PRESETS (fulfill exactly): ${input.zusatzWunsch}` : ""}

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

/** Freitext → Personen/Gruppe/Alter/Toast. Verhindert „No people“ gegen User-Szene. */
export function detectPeopleIntent(raw: string): {
  toasting: boolean;
  hasPeople: boolean;
  group: boolean;
  groupCount?: "2" | "3" | "4_5";
  older: boolean;
  maleLean: boolean;
} {
  const toasting = /anst(o|ö)ß|ansto(ss|ßen)|angesto(ss|ß)en|sto(?:ß|ss)en\b.*\ban\b|prost|cheers|\btoast\b/i.test(raw);
  const hasPeopleNoun =
    /brauer|braumeister|brewer|mitarbeiter|gast(?:e|en)?|person(?:en)?|mann|männer|maenner|frau(?:en)?|kerl(?:e)?|leute|menschen|paar|freunde|freundinnen|oma|opa|senior(?:en)?|rentner(?:in)?|bayer(?:in|n)?|urbayer|trinker|besucher|toururin|tourist(?:en)?|gruppe|family|familie|couple|\bmen\b|\bwomen\b|\bpeople\b|\bguys\b|\bhumans?\b/i.test(
      raw,
    );
  const hasPeopleAction =
    /trink(?:en|t|st)?|\btrinken\b|sitz(?:en|t)?|steh(?:en|t)?|unterhalt|gespräch|gespraech|lacht|lachen|grinst|freut|schlapp|jubel|feier|gemütlich|gemuetlich|genieß|geniess|prost/i.test(
      raw,
    );
  const older = /\b(alt(?:e|er|en)?|älter|aelter|senior|opa|oma|rentner)\b/i.test(raw);
  const maleLean = /\b(mann|männer|maenner|kerl|urbayer|bayer(?!isch)|opa|rentner)\b/i.test(raw);
  const groupCountMatch = raw.match(/\b(zwei|2|drei|3|vier|4|fünf|fuenf|5)\b/i);
  let groupCount: "2" | "3" | "4_5" | undefined;
  if (groupCountMatch) {
    const n = groupCountMatch[1]!.toLowerCase();
    if (n === "zwei" || n === "2") groupCount = "2";
    else if (n === "drei" || n === "3") groupCount = "3";
    else groupCount = "4_5";
  }
  const group =
    toasting ||
    Boolean(groupCount) ||
    /\b(gruppe|paar|freunde|leute|menschen|together|beide)\b/i.test(raw);
  const hasPeople = toasting || hasPeopleNoun || (hasPeopleAction && (hasPeopleNoun || older || group || Boolean(groupCount)));
  // „trinken“ allein reicht mit Alters-/Bayer-Hinweis oder Anzahl
  const hasPeopleLoose =
    hasPeople ||
    (hasPeopleAction && (older || maleLean || Boolean(groupCount))) ||
    (older && (maleLean || hasPeopleAction));

  return {
    toasting,
    hasPeople: hasPeopleLoose,
    group: group || toasting || Boolean(groupCount),
    groupCount,
    older,
    maleLean,
  };
}

/** Erkennt Handlungs-/Ort-Wünsche im Freitext und korrigiert Defaults, die dagegen arbeiten. */
/** Freitext beschreibt Einschenken / Pour → Flasche+Glas. */
function wantsPourServing(raw: string): boolean {
  return /einschenk|eingesch[aeä]nk|eingeschenkt|schenk\w*\s+(?:\S+\s+){0,3}ein\b|pour(?:ed|ing)?|zapf(?:t|en)?|ins?\s+glas|in\s+(?:ein|das)\s+glas|into\s+(?:a\s+)?glass/i.test(
    raw,
  );
}

/** Freitext nennt ein Glas — dann gehört ein eingeschenktes Glas ins Motiv. */
function mentionsGlass(raw: string): boolean {
  return /(?:^|[^a-zäöüß])(?:gl[aä]s(?:er|ern|es)?|glass(?:es)?|ma(?:ß|ss)(?:krug|kr[uü]ge)?|seidel|bierkrug|steinkrug|willibecher|weizenglas|wei(?:ß|ss)bierglas|pilstulpe|tulpe|stange|becher)(?![a-zäöüß])/i.test(raw);
}

/** Freitext verlangt Nur-Glas. */
function wantsGlassOnly(raw: string): boolean {
  return /nur\s+glas|glass\s*only|kein(?:e)?\s+flasche|ohne\s+flasche|no\s+bottle/i.test(raw);
}

/** Freitext → Tageszeit, nur wenn keine Vorlage eine gesetzt hat. */
export function detectTimeOfDay(raw: string): HyperrealisticInput["tageszeit"] | undefined {
  if (/\bnachts?\b|\bnight\b|mitternacht|\bclub\b|disko|disco/i.test(raw)) return "nacht";
  if (/blaue[nr]? stunde|d[aä]mmerung|\bdusk\b|twilight/i.test(raw)) return "blaue_stunde";
  if (/sonnenuntergang|sunset|goldene[nr]? stunde|golden hour|sp[aä]tnachmittag/i.test(raw)) return "goldene_stunde";
  if (/\babends?\b|feierabend|\bevening\b/i.test(raw)) return "abend_warm";
  if (/mittag|midday|\bnoon\b|pralle[nr]? sonne/i.test(raw)) return "mittag";
  return undefined;
}

export function applyClientIntentOverrides(input: HyperrealisticInput): HyperrealisticInput {
  const raw = input.zusatzWunsch?.trim();
  const next: HyperrealisticInput = { ...input };

  // Altbestand „Hell Alkoholfrei“ → Helles mit Willibecher statt Alkoholfrei-Pils mit Pilstulpe.
  const corrected = correctAlcoholFreeStyle(next.bierstil, next.glasTyp, next.beerName);
  if (corrected.bierstil !== next.bierstil) {
    next.bierstil = corrected.bierstil;
    next.glasTyp = corrected.glasTyp as HyperrealisticInput["glasTyp"];
  }

  // Glastyp aus Sorte/Stil verdrahten, sobald ein Glas im Motiv vorkommen kann.
  if (raw) {
    const mountain = /berg|gipfel|alpen|mountain|hütte|huette|\balm\b/i.test(raw);
    const breweryPlace = /brauerei|sudhaus|braukessel|copper kettle|brewery/i.test(raw);
    const intent = detectPeopleIntent(raw);

    if (intent.toasting) {
      next.personenModus = "E";
      next.personImBild = true;
      next.gruppenAnzahl = input.gruppenAnzahl ?? intent.groupCount ?? "2";
      next.gruppenTyp = input.gruppenTyp ?? (intent.maleLean ? "maenner" : "gemischt");
      next.gruppenDynamik = input.gruppenDynamik ?? "E2";
    } else if (intent.hasPeople && (intent.group || intent.groupCount)) {
      next.personenModus = "E";
      next.personImBild = true;
      next.gruppenAnzahl = input.gruppenAnzahl ?? intent.groupCount ?? "2";
      next.gruppenTyp = input.gruppenTyp ?? (intent.maleLean ? "maenner" : "gemischt");
      next.gruppenDynamik = input.gruppenDynamik ?? "E3";
      if (intent.older) next.personAlter = input.personAlter ?? "aelter";
      if (intent.maleLean) next.personGender = input.personGender ?? "maennlich";
    } else if (intent.hasPeople) {
      next.personenModus = "D";
      next.personImBild = true;
      const laughing = /lacht|lachen|grinst|freut|schlapp|jubel|feier/i.test(raw);
      next.personMood = input.personMood ?? (laughing ? "lachend" : "entspannt");
      next.shotType = input.shotType === "A" ? "B" : input.shotType;
      if (intent.older) next.personAlter = input.personAlter ?? "aelter";
      if (intent.maleLean) next.personGender = input.personGender ?? "maennlich";
    }

    if (mountain) {
      next.szene = "alpenpanorama";
    } else if (breweryPlace || /brauer|braumeister|brewer/i.test(raw)) {
      next.szene = "brauereihof";
    }

    const timeOfDay = detectTimeOfDay(raw);
    if (timeOfDay && next.tageszeit === "tageslicht") next.tageszeit = timeOfDay;

    const explicitGlass = wantsPourServing(raw) || mentionsGlass(raw);
    if (wantsGlassOnly(raw)) {
      next.behaelter = "G";
    } else if (wantsPourServing(raw) || (intent.toasting && mentionsGlass(raw))) {
      next.behaelter = "B";
    } else if (isVehicleScene(raw) && !explicitGlass) {
      // Im Auto schenkt niemand ein — auch eine Vorlage mit Flasche + Glas wird hier zur Flasche.
      next.behaelter = "F";
    } else if (!input.behaelter) {
      // Ohne Vorgabe: Glas nur, wenn der Kunde eins nennt — sonst nur das Gebinde, nicht jedes Bild mit Flasche + Glas.
      next.behaelter = mentionsGlass(raw) ? "B" : "F";
    }
  } else if (!input.behaelter) {
    next.behaelter = "F";
  }

  const needsGlass = (next.behaelter ?? (next.glasTyp ? "B" : "F")) !== "F";
  if (needsGlass || next.glasTyp) {
    next.glasTyp = resolveGlasTyp(next.bierstil, next.glasTyp);
  }

  // Sorten-Filtrierung in den Freitext spiegeln, damit jeder Prompt-Zweig sie sieht.
  if (inputProduktKategorie(next) === "bier") {
    const clarity = resolveBeerClarity(next);
    if (clarity === "trueb" && !/naturtr[uü]b|unfiltriert/i.test(next.zusatzWunsch ?? "")) {
      next.zusatzWunsch = [next.zusatzWunsch?.trim(), CLARITY_NOTE_TRUEB]
        .filter(Boolean)
        .join(". ")
        .slice(0, 800);
    } else if (clarity === "klar" && next.filtrierung === "filtriert" && !/filtriert|glasklar/i.test(next.zusatzWunsch ?? "")) {
      next.zusatzWunsch = [next.zusatzWunsch?.trim(), CLARITY_NOTE_KLAR]
        .filter(Boolean)
        .join(". ")
        .slice(0, 800);
    }
  }

  return next;
}

/**
 * Kurzer i2i-Prompt: das Produktfoto bleibt, nur die Szene wechselt.
 * Bewusst ohne Markenname/Etikett-Beschreibung — die Bild-KI soll das Foto kopieren,
 * nicht ein Label aus Text erfinden.
 *
 * Wichtig: Wenn ein Freitext (`zusatzWunsch`) gesetzt ist, steht die User-Szene ZUERST.
 * Sonst reproduziert images/edits oft 1:1 die Biergarten-Komposition aus Image 1.
 */
type ProductPlacementReferenceRole = {
  index: number;
  role: "product" | "shape" | "glass" | "liquid" | "scene" | "look";
};

export function buildProductPlacementPrompt(
  input: HyperrealisticInput,
  options?: { referenceRoles?: ProductPlacementReferenceRole[] },
): string {
  const behaelter = input.behaelter ?? (input.glasTyp ? "B" : "F");
  const personenModus = input.personenModus ?? (input.personImBild ? "D" : "A");
  const scene = SZENE_DESCRIPTIONS[input.szene];
  const light = TAGESZEIT_LIGHTING[input.tageszeit];
  // Nur der Kundentext — die gespiegelte Klarheits-Notiz regeln die Locks.
  const extra = customerSceneText(input.zusatzWunsch) || undefined;
  const isBeer = inputProduktKategorie(input) === "bier";
  const containerNoun = beverageContainerNoun(input);
  const intent = extra ? detectPeopleIntent(extra) : null;
  const toasting = Boolean(intent?.toasting);
  const heroPerson = Boolean(intent?.hasPeople && !intent.toasting && !intent.group);
  const groupPeople = Boolean(intent?.hasPeople && (intent.group || intent.toasting));
  const hasPeople = personenModus !== "A" || Boolean(intent?.hasPeople);

  let people = PEOPLE_PLACEMENT[hasPeople && personenModus === "A" ? "D" : personenModus] ?? PEOPLE_PLACEMENT.A;
  if (toasting) {
    people =
      "Anstoßen = real people: at least two visible adult hands holding glasses and clinking them (Prost). Faces optional. NEVER a floating bottle toasting a floating glass. NEVER products leaning into each other without hands.";
  } else if (groupPeople || (intent?.hasPeople && personenModus === "E")) {
    people =
      "PEOPLE FROM USER SCENE (mandatory, sharp, readable): include every person described — faces/bodies visible in the foreground or mid-ground, matching age/clothing/action. Sitting/standing as described. NEVER replace them with an empty bottle+glass table still life. NEVER background-only silhouettes.";
  } else if (
    (input.characterAppearanceLock?.trim() || input.characterName?.trim()) &&
    (personenModus === "D" || heroPerson || Boolean(intent?.hasPeople))
  ) {
    const lock =
      input.characterAppearanceLock?.trim() ||
      `identical original adult character (${[input.characterName?.trim(), input.characterRole?.trim()].filter(Boolean).join(", ")})`;
    people = `HERO PERSON (mandatory): ${lock}. Sharp and readable, natural face, real hands. Keep the same original character.`;
  } else if (heroPerson || (intent?.hasPeople && personenModus === "D")) {
    people =
      "HERO PERSON (mandatory, sharp enough to read emotion): one real adult matching the USER SCENE — natural face, real hands, clearly present. Not a tiny background blur. Not a static packshot without people.";
  } else if (extra && personenModus === "A") {
    // Strukturelle Absicherung: Freitext + Default „keine Personen“ darf sich nie widersprechen.
    // Unbekannte Synonyme (Kunde schreibt „Veteranen“, „Stammtischrunde“ …) bleiben so sicher.
    people =
      "Follow USER SCENE for people: if it describes any person(s), hands, or human activity, those people are MANDATORY sharp subjects in frame — never omit them for a product-only bottle+glass still life. Only if USER SCENE clearly has no people, keep product-only with no hands.";
  }

  // Harte „No people“-Zeile nie zusammen mit Freitext ausgeben (auch nach Heuristik-Lücken).
  if (extra && /No people/i.test(people)) {
    people =
      "Follow USER SCENE for people: if people are described, show them sharp and readable; never replace them with an empty product still life.";
  }
  if (!isBeer) {
    people = people.replace(/\bbeer glasses\b/gi, "glasses").replace(/\bbeer glass\b/gi, "glass");
  }

  const vessel = toasting
    ? "two people toasting: glasses held in hands mid-clink in the foreground; the bottle from Image 1 stands on a surface nearby or is held by someone — products must rest on real hands or a real surface, never hover"
    : intent?.hasPeople
      ? "the people from USER SCENE are the main subjects; the bottle from Image 1 is held or stands next to them in frame — NOT a lonely bottle+glass table still life"
      : behaelter === "G"
        ? "glass only, no bottle"
        : behaelter === "F"
          ? "the bottle from Image 1 only, no poured glass"
          : isBeer
            ? "the bottle from Image 1 plus a poured beer glass beside it"
            : `the bottle from Image 1 plus a poured ${beverageDrinkNoun(input)} glass beside it, no beer foam`;

  const isCampaign =
    input.photoStyle === "campaign" || (!input.photoStyle && input.contentPreset === "campaign_social");
  const isPremium = input.photoStyle === "premium";
  if (isCampaign) {
    people =
      "CAMPAIGN PEOPLE: show hands and partial bodies presenting or toasting the customer's product. Faces optional and may be cropped. Product silhouette dominates — never soft-focus couple behind a table bottle.";
  }
  const campaignVessel =
    "CUSTOMER PRODUCT fills the foreground: handoff between hands, cans/bottles mid-toast, low-angle hero on a ledge, or overhead against sky/grass — matching LOOK reference scale. Never a quiet centered bottle on a wooden beer-garden table.";
  const compositionVessel = isCampaign ? campaignVessel : vessel;

  const glassPourRaw =
    behaelter !== "F" && input.glasTyp
      ? glassPourPromptDescription(input.glasTyp, pouredGlassFillMl(input.glasTyp, input.flaschenTyp, behaelter))
      : "";
  const beerClarity = isBeer ? resolveBeerClarity(input) : "klar";
  const glassPourWithClarity =
    isBeer && beerClarity === "trueb" && glassPourRaw
      ? `${glassPourRaw} — beer inside is NATURTRÜB / cloudy unfiltered (milky yeast haze in its own color), NEVER crystal-clear`
      : glassPourRaw;
  const glassPour = isBeer ? glassPourWithClarity : withoutBeerFoam(glassPourRaw);
  const bottleLitres = flascheVolumeMl(input.flaschenTyp) / 1000;
  const pourLock =
    !isCampaign && !toasting && !intent?.hasPeople && behaelter === "B" && glassPour
      ? `Beside it: one poured ${glassPour}. The glass holds exactly this ${bottleLitres} L bottle — no 0.5 L glass next to a 0.33 L bottle, no small 0.3 L glass next to a 0.5 L bottle, no 1 L Maß.`
      : "";

  const stiltreue = input.stiltreue ?? (input.etikettModus === "generisch" ? "frei" : "hoch");
  const poured = behaelter === "B";
  const identityBits = poured
    ? "glass color and the entire printed label"
    : "glass color, cap design, and the entire printed label";
  const labelOrientation = isDoseTyp(input.flaschenTyp) ? "" : ` ${LABEL_ORIENTATION_LOCK}`;
  // Form kommt aus dem gewählten Flaschentyp (BOTTLE SHAPE LOCK), nie aus dem Produktfoto —
  // sonst übernimmt das Modell die Silhouette einer anders geformten Flasche auf dem Foto.
  const shapeFromSpec = isDoseTyp(input.flaschenTyp)
    ? " The can's size and proportions come from the BOTTLE SHAPE LOCK, not from Image 1."
    : " Silhouette, neck, shoulder, height and volume come ONLY from the BOTTLE SHAPE LOCK — Image 1's label goes onto that one bottle, never a second bottle.";
  const labelLock =
    stiltreue === "hoch"
      ? `IDENTITY REFERENCE — PRESERVE EXACTLY: ${identityBits} — logo, crest, typography, colors, layout and label proportions; do not invent a different brand.${shapeFromSpec}${labelOrientation}${
          poured ? " The glass is already poured, so do NOT copy a sealed closure from Image 1 onto the bottle mouth." : ""
        }`
      : stiltreue === "normal"
        ? `Use the brand identity from Image 1 as a faithful reference (logo, core colors, overall layout), reconstructed with the new scene's light and perspective; do not invent a different brand.${shapeFromSpec}${labelOrientation}`
        : `Image 1 defines only the container material and glass color. Brand artwork and label text are intentionally unlocked; do not claim exact product or brand identity.${shapeFromSpec}`;
  const glassShapeLock = buildGlassShapeLockFragment(input);
  const liquidClarityLock = isBeer ? buildUnfilteredLiquidLockFragment(input) : "";
  const liquidPhysics = isBeer ? buildLiquidPhysicsFragment(input, behaelter) : "";

  const productReferenceRule =
    stiltreue === "hoch"
      ? "Use Image 1 as the exact product and brand identity reference."
      : stiltreue === "normal"
        ? "Use Image 1 as a faithful product reference while allowing small photographic reconstruction differences."
        : "Use Image 1 only as a vessel and material reference; label artwork may be redesigned.";

  // Kurz halten: die Details stehen im PRODUCT IN-CAMERA INTEGRATION-Block am Prompt-Ende.
  const productIntegration = [
    "PRODUCT INTEGRATION — CRITICAL:",
    productReferenceRule,
    "Reconstruct it photographically, never as a flat cutout, sticker, pasted layer, or composited object.",
    "Do NOT preserve the reference image's lighting, reflections, white balance or background; the product must share the SAME camera, lens, focal plane, exposure and light as the rest of the photograph.",
  ].join(" ");

  const hyperrealHead = buildHyperrealismLockFragment(input);
  const hyperrealTail = [
    buildAuthenticityFragment({ ...input, personenModus: hasPeople ? (personenModus === "A" ? (groupPeople || toasting ? "E" : "D") : personenModus) : personenModus }),
    `NEGATIVE (hyperreal): ${HYPERREALISM_NEGATIVE}`,
  ].join(" ");

  const camera = buildCameraFragment(input.shotType, input.aspectRatio, input);
  let forbidden = toasting
    ? "Forbidden: floating bottle, floating glass, bottle and glass toasting each other without hands, cutout collage, recreating Image 1's table packshot."
    : intent?.hasPeople
      ? "Forbidden: empty product table shot without the people from USER SCENE, recreating Image 1's packshot, cutout collage, beauty-filter faces, tiny unreadable background figures."
      : "Forbidden: recreating Image 1's background or table layout, catalog packshot, cutout collage, hard mask edges, floating product.";
  if (isCampaign) {
    forbidden =
      "Forbidden: quiet catalogue bottle on a wooden beer-garden table, soft toasting couple in bokeh, pretzel/radish props as hero, Maßkrug postcard, recreating Image 1's packshot, cutout collage.";
  } else if (isPremium) {
    forbidden =
      "Forbidden: recreating Image 1's packshot, cutout collage, beauty rim light on hair, melted pretzel props, campaign product thrust toward the lens.";
  }

  const lookIndexes: number[] = [];
  const referenceLines = (options?.referenceRoles ?? [])
    .filter(({ index }) => index > 1)
    .flatMap(({ index, role }) => {
      if (role === "glass") {
        return [`Image ${index} defines ONLY the glass silhouette and proportions; copy no lighting, background, logos or text.`];
      }
      if (role === "liquid") {
        return [`Image ${index} defines ONLY poured-beer clarity and haze density — not its color; copy no glass shape, foam style or lighting. It overrides clear liquid in Image 1.`];
      }
      if (role === "shape") {
        return [`Image ${index} defines ONLY container geometry and proportions; copy no label, text, background or lighting.`];
      }
      if (role === "look") {
        lookIndexes.push(index);
        return [];
      }
      return [`Image ${index} is a SCENE reference only: use its environment or spatial cues; copy no products, logos, or text.`];
    });
  if (lookIndexes.length) {
    const images =
      lookIndexes.length === 1 ? `Image ${lookIndexes[0]} is a LOOK reference` : `Images ${lookIndexes.join(" and ")} are LOOK references`;
    const grammar = isCampaign
      ? "product-forward scale, hand gesture, camera angle, contrast and light character"
      : isPremium
        ? "calm framing, soft optical bokeh, available light and material honesty"
        : "candid energy, light character and imperfect framing";
    // Stilbilder zeigen fremde Flaschen/Gläser — deren Form darf nie ins Motiv wandern.
    referenceLines.push(
      `${images} and PRIMARY style guide: match ${grammar}. Invent new people — never copy faces, hair, outfits, logos or text. Never copy any bottle, can or glass from them; containers come ONLY from Image 1 and the BOTTLE SHAPE LOCK / GLASS SHAPE LOCK.`,
    );
  }
  const referenceInstructions = referenceLines.length
    ? `REFERENCE ROLES (do not mix): ${referenceLines.join(" ")}`
    : "";
  const closureLogic = behaelter === "G" ? "" : buildClosureLogicFragment(input);
  const imageOneDescription =
    stiltreue === "frei"
      ? `Image 1 is ONLY a vessel reference for the real ${containerNoun}. Its branding is not locked.`
      : `Image 1 is ONLY the product identity reference for the real ${containerNoun} and its printed label.`;
  const imageOneLiquidOverride =
    isBeer && beerClarity === "trueb"
      ? " Image 1 does NOT lock poured-beer clarity: ignore clear beer visible through the bottle; the poured glass must be densely naturtrüb / cloudy."
      : "";
  const discardImageOne =
    "COMPLETELY DISCARD Image 1's background, table, coaster, glass placement, people and framing — invent a new environment.";
  const outputIntent = isCampaign
    ? "Create a bold product-forward campaign still like the LOOK references — shot on a real camera, not a glossy AI ad or hospitality beer-garden postcard."
    : isPremium
      ? "Create restrained premium hospitality photography like the LOOK references — real camera, soft optical bokeh, ordinary skin texture, not a glossy AI lifestyle ad."
      : input.photoStyle === "reportage"
        ? "Create a candid flash snapshot like the LOOK references — imperfect crop, hard flash, not a soft beer-garden lifestyle ad."
        : "Create an authentic real-camera photograph with a clear subject hierarchy.";

  const hasLook = lookIndexes.length > 0;
  const lookAuthority =
    (isCampaign || isPremium || input.photoStyle === "reportage") && hasLook
      ? "LOOK AUTHORITY: LOOK images define crop, camera height, product scale, light character and gesture; USER SCENE only supplies who, where and what happens. If they conflict, keep the LOOK grammar and reinterpret the action inside it."
      : "";

  // Uhrzeit aus Tageszeit/Freitext, Lichtcharakter aus dem Fotostil — nie zwei Lichtsituationen.
  const nightLike =
    input.tageszeit === "nacht" || input.tageszeit === "blaue_stunde" || input.tageszeit === "abend_warm";
  const lightCharacter = isCampaign
    ? "contrast and light character as in the LOOK references, no cinematic sunset wash or HDR bloom"
    : isPremium
      ? "soft falloff as in the LOOK references, no beauty rim glow or golden-hour HDR wash"
      : input.photoStyle === "reportage"
        ? nightLike
          ? "on-camera direct flash over the warm practical lights, hard shadows, quick falloff into darkness"
          : "on-camera fill flash over the daylight, hard small shadows, slightly blown highlights — not soft daylight"
        : "large soft source on the packaging, some shadow remains, not a beauty dish";
  const lightLine = `Light: ${light} — ${lightCharacter}. Real glass refraction, true contact shadows, sparse irregular condensation (never a sticker grid).`;

  const setting = isCampaign
    ? extra
      ? "Location may use the selected place only as light texture — never as a quiet table still-life composition."
      : "Setting: graphic outdoor campaign space (lawn, sky, concrete ledge) matching the LOOK grammar — not a quiet beer-garden table postcard."
    : extra
      ? lookAuthority
        ? "Place words from USER SCENE are atmosphere — do not rebuild a postcard biergarten if the LOOK grammar differs."
        : `Fallback location hint (ignore if it conflicts with USER SCENE): ${scene}.`
      : `Setting: ${scene}.`;

  // Reihenfolge = Priorität: gekürzt wird vom Ende her (final-prompt.ts).
  return [
    extra
      ? lookAuthority
        ? `USER SCENE (content: people, place, action): ${extra}`
        : `USER SCENE (mandatory — fulfill exactly, this is the photograph to create): ${extra}`
      : "",
    `${imageOneDescription}${imageOneLiquidOverride}`,
    discardImageOne,
    labelLock,
    `Composition${extra ? " for the NEW scene" : ""}: ${compositionVessel}.`,
    extra ? "" : pourLock,
    people,
    setting,
    lightLine,
    camera,
    referenceInstructions,
    lookAuthority,
    productIntegration,
    outputIntent,
    forbidden,
    liquidPhysics,
    hyperrealHead,
    glassShapeLock,
    liquidClarityLock,
    closureLogic,
    hyperrealTail,
  ]
    .filter(Boolean)
    .join(" ");
}
