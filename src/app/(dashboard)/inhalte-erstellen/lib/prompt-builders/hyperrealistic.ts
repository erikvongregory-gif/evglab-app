import { FLASCHEN_TYPEN, GLAS_TYPEN } from "../brewing-knowledge";
import type { HyperrealisticInput } from "../schemas";

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
  fussball_public_viewing: "outdoor public viewing event, blurred crowd, large screen glow",
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

function buildPersonFragment(input: HyperrealisticInput): string {
  // Legacy-Kompat: ältere Aufrufer ohne personenModus aber mit personImBild + Freitext.
  if (!input.personenModus && input.personImBild && input.personBeschreibung) {
    return `A person (${input.personBeschreibung}) holding or sitting next to the bottle, natural authentic body language, no posing.`;
  }
  const modus = input.personenModus ?? (input.personImBild ? "D" : "A");
  if (modus === "A" || modus === "B" || modus === "C") {
    return PERSON_FRAGMENTS[modus];
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
  const setting =
    input.gruppenSetting === "alpine_huette"
      ? "in front of an alpine wooden hut"
      : input.gruppenSetting === "biergarten"
        ? "in a traditional Biergarten"
        : input.gruppenSetting === "berge_outdoor"
          ? "outdoors in a mountain landscape"
          : input.gruppenSetting === "rooftop_urban"
            ? "on an urban rooftop at golden hour"
            : input.gruppenSetting === "strand"
              ? "on a sunlit beach"
              : "in a natural lifestyle setting";
  switch (input.gruppenDynamik) {
    case "E1":
      return `Dynamic POV selfie-style group shot, ${n} attractive anonymous young adults in their mid-20s holding beer glasses stretched toward the camera, laughing and cheering directly into lens, one hand extended holding phone, tight energetic framing, spontaneous joyful atmosphere ${setting}.`;
    case "E2":
      return `Group of ${n} anonymous young adults raising and clinking beer glasses together, mid-toast, joyful expressions, ${setting}, celebration energy.`;
    case "E3":
      return `Group of ${n} anonymous young adults sitting together at a rustic wooden table ${setting}, relaxed and laughing, each holding a beer glass, warm social atmosphere.`;
    case "E4":
      return `Group of ${n} anonymous young adults walking ${setting}, casually holding beer bottles, smiling and talking, candid natural movement.`;
    default:
      return `Group of ${n} anonymous young adults enjoying beer together ${setting}, candid lifestyle moment, no specific real persons.`;
  }
}

export function buildHyperrealisticPrompt(input: HyperrealisticInput): string {
  const flasche = FLASCHEN_TYPEN[input.flaschenTyp];
  const glas = input.glasTyp ? GLAS_TYPEN[input.glasTyp] : null;
  const szene = SZENE_DESCRIPTIONS[input.szene];
  const lighting = TAGESZEIT_LIGHTING[input.tageszeit];
  const trend = STIMMUNG_TREND_PROMPT[input.stimmungTrend ?? "nachhaltig"];
  const shot = SHOT_TYPE_PROMPT[input.shotType ?? "A"];
  const behaelter = input.behaelter ?? (glas ? "B" : "F");
  const etikettModus = input.etikettModus ?? "marke";

  const flaschenfarbeText = {
    braun: "amber-brown glass",
    gruen: "green glass",
    klar: "clear flint glass",
  }[input.flaschenfarbe];

  const personPart = buildPersonFragment(input);

  const bottlePart =
    behaelter === "G"
      ? ""
      : etikettModus === "marke"
        ? `A ${flaschenfarbeText} ${flasche.promptDescription}. The label on the bottle MUST be reproduced 1:1 EXACTLY from the reference image — same artwork, same typography, same colors, same proportions, no reinterpretation, no stylization. Treat the label as a fixed graphic asset to be applied flat-perspective-corrected onto the bottle.`
        : `A ${flaschenfarbeText} ${flasche.promptDescription}. Generic unbranded bottle — no label text, plain bottle surface.`;

  const glasPart =
    behaelter === "F"
      ? ""
      : glas
        ? `A poured ${glas.promptDescription} ${behaelter === "B" ? "stands next to the bottle" : "in centered hero position"}. The beer color matches the style "${input.bierstil}".${behaelter === "B" ? ' Maintain correct proportional scale: "bottle and glass shown in correct proportional scale, glass volume visually matches bottle content".' : ""}`
        : "";

  return `
PHOTOREALISTIC PRODUCT-IN-SCENE PHOTOGRAPHY.

SUBJECT: ${bottlePart}

${glasPart}

${personPart}

SCENE: ${szene}.
LIGHTING: ${lighting}.
MOOD: ${trend}.

SHOT: ${shot}.

STYLE: Editorial commercial photography, shot on full-frame DSLR, 50mm or 85mm lens, f/2.8, shallow depth of field but ${behaelter === "G" ? "glass" : "bottle and label"} fully sharp. Natural color grading, no Instagram filters. Authentic, no AI-glossy plastic look.

${input.zusatzWunsch ? `ADDITIONAL: ${input.zusatzWunsch}` : ""}

NEGATIVE: ${etikettModus === "marke" ? "distorted label, warped text on label, " : ""}generic stock-photo bottle, wrong bottle shape, plastic bottle, illustration style, painting, cartoon, oversaturated, hands with extra fingers, AI face artifacts, glossy unrealistic skin, floating bottle, condensation overdone like sticker droplets.
  `.trim();
}
