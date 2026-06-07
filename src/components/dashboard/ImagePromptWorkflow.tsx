"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PromptInputBox } from "@/components/ui/ai-prompt-box";
import { ImageGeneration } from "@/components/ui/ai-chat-image-generation-1";
import { MAX_REFERENCE_UPLOADS } from "@/lib/image-types/policy";
import { cn } from "@/lib/utils";

type Zielgruppe =
  | "Der Entdecker"
  | "Der Traditionsbewusste"
  | "Der Gesundheitsbewusste"
  | "Der Genießer";

type Plattform =
  | "Instagram Post"
  | "Instagram Story"
  | "Website Hero"
  | "Fachmagazin"
  | "Etikettendesign"
  | "Werbeanzeige";

type Stimmung = "Nachhaltig/Rustikal" | "Modern/Minimalistisch" | "Nostalgisch/Vintage" | "Aktiv/Frisch" | "Premium/Luxus";

type KiPlattform = "Nano Banana Pro" | "Midjourney";
type BehaelterOption = "Nur Glas" | "Nur Flasche" | "Flasche + Glas";
type FlaschenTyp =
  | "Longneck"
  | "Stubbi / NRW"
  | "Euroflasche"
  | "Bügelflasche"
  // Legacy Alias: wird intern auf "Stubbi / NRW" normalisiert.
  | "Weizenbierflasche"
  | "Dose";
type FlaschenVolumen = "330ml" | "500ml" | "750ml";
type EtikettOption = "Ja, Etikett 1:1" | "Generisch";
type ReferenzStaerkeOption = "Niedrig" | "Mittel" | "Hoch" | "Strikt";
type PersonenOption =
  | "Kein Mensch"
  | "Hände/Arme ohne Gesicht"
  | "Person ohne Gesicht"
  | "Person mit Gesicht";
type PersonGeschlecht = "Frau" | "Mann" | "Egal";
type ShotType =
  | "45° Hero Shot"
  | "Eye-Level"
  | "Low Angle"
  | "Flat Lay / Top-Down"
  | "Close-Up / Detail"
  | "Wide Environmental"
  | "Drone / Aerial"
  | "POV / Over-Shoulder";
type BildtypOption =
  | "Produkt-Studio"
  | "Lifestyle"
  | "Biergarten/Genussmoment"
  | "Gastro-Serviermoment"
  | "Event/Promotion"
  | "Food-Pairing"
  | "Makro/Detail";
type StudioStyleOption = "Clean Catalog" | "Premium Hero" | "Macro Commercial";

export type PromptBrief = {
  bildtyp: BildtypOption | "";
  studioStyle: StudioStyleOption | "";
  studioProps: string;
  biertyp: string;
  behaelter: BehaelterOption | "";
  flaschenTyp: FlaschenTyp | "";
  flaschenVolumen: FlaschenVolumen | "";
  markenname: string;
  zielgruppe: Zielgruppe | "";
  plattform: Plattform | "";
  stimmung: Stimmung | "";
  kiPlattform: KiPlattform;
  etikettModus: EtikettOption | "";
  personenModus: PersonenOption | "";
  personGeschlecht: PersonGeschlecht | "";
  shotType: ShotType | "";
  referenzStaerke: ReferenzStaerkeOption;
  besondererHintergrund: string;
  saisonalerBezug: string;
  textImLabel: string;
  vermeiden: string;
};

type GeneratedMediaItem = {
  id: string;
  imageUrl: string;
  prompt: string;
  createdAt: string;
  aspectRatio: string;
  resolution: "1K" | "2K" | "4K";
  outputFormat: "png" | "jpg";
};

type PendingKieTaskSession = {
  taskId: string;
  prompt: string;
  aspectRatio: string;
  resolution: "1K" | "2K" | "4K";
  outputFormat: "png" | "jpg";
  tokenCost: number;
  startedAt: number;
  doneWithoutUrlSince?: number | null;
};

const KIE_MAX_WAIT_MS = 8 * 60 * 1000;
const KIE_DONE_GRACE_MS = 90 * 1000;
const KIE_BASE_DELAY_MS = 2200;
const KIE_MAX_DELAY_MS = 8000;
const KIE_STATUS_TIMEOUT_MS = 15_000;
const KIE_TRANSIENT_RETRY_LIMIT = 3;
const KIE_PENDING_TASK_SESSION_KEY = "evglab_kie_pending_task";

type ImagePromptWorkflowProps = {
  onImageGenerated?: (item: GeneratedMediaItem) => void;
  hasActiveSubscription?: boolean;
  hasFreeTrialAvailable?: boolean;
  remainingTokens?: number;
  onConsumeTokens?: (amount: number) => void;
  onBillingStateUpdate?: (billing: {
    monthlyTokens?: number;
    usedTokens?: number;
    remainingTokens?: number;
    consumed?: number;
    freeTrial?: boolean;
  }) => void;
  onFreeTrialConsumed?: () => void;
  onRequireSubscription?: () => void;
  externalBriefSeed?: Partial<PromptBrief> | null;
  externalSeedKey?: string;
};

type PreflightStatus = "green" | "yellow" | "red";

type PreflightReport = {
  status: PreflightStatus;
  score: number;
  warnings: string[];
  blockers: string[];
  autoFixes: string[];
  fixSuggestions: Array<{ text: string; field: keyof PromptBrief }>;
};

const initialBrief: PromptBrief = {
  bildtyp: "",
  studioStyle: "",
  studioProps: "",
  biertyp: "",
  behaelter: "",
  flaschenTyp: "",
  flaschenVolumen: "",
  markenname: "generisch",
  zielgruppe: "",
  plattform: "",
  stimmung: "",
  kiPlattform: "Nano Banana Pro",
  etikettModus: "",
  personenModus: "",
  personGeschlecht: "Egal",
  shotType: "45° Hero Shot",
  referenzStaerke: "Mittel",
  besondererHintergrund: "",
  saisonalerBezug: "",
  textImLabel: "",
  vermeiden: "",
};

const QUICK_BRIEFS: Array<{ label: string; preset: Partial<PromptBrief> }> = [
  {
    label: "Saisonbier-Launch",
    preset: {
      bildtyp: "Produkt-Studio",
      studioStyle: "Premium Hero",
      biertyp: "Märzen",
      behaelter: "Flasche + Glas",
      flaschenTyp: "Longneck",
      flaschenVolumen: "500ml",
      plattform: "Instagram Post",
      stimmung: "Premium/Luxus",
      etikettModus: "Generisch",
      personenModus: "Kein Mensch",
      shotType: "45° Hero Shot",
      referenzStaerke: "Mittel",
      besondererHintergrund: "Acrylfläche mit weicher Spiegelung",
    },
  },
  {
    label: "Event-Promotion",
    preset: {
      bildtyp: "Event/Promotion",
      biertyp: "Helles",
      behaelter: "Flasche + Glas",
      flaschenTyp: "Euroflasche",
      flaschenVolumen: "500ml",
      plattform: "Instagram Story",
      stimmung: "Aktiv/Frisch",
      etikettModus: "Generisch",
      personenModus: "Person ohne Gesicht",
      shotType: "Wide Environmental",
      referenzStaerke: "Mittel",
      saisonalerBezug: "Sommer-Event",
    },
  },
  {
    label: "Gastro-Partner",
    preset: {
      bildtyp: "Gastro-Serviermoment",
      biertyp: "Pils",
      behaelter: "Nur Glas",
      plattform: "Werbeanzeige",
      stimmung: "Modern/Minimalistisch",
      etikettModus: "Generisch",
      personenModus: "Hände/Arme ohne Gesicht",
      shotType: "Eye-Level",
      referenzStaerke: "Mittel",
    },
  },
];

function normalizeFlaschenTyp(value: FlaschenTyp | ""): FlaschenTyp | "" {
  if (value === "Weizenbierflasche") return "Stubbi / NRW";
  return value;
}

const glassByBeer: Array<{ match: RegExp; glass: string }> = [
  { match: /(weizen|weissbier|hefeweizen)/i, glass: "tall curved Weizen glass" },
  { match: /(stout|porter|schwarzbier)/i, glass: "tulip snifter glass" },
  { match: /(ipa|pale ale|apa)/i, glass: "nonic pint glass with bulge" },
  { match: /(pils|pilsner)/i, glass: "tall slender Pilsner flute" },
  { match: /(koelsch|kölsch)/i, glass: "slim cylindrical Koelsch Stange glass" },
  { match: /(tripel|dubbel|belgian)/i, glass: "wide-bowled chalice goblet" },
  { match: /(bock|doppelbock|maerzen|märzen|festbier)/i, glass: "traditional Bavarian stein or pokal" },
  { match: /(berliner weisse)/i, glass: "wide shallow Berliner Weisse bowl" },
  { match: /(radler|shandy)/i, glass: "traditional Willibecher glass" },
  { match: /(helles|lager|export)/i, glass: "traditional Willibecher glass" },
];

const beerSpecs: Array<{ match: RegExp; liquid: string; foam: string; carbonation: string }> = [
  {
    match: /(weizen|weissbier|hefeweizen)/i,
    liquid: "hazy golden-orange with natural yeast turbidity",
    foam: "towering fluffy white foam head with large irregular pores, excellent retention",
    carbonation: "vigorous effervescent streams with persistent nucleation",
  },
  {
    match: /(stout)/i,
    liquid: "opaque deep ebony with ruby-garnet highlights at edges",
    foam: "thick velvety cream-colored foam with extremely fine mousse-like texture, persistent",
    carbonation: "minimal surface carbonation with occasional slow bubbles",
  },
  {
    match: /(ipa|pale ale|apa)/i,
    liquid: "deep amber to copper with slight haze",
    foam: "moderate off-white foam with medium pores, light sticky lacing",
    carbonation: "moderate effervescence with scattered bubble trails",
  },
  {
    match: /(pils|pilsner)/i,
    liquid: "brilliant pale straw-gold crystal clarity",
    foam: "tight compact brilliant-white foam cap with micro-fine pores, clean lacing rings",
    carbonation: "lively dancing micro-bubbles in elegant columns",
  },
  {
    match: /(koelsch|kölsch)/i,
    liquid: "pale brilliant straw-gold",
    foam: "delicate thin white foam cap, quickly dissipating",
    carbonation: "delicate fine carbonation",
  },
  {
    match: /(bock|doppelbock|maerzen|märzen|festbier)/i,
    liquid: "rich deep amber to dark copper",
    foam: "moderate dense off-white to cream foam",
    carbonation: "moderate smooth carbonation",
  },
  {
    match: /(helles|lager|export)/i,
    liquid: "vibrant golden amber clarity",
    foam: "dense ivory-white foam crown with fine uniform pores, moderate lacing",
    carbonation: "fine ascending pearl-like bubbles in steady streams",
  },
];

const trendByMood: Record<Stimmung, string> = {
  "Nachhaltig/Rustikal":
    "rustic weathered oak bar surface with natural hop vines, sun-drenched beer garden visible through window, warm earthy palette",
  "Modern/Minimalistisch":
    "clean minimalist concrete countertop, single beer glass centered with geometric shadow play, modern architectural background in soft blur",
  "Nostalgisch/Vintage":
    "traditional Bavarian beer hall interior with dark wood paneling, vintage beer signs on walls, subtle nostalgic film grain",
  "Aktiv/Frisch":
    "bright outdoor setting with natural daylight, crisp blue sky, energetic healthy lifestyle context",
  "Premium/Luxus":
    "dramatic dark background with luxurious dark marble surface, subtle gold accents, premium cinematic atmosphere",
};

const lightByMood: Record<Stimmung, string> = {
  "Nachhaltig/Rustikal": "warm golden hour side lighting with long soft shadows",
  "Modern/Minimalistisch": "soft diffused studio lighting with minimal shadows",
  "Nostalgisch/Vintage": "warm tungsten-toned ambient lighting with cozy atmosphere",
  "Aktiv/Frisch": "bright high-key natural daylight flooding the scene",
  "Premium/Luxus": "high-contrast chiaroscuro lighting with deep shadows and selective illumination",
};

const lensByPlatform: Record<Plattform, string> = {
  "Instagram Post": "shot with 85mm lens at f/1.8, shallow depth of field, creamy bokeh background",
  "Instagram Story": "captured with 50mm lens at f/2.8, vertical composition",
  "Website Hero": "wide environmental shot with 35mm lens at f/4",
  Fachmagazin: "shot with 85mm lens at f/1.8, premium product photography composition",
  Etikettendesign: "captured with 50mm lens at f/4, clean front-facing composition for design clarity",
  Werbeanzeige: "captured with 50mm lens at f/2.8, versatile campaign-ready composition",
};

const ratioByPlatform: Record<Plattform, string> = {
  "Instagram Post": "4:5",
  "Instagram Story": "9:16",
  "Website Hero": "16:9",
  Fachmagazin: "3:4",
  Etikettendesign: "2:3",
  Werbeanzeige: "1:1",
};

const BEER_TYPE_OPTIONS = [
  "Helles",
  "Weizen",
  "Pils",
  "IPA",
  "Stout",
  "Koelsch",
  "Märzen",
  "Festbier",
  "Alkoholfrei",
];

const DEFAULT_NEGATIVE_PROMPTS = [
  "no warped or melted label text",
  "no blurry typography",
  "no sticker/overlay or pasted cutout artifacts",
  "no isolated transparent-background cutout look",
  "no pure solid black background unless explicitly requested",
  "no wrong brand logo replacement",
  "no deformed bottle geometry",
  "no duplicate bottle necks or caps",
  "no extra limbs/fingers when humans are present",
] as const;

type ScenePreset = {
  label: string;
  preset: Partial<PromptBrief>;
};

type ScenePromptContract = {
  mustInclude: RegExp[];
  mustExclude: RegExp[];
  hardLocks: string[];
  blockerMessage: string;
};

type SceneAutoFixPolicy = {
  fallbackMood: Stimmung;
  fallbackShotType: ShotType;
  fallbackPersonMode?: PersonenOption;
  defaultBackground?: string;
  defaultSeason?: string;
};

type SceneFieldPolicy = {
  hiddenStepKeys: Array<keyof PromptBrief>;
  requiredKeys: Array<keyof PromptBrief>;
  optionOverrides?: Partial<Record<keyof PromptBrief, string[]>>;
};

type SceneConfigBase = {
  aliases: string[];
  short: string;
  sceneType: string;
  sceneCore: string;
  sceneComposition: string;
  sceneContext: string;
  sceneNegative: string;
  allowedMoods: Stimmung[];
  allowedShotTypes: ShotType[];
  allowedPersonModes?: PersonenOption[];
  hiddenStepKeys?: Array<keyof PromptBrief>;
  guidanceTips: string[];
};

type SceneConfig = SceneConfigBase & {
  fieldPolicy: SceneFieldPolicy;
  scenePresets: ScenePreset[];
  promptContract: ScenePromptContract;
  autoFixPolicy: SceneAutoFixPolicy;
};

const STUDIO_BACKGROUND_PRESET_OPTIONS = [
  "Seamless Weiß (High-Key)",
  "Seamless Hellgrau",
  "Seamless Dunkelgrau (Low-Key)",
  "Farbverlauf Weiß -> Hellgrau",
  "Acrylfläche mit weicher Spiegelung",
  "Stein-/Beton-Look neutral (Studio)",
] as const;

const SCENE_CONFIG_BASE: Record<BildtypOption, SceneConfigBase> = {
  "Produkt-Studio": {
    aliases: ["Produktstudio"],
    short: "Studio-Produktbild mit kontrollierter Deko/Props.",
    sceneType: "Scene type: premium studio product photo with clean background, controlled reflections, and catalog-ready composition.",
    sceneCore:
      "Scene core: product-first image. Bottle and/or glass must dominate frame with clean edges, premium material realism and controlled reflections.",
    sceneComposition:
      "Scene composition: centered or slightly off-center product hierarchy, minimal prop footprint, strong negative space for ads, no environment storytelling.",
    sceneContext:
      "Scene context: seamless neutral studio setup with controlled light transitions and physically plausible shadows.",
    sceneNegative:
      "Scene negatives: avoid outdoor/landscape/location storytelling and avoid cluttered decorative over-staging.",
    allowedMoods: ["Modern/Minimalistisch", "Premium/Luxus"],
    allowedShotTypes: ["45° Hero Shot", "Eye-Level", "Close-Up / Detail", "Flat Lay / Top-Down"],
    allowedPersonModes: ["Kein Mensch", "Hände/Arme ohne Gesicht"],
    hiddenStepKeys: ["zielgruppe", "saisonalerBezug"],
    guidanceTips: [
      "Nutze neutralen Studio-Hintergrund für stabile Ergebnisse.",
      "Bei Studio-Deko nur 1-3 klare Props wählen.",
      "Für saubere Labels besser Eye-Level oder Close-Up nutzen.",
    ],
  },
  Lifestyle: {
    aliases: ["Lifestyle"],
    short: "Natürliches Alltagsmotiv mit Atmosphäre.",
    sceneType: "Scene type: authentic lifestyle setting with natural context and believable human interaction.",
    sceneCore:
      "Scene core: real-life brewery consumption moment where people and product feel naturally connected, not staged like a packshot.",
    sceneComposition:
      "Scene composition: keep product clearly visible while preserving lived-in atmosphere and believable depth cues.",
    sceneContext:
      "Scene context: everyday environment with social authenticity, tactile surfaces and coherent ambient light.",
    sceneNegative:
      "Scene negatives: avoid sterile packshot look, avoid flat catalog lighting, avoid empty context, avoid isolated bottle-only composition, avoid transparent/alpha cutout look.",
    allowedMoods: ["Aktiv/Frisch", "Modern/Minimalistisch", "Nachhaltig/Rustikal"],
    allowedShotTypes: ["45° Hero Shot", "Eye-Level", "Wide Environmental", "POV / Over-Shoulder"],
    guidanceTips: [
      "Mit Personen wirken Eye-Level und 45° Hero Shot am stabilsten.",
      "Vermeide zu sterile Hintergründe, sonst kippt es in Studio-Look.",
      "Bei Gesicht sichtbar am besten Flasche + Glas verwenden.",
    ],
  },
  "Biergarten/Genussmoment": {
    aliases: ["Biergarten", "Genuss Moment", "Genussmoment"],
    short: "Warmes Genussmotiv im Biergarten-Umfeld.",
    sceneType: "Scene type: lively beer garden enjoyment moment with warm social atmosphere and seasonal authenticity.",
    sceneCore:
      "Scene core: convivial beer-garden storytelling with warm social rhythm, natural serving context and clear product readability.",
    sceneComposition:
      "Scene composition: table-led framing with midground depth; beverage remains hero while social cues stay authentic.",
    sceneContext:
      "Scene context: outdoor beer-garden ambiance, seasonal mood and comfortable leisure setting.",
    sceneNegative:
      "Scene negatives: avoid studio seamless backdrop, avoid luxury dark-mood marble look, avoid isolated packshot framing.",
    allowedMoods: ["Nachhaltig/Rustikal", "Nostalgisch/Vintage", "Aktiv/Frisch"],
    allowedShotTypes: ["45° Hero Shot", "Eye-Level", "Wide Environmental"],
    guidanceTips: [
      "Biergarten-Szene braucht Outdoor-Atmosphäre und Tischkontext.",
      "Nicht zu dunkel graden, sonst verliert die Szene Genuss-Charakter.",
      "Wide Environmental nur nutzen, wenn Produkt groß genug im Bild bleibt.",
    ],
  },
  "Gastro-Serviermoment": {
    aliases: ["Gastro", "Service Moment", "Serviermoment"],
    short: "Servier-/Thekenszene mit Gastro-Feeling.",
    sceneType: "Scene type: gastronomy serving moment at bar/table with realistic hospitality context.",
    sceneCore:
      "Scene core: service interaction is central and non-negotiable; depict active pour or handoff in-progress (not just holding), with realistic hospitality body language and product readability.",
    sceneComposition:
      "Scene composition: bar/table foreground with clear service gesture in mid-action; bottle neck orientation, hand position, and glass placement must read like real service workflow.",
    sceneContext:
      "Scene context: bar, counter or dining setup with coherent hospitality details (menu/placemat/cutlery), warm practical lighting, and subtle depth-of-field separation.",
    sceneNegative:
      "Scene negatives: avoid outdoor picnic/biergarten cues, avoid isolated studio packshot look.",
    allowedMoods: ["Premium/Luxus", "Modern/Minimalistisch", "Nostalgisch/Vintage"],
    allowedShotTypes: ["Eye-Level", "Close-Up / Detail", "POV / Over-Shoulder"],
    guidanceTips: [
      "Gastro braucht klaren Service-Moment (einschenken/servieren).",
      "POV funktioniert gut für Hände/Arme ohne Gesicht.",
      "Vermeide reine Outdoor-Elemente, sonst wird es Biergarten statt Gastro.",
      "Wenn Person mit Gesicht aktiv ist: kein statisches Posing, sondern echte Servieraktion im Moment.",
    ],
  },
  "Event/Promotion": {
    aliases: ["Event", "Promotion"],
    short: "Kampagnenmotiv für Aktionen und Promotions.",
    sceneType: "Scene type: campaign/event visual for promotions, posters and paid ads with strong focal hierarchy.",
    sceneCore:
      "Scene core: campaign-ready key visual with clear hero product and intentional visual hierarchy for headline/CTA placement.",
    sceneComposition:
      "Scene composition: dynamic framing with controlled energy; preserve clean copy-space and strong focal contrast.",
    sceneContext:
      "Scene context: event atmosphere, promo energy and branding-ready background rhythm.",
    sceneNegative:
      "Scene negatives: avoid random clutter, avoid weak focal hierarchy, avoid cramped framing without copy-space.",
    allowedMoods: ["Aktiv/Frisch", "Premium/Luxus", "Modern/Minimalistisch"],
    allowedShotTypes: ["45° Hero Shot", "Eye-Level", "Wide Environmental", "Low Angle"],
    guidanceTips: [
      "Promotion braucht klare Blickführung und freien Copy-Space.",
      "Low Angle nur einsetzen, wenn Produkt dominant bleibt.",
      "Zu viele Deko-Elemente reduzieren die Kampagnenwirkung.",
    ],
  },
  "Food-Pairing": {
    aliases: ["Food Pairing", "Food-Pairing"],
    short: "Bier + Speise als appetitliche Kombination.",
    sceneType: "Scene type: beer-and-food pairing composition with appetizing plating and balanced table styling.",
    sceneCore:
      "Scene core: beer and food must both be visibly intentional, with appetizing texture and plausible pairing logic.",
    sceneComposition:
      "Scene composition: balanced dual-subject layout where beverage and dish support each other without visual competition.",
    sceneContext:
      "Scene context: dining-table or serving surface with culinary cues and realistic gastronomic styling.",
    sceneNegative:
      "Scene negatives: avoid missing food elements, avoid mismatched cuisine context, avoid sterile no-food packshot.",
    allowedMoods: ["Premium/Luxus", "Nachhaltig/Rustikal", "Nostalgisch/Vintage"],
    allowedShotTypes: ["45° Hero Shot", "Eye-Level", "Close-Up / Detail", "Flat Lay / Top-Down"],
    guidanceTips: [
      "Food-Pairing braucht sichtbares Food-Element, sonst wirkt es falsch.",
      "Top-Down eignet sich gut für Menü-/Tisch-Komposition.",
      "Achte auf plausible Speise-Bier-Kombination im Hintergrundtext.",
    ],
  },
  "Makro/Detail": {
    aliases: ["Makro Detail", "Makro"],
    short: "Label, Schaum und Material-Details im Fokus.",
    sceneType: "Scene type: macro detail shot focusing on label texture, foam, droplets and glass material realism.",
    sceneCore:
      "Scene core: tactile micro-detail of label print, condensation and foam texture must be optically dominant with believable material imperfections.",
    sceneComposition:
      "Scene composition: tight crop with one primary detail focus area, natural focus falloff, and physically plausible lens perspective around branding and texture.",
    sceneContext:
      "Scene context: minimal environment, detail-first framing, precision highlight control.",
    sceneNegative:
      "Scene negatives: avoid wide environmental framing, avoid distant full-scene composition, avoid tiny unreadable label area, avoid overly clean CGI plastic look, avoid mathematically perfect droplet symmetry, avoid unreal foam geometry.",
    allowedMoods: ["Premium/Luxus", "Modern/Minimalistisch", "Nostalgisch/Vintage"],
    allowedShotTypes: ["Close-Up / Detail", "Eye-Level", "Flat Lay / Top-Down"],
    allowedPersonModes: ["Kein Mensch", "Hände/Arme ohne Gesicht"],
    guidanceTips: [
      "Makro braucht nahe Perspektive, sonst verliert es den Detail-Fokus.",
      "Für Label-Schärfe ist Close-Up am zuverlässigsten.",
      "Hintergrund sehr ruhig halten, damit Texturen wirken.",
    ],
  },
};

function getSceneFieldPolicy(scene: BildtypOption, base: SceneConfigBase): SceneFieldPolicy {
  const hiddenStepKeys = [...(base.hiddenStepKeys ?? [])];
  const requiredKeys: Array<keyof PromptBrief> = ["stimmung", "shotType", "personenModus"];
  const optionOverrides: Partial<Record<keyof PromptBrief, string[]>> = {};

  if (scene === "Produkt-Studio") {
    requiredKeys.push("studioStyle", "besondererHintergrund");
    optionOverrides.besondererHintergrund = [...STUDIO_BACKGROUND_PRESET_OPTIONS];
  }
  if (scene === "Food-Pairing") {
    requiredKeys.push("besondererHintergrund");
  }
  if (scene === "Makro/Detail") {
    hiddenStepKeys.push("saisonalerBezug");
  }
  return { hiddenStepKeys, requiredKeys, optionOverrides };
}

function getScenePresets(scene: BildtypOption): ScenePreset[] {
  const commonBase: Partial<PromptBrief> = {
    plattform: "Instagram Post",
    referenzStaerke: "Mittel",
    etikettModus: "Generisch",
    behaelter: "Flasche + Glas",
    flaschenVolumen: "500ml",
    markenname: "generisch",
  };
  switch (scene) {
    case "Produkt-Studio":
      return [
        {
          label: "Studio Hero",
          preset: {
            ...commonBase,
            bildtyp: scene,
            stimmung: "Premium/Luxus",
            studioStyle: "Premium Hero",
            besondererHintergrund: STUDIO_BACKGROUND_PRESET_OPTIONS[0],
            personenModus: "Kein Mensch",
            shotType: "45° Hero Shot",
            flaschenTyp: "Longneck",
            biertyp: "Helles",
          },
        },
      ];
    case "Event/Promotion":
      return [
        {
          label: "Promo Kampagne",
          preset: {
            ...commonBase,
            bildtyp: scene,
            stimmung: "Aktiv/Frisch",
            personenModus: "Person ohne Gesicht",
            shotType: "Low Angle",
            saisonalerBezug: "Sommer-Event",
            besondererHintergrund: "promo stage lighting with clear copy-space zone",
            flaschenTyp: "Euroflasche",
            biertyp: "Helles",
          },
        },
      ];
    case "Food-Pairing":
      return [
        {
          label: "Pairing Tischszene",
          preset: {
            ...commonBase,
            bildtyp: scene,
            stimmung: "Nachhaltig/Rustikal",
            personenModus: "Hände/Arme ohne Gesicht",
            shotType: "Eye-Level",
            besondererHintergrund: "wooden dining table with plated food pairing (pretzel, cheese, charcuterie)",
            flaschenTyp: "Longneck",
            biertyp: "Märzen",
          },
        },
      ];
    default:
      return [
        {
          label: `${scene} Preset`,
          preset: {
            ...commonBase,
            bildtyp: scene,
          },
        },
      ];
  }
}

function getScenePromptContract(scene: BildtypOption): ScenePromptContract {
  switch (scene) {
    case "Produkt-Studio":
      return {
        mustInclude: [/(studio lock|controlled studio|seamless|catalog-ready)/i],
        mustExclude: [/(outdoor|beer garden|mountain|forest|restaurant terrace)/i],
        hardLocks: ["Scene lock: keep a controlled studio setup with neutral backdrop and product-first framing."],
        blockerMessage: "Produkt-Studio-Contract verletzt: Studio-Setup nicht klar genug erzwungen.",
      };
    case "Biergarten/Genussmoment":
      return {
        mustInclude: [/(beer garden|outdoor|table-led|social atmosphere)/i],
        mustExclude: [/(seamless studio|isolated packshot)/i],
        hardLocks: ["Scene lock: enforce authentic outdoor beer-garden enjoyment context with social table cues."],
        blockerMessage: "Biergarten/Genussmoment-Contract verletzt: Outdoor-Genusssignale fehlen.",
      };
    case "Gastro-Serviermoment":
      return {
        mustInclude: [/(service interaction|serving action|handoff|pour)/i],
        mustExclude: [/(picnic|beer garden leisure)/i],
        hardLocks: ["Scene lock: show active gastronomy serving interaction, not a static product display."],
        blockerMessage: "Gastro-Serviermoment-Contract verletzt: Servieraktion fehlt.",
      };
    case "Event/Promotion":
      return {
        mustInclude: [/(campaign|copy-space|headline|cta|promo)/i],
        mustExclude: [/(random clutter|cramped framing)/i],
        hardLocks: ["Scene lock: preserve campaign hierarchy with clean copy-space and promotional energy."],
        blockerMessage: "Event/Promotion-Contract verletzt: Kampagnen-Hierarchie oder Copy-Space fehlt.",
      };
    case "Food-Pairing":
      return {
        mustInclude: [/(food|dish|pairing|plating|cuisine)/i],
        mustExclude: [/(no-food|foodless packshot)/i],
        hardLocks: ["Scene lock: include clearly visible plated food pairing supporting the beer hero."],
        blockerMessage: "Food-Pairing-Contract verletzt: sichtbares Food-Element fehlt.",
      };
    case "Makro/Detail":
      return {
        mustInclude: [/(macro|close-up|texture|micro-detail|focus falloff)/i],
        mustExclude: [/(wide environmental|distant full-scene)/i],
        hardLocks: ["Scene lock: enforce true macro-detail optics with tactile texture realism."],
        blockerMessage: "Makro/Detail-Contract verletzt: echter Makro-/Detailfokus fehlt.",
      };
    case "Lifestyle":
    default:
      return {
        mustInclude: [/(lifestyle|authentic|everyday|human interaction)/i],
        mustExclude: [/(sterile packshot|seamless studio)/i],
        hardLocks: ["Scene lock: maintain authentic lifestyle context with believable human/product interaction."],
        blockerMessage: "Lifestyle-Contract verletzt: authentischer Kontext fehlt.",
      };
  }
}

function getSceneAutoFixPolicy(scene: BildtypOption): SceneAutoFixPolicy {
  switch (scene) {
    case "Produkt-Studio":
      return {
        fallbackMood: "Modern/Minimalistisch",
        fallbackShotType: "45° Hero Shot",
        fallbackPersonMode: "Kein Mensch",
        defaultBackground: STUDIO_BACKGROUND_PRESET_OPTIONS[0],
      };
    case "Biergarten/Genussmoment":
      return {
        fallbackMood: "Nachhaltig/Rustikal",
        fallbackShotType: "Eye-Level",
        defaultBackground: "outdoor beer garden table with warm social atmosphere",
        defaultSeason: "Sommer-Event",
      };
    case "Gastro-Serviermoment":
      return {
        fallbackMood: "Modern/Minimalistisch",
        fallbackShotType: "POV / Over-Shoulder",
        defaultBackground: "bar counter service setup with active serving gesture",
      };
    case "Event/Promotion":
      return {
        fallbackMood: "Aktiv/Frisch",
        fallbackShotType: "Low Angle",
        defaultBackground: "campaign backdrop with clean copy-space and event lighting rhythm",
        defaultSeason: "Aktionskampagne",
      };
    case "Food-Pairing":
      return {
        fallbackMood: "Nachhaltig/Rustikal",
        fallbackShotType: "Eye-Level",
        defaultBackground: "dining table with plated pairing food (pretzel, cheese, charcuterie)",
      };
    case "Makro/Detail":
      return {
        fallbackMood: "Premium/Luxus",
        fallbackShotType: "Close-Up / Detail",
        fallbackPersonMode: "Kein Mensch",
      };
    case "Lifestyle":
    default:
      return {
        fallbackMood: "Aktiv/Frisch",
        fallbackShotType: "45° Hero Shot",
        defaultBackground: "natural everyday environment with coherent social context",
      };
  }
}

const SCENE_CONFIG: Record<BildtypOption, SceneConfig> = Object.fromEntries(
  (Object.entries(SCENE_CONFIG_BASE) as Array<[BildtypOption, SceneConfigBase]>).map(([scene, config]) => [
    scene,
    {
      ...config,
      fieldPolicy: getSceneFieldPolicy(scene, config),
      scenePresets: getScenePresets(scene),
      promptContract: getScenePromptContract(scene),
      autoFixPolicy: getSceneAutoFixPolicy(scene),
    },
  ]),
) as Record<BildtypOption, SceneConfig>;

const sceneByBildtyp: Record<BildtypOption, string> = Object.fromEntries(
  (Object.entries(SCENE_CONFIG) as Array<[BildtypOption, SceneConfig]>).map(([scene, config]) => [scene, config.sceneType]),
) as Record<BildtypOption, string>;

const sceneHardRulesByBildtyp: Record<BildtypOption, string> = Object.fromEntries(
  (Object.entries(SCENE_CONFIG) as Array<[BildtypOption, SceneConfig]>).map(([scene, config]) => [
    scene,
    `Scene hard rules: ${config.sceneCore} ${config.sceneComposition}`,
  ]),
) as Record<BildtypOption, string>;

const sceneNegativeRulesByBildtyp: Record<BildtypOption, string> = Object.fromEntries(
  (Object.entries(SCENE_CONFIG) as Array<[BildtypOption, SceneConfig]>).map(([scene, config]) => [scene, config.sceneNegative]),
) as Record<BildtypOption, string>;

const BILDTYP_OVERVIEW: Array<{ value: BildtypOption; short: string }> = (Object.keys(SCENE_CONFIG) as BildtypOption[]).map(
  (value) => ({ value, short: SCENE_CONFIG[value].short }),
);

const STUDIO_BACKGROUND_OPTIONS = STUDIO_BACKGROUND_PRESET_OPTIONS;

const STUDIO_STYLE_OPTIONS: StudioStyleOption[] = ["Clean Catalog", "Premium Hero", "Macro Commercial"];
const STUDIO_STYLE_LABELS: Record<StudioStyleOption, string> = {
  "Clean Catalog": "Clean Catalog - cleanes Katalogbild",
  "Premium Hero": "Premium Hero - hochwertiger Werbe-Look",
  "Macro Commercial": "Macro Commercial - Detail-/Makro-Werbelook",
};
const STUDIO_PROP_OPTIONS = [
  "Hopfen am Flaschenfuß",
  "Zitronenscheiben/Zitrone",
  "Gerstenähren",
  "frische Kräuter (z. B. Minze)",
  "Wassertropfen/Spritz-Effekt",
  "Eiswürfel (dezent)",
  "Kondenswasser auf Oberfläche",
] as const;

const studioPropEnglishNameByOption: Record<(typeof STUDIO_PROP_OPTIONS)[number], string> = {
  "Hopfen am Flaschenfuß": "fresh green hop cones at bottle base",
  "Zitronenscheiben/Zitrone": "lemon slices or whole lemon",
  Gerstenähren: "barley stalks",
  "frische Kräuter (z. B. Minze)": "fresh herb sprigs",
  "Wassertropfen/Spritz-Effekt": "micro splash droplets",
  "Eiswürfel (dezent)": "subtle ice cubes",
  "Kondenswasser auf Oberfläche": "surface condensation droplets",
};

const studioPropDirectiveByOption: Record<(typeof STUDIO_PROP_OPTIONS)[number], string> = {
  "Hopfen am Flaschenfuß":
    "Mandatory prop: clearly visible fresh green hop cones placed at the bottle base in the foreground (at least 2-3 cones).",
  "Zitronenscheiben/Zitrone":
    "Mandatory prop: clearly visible lemon slices or a whole lemon near the product in foreground or midground.",
  Gerstenähren: "Mandatory prop: clearly visible barley stalks arranged as subtle premium accents.",
  "frische Kräuter (z. B. Minze)":
    "Mandatory prop: clearly visible fresh herb sprigs (e.g., mint) as natural garnish accents.",
  "Wassertropfen/Spritz-Effekt":
    "Mandatory prop effect: clearly visible micro splash or spray droplets around product, physically plausible.",
  "Eiswürfel (dezent)":
    "Mandatory prop: clearly visible but subtle ice cubes near product base, not overpowering the label.",
  "Kondenswasser auf Oberfläche":
    "Mandatory prop detail: clearly visible condensation droplets on the surface around the bottle base.",
};

const studioStyleDirectiveByOption: Record<StudioStyleOption, string> = {
  "Clean Catalog":
    "Studio style: clean catalog. Balanced high-key light, soft shadow under product, minimal reflection, neutral white-gray seamless background, highly legible ecommerce-ready presentation.",
  "Premium Hero":
    "Studio style: premium hero. Controlled contrast with subtle vignette, directional key light plus crisp rim light, elegant reflection on surface, premium advertising look without environmental context.",
  "Macro Commercial":
    "Studio style: macro commercial. Close-up product emphasis, micro-detail on label print and condensation texture, selective focus with tack-sharp branding area, commercial detail-shot aesthetics.",
};

const studioPropsRuleByStyle: Record<StudioStyleOption, string> = {
  "Clean Catalog":
    "Props directive: use no props or at most one very subtle prop element; product remains dominant and centered.",
  "Premium Hero":
    "Props directive: include a small curated prop setup (e.g., hops, citrus, barley, herbs, droplets) that supports flavor story while keeping product as clear hero.",
  "Macro Commercial":
    "Props directive: allow tight foreground/background prop accents with shallow depth of field; preserve clear product identity and label readability.",
};

const SHOT_OPTIONS_BY_PERSONENMODUS: Partial<Record<PersonenOption, ShotType[]>> = {
  "Person mit Gesicht": ["45° Hero Shot", "Eye-Level", "Low Angle", "Wide Environmental"],
  "Person ohne Gesicht": ["45° Hero Shot", "Eye-Level", "POV / Over-Shoulder", "Wide Environmental", "Low Angle"],
  "Hände/Arme ohne Gesicht": ["Close-Up / Detail", "Eye-Level", "POV / Over-Shoulder", "Flat Lay / Top-Down"],
};

type BeerFamily = "weizen" | "pils" | "helles" | "koelsch" | "stout" | "ipa" | "maerzen" | "festbier" | "alkoholfrei" | "generic";

type BeerServingRule = {
  preferredGlassRegex: RegExp;
  allowedGlassRegexes: RegExp[];
  allowedBottleTypes: FlaschenTyp[];
  strictNoSubstitution: boolean;
};

const BEER_SERVING_COMPATIBILITY: Record<BeerFamily, BeerServingRule> = {
  weizen: {
    preferredGlassRegex: /(weizen glass|weissbier|weißbier|hefeweizen|weizenbierflasche)/i,
    allowedGlassRegexes: [/(weizen glass|weissbier|weißbier|hefeweizen)/i],
    allowedBottleTypes: ["Stubbi / NRW", "Bügelflasche"],
    strictNoSubstitution: true,
  },
  pils: {
    preferredGlassRegex: /(pilsner flute|pils)/i,
    allowedGlassRegexes: [/(pilsner flute|pils|willibecher)/i],
    allowedBottleTypes: ["Longneck", "Euroflasche", "Stubbi / NRW", "Dose", "Bügelflasche"],
    strictNoSubstitution: true,
  },
  helles: {
    preferredGlassRegex: /(willibecher|lager|helles)/i,
    allowedGlassRegexes: [/(willibecher|pokal|lager|helles)/i],
    allowedBottleTypes: ["Longneck", "Stubbi / NRW", "Euroflasche", "Bügelflasche", "Dose"],
    strictNoSubstitution: true,
  },
  koelsch: {
    preferredGlassRegex: /(koelsch|kölsch|stange)/i,
    allowedGlassRegexes: [/(koelsch|kölsch|stange)/i],
    allowedBottleTypes: ["Longneck", "Euroflasche", "Stubbi / NRW", "Dose"],
    strictNoSubstitution: true,
  },
  stout: {
    preferredGlassRegex: /(snifter|stout|porter)/i,
    allowedGlassRegexes: [/(snifter|stout|porter|tulip)/i],
    allowedBottleTypes: ["Longneck", "Euroflasche", "Stubbi / NRW", "Dose"],
    strictNoSubstitution: true,
  },
  ipa: {
    preferredGlassRegex: /(nonic pint|ipa|pale ale)/i,
    allowedGlassRegexes: [/(nonic pint|ipa|pale ale|willibecher)/i],
    allowedBottleTypes: ["Longneck", "Euroflasche", "Stubbi / NRW", "Dose"],
    strictNoSubstitution: true,
  },
  maerzen: {
    preferredGlassRegex: /(stein|pokal|maerzen|märzen|festbier)/i,
    allowedGlassRegexes: [/(stein|pokal|maerzen|märzen|festbier|willibecher)/i],
    allowedBottleTypes: ["Longneck", "Euroflasche", "Stubbi / NRW", "Bügelflasche", "Dose"],
    strictNoSubstitution: true,
  },
  festbier: {
    preferredGlassRegex: /(stein|pokal|festbier|willibecher)/i,
    allowedGlassRegexes: [/(stein|pokal|festbier|willibecher)/i],
    allowedBottleTypes: ["Longneck", "Euroflasche", "Stubbi / NRW", "Bügelflasche", "Dose"],
    strictNoSubstitution: true,
  },
  alkoholfrei: {
    preferredGlassRegex: /(willibecher|pilsner flute|weizen glass)/i,
    allowedGlassRegexes: [/(willibecher|pilsner flute|weizen glass|stange)/i],
    allowedBottleTypes: ["Longneck", "Euroflasche", "Stubbi / NRW", "Bügelflasche", "Dose"],
    strictNoSubstitution: true,
  },
  generic: {
    preferredGlassRegex: /(willibecher|pilsner|glass)/i,
    allowedGlassRegexes: [/(glass|willibecher|pilsner|weizen)/i],
    allowedBottleTypes: ["Longneck", "Euroflasche", "Stubbi / NRW", "Bügelflasche", "Dose"],
    strictNoSubstitution: false,
  },
};

function mapBeerData(biertyp: string) {
  const glass = glassByBeer.find((e) => e.match.test(biertyp))?.glass ?? "traditional Willibecher glass";
  const specs =
    beerSpecs.find((e) => e.match.test(biertyp)) ?? {
      liquid: "vibrant golden amber clarity",
      foam: "dense ivory-white foam crown with fine pores",
      carbonation: "fine ascending pearl-like bubbles",
    };
  return { glass, ...specs };
}

function detectBeerFamily(brief: PromptBrief): BeerFamily {
  const combined = `${brief.biertyp} ${brief.textImLabel} ${brief.markenname}`.toLowerCase();
  if (/(weizen|weißbier|weissbier|hefeweizen)/i.test(combined)) return "weizen";
  if (/(pils|pilsner)/i.test(combined)) return "pils";
  if (/(helles|lager|export)/i.test(combined)) return "helles";
  if (/(kölsch|koelsch)/i.test(combined)) return "koelsch";
  if (/(stout|porter|schwarzbier)/i.test(combined)) return "stout";
  if (/(ipa|pale ale|apa)/i.test(combined)) return "ipa";
  if (/(märzen|maerzen|bock|doppelbock)/i.test(combined)) return "maerzen";
  if (/(festbier|oktoberfest)/i.test(combined)) return "festbier";
  if (/alkoholfrei/i.test(combined)) return "alkoholfrei";
  return "generic";
}

function validateServingCompatibility(brief: PromptBrief) {
  const beerFamily = detectBeerFamily(brief);
  const profile = mapBeerData(brief.biertyp || "Helles");
  const rule = BEER_SERVING_COMPATIBILITY[beerFamily] ?? BEER_SERVING_COMPATIBILITY.generic;
  const blockers: string[] = [];
  const fixSuggestions: Array<{ text: string; field: keyof PromptBrief }> = [];

  const glassAllowed = rule.allowedGlassRegexes.some((regex) => regex.test(profile.glass));
  if (!glassAllowed) {
    blockers.push(`Glas passt nicht zum Biertyp (${brief.biertyp || "Bier"}).`);
    fixSuggestions.push({ text: "Bitte Biertyp oder Glas-Logik anpassen (z. B. Weißbier -> Weizenbierglas).", field: "biertyp" });
  }

  const bottleVisible = brief.behaelter === "Nur Flasche" || brief.behaelter === "Flasche + Glas";
  if (bottleVisible && brief.flaschenTyp) {
    const bottleType = normalizeFlaschenTyp(brief.flaschenTyp as FlaschenTyp);
    const bottleAllowed = bottleType ? rule.allowedBottleTypes.includes(bottleType) : false;
    if (!bottleAllowed) {
      blockers.push(`Flaschentyp passt nicht zum Biertyp (${brief.biertyp || "Bier"}).`);
      fixSuggestions.push({ text: "Wähle einen passenden Flaschentyp für den Biertyp.", field: "flaschenTyp" });
    }
  }

  if (brief.behaelter === "Flasche + Glas" && rule.strictNoSubstitution) {
    if (!rule.preferredGlassRegex.test(profile.glass)) {
      blockers.push("Flasche + Glas verlangt eine konsistente Bierfamilie im Glas.");
      fixSuggestions.push({ text: "Für diese Bierfamilie ein passendes Glas erzwingen.", field: "behaelter" });
    }
  }

  return { beerFamily, profile, blockers, fixSuggestions };
}

function resolveBeerProfile(brief: PromptBrief) {
  const baseType = (brief.biertyp || "").trim();
  const labelHint = `${brief.textImLabel || ""} ${brief.markenname || ""}`;
  if (/alkoholfrei/i.test(baseType)) {
    if (/(weizen|weißbier|weissbier|hefeweizen)/i.test(labelHint)) {
      return { servingType: "alkoholfreies Weizenbier", ...mapBeerData("Weizen") };
    }
    if (/(pils|pilsner)/i.test(labelHint)) {
      return { servingType: "alkoholfreies Pils", ...mapBeerData("Pils") };
    }
    if (/(helles|lager|export)/i.test(labelHint)) {
      return { servingType: "alkoholfreies Helles", ...mapBeerData("Helles") };
    }
    return { servingType: "alkoholfreies Bier", ...mapBeerData("Alkoholfrei") };
  }
  return { servingType: baseType || "Bier", ...mapBeerData(baseType || "Helles") };
}

function getScenePromptParts(brief: PromptBrief) {
  const config = SCENE_CONFIG[brief.bildtyp as BildtypOption];
  if (!config) {
    return {
      sceneType: "",
      sceneCore: "",
      sceneComposition: "",
      sceneContext: "",
      sceneNegative: "",
      guidanceTips: [] as string[],
    };
  }
  return {
    sceneType: config.sceneType,
    sceneCore: config.sceneCore,
    sceneComposition: config.sceneComposition,
    sceneContext: config.sceneContext,
    sceneNegative: config.sceneNegative,
    guidanceTips: config.guidanceTips,
  };
}

function getSceneStepOptions(brief: PromptBrief, key: keyof PromptBrief): string[] | undefined {
  const scene = brief.bildtyp as BildtypOption | "";
  if (!scene) return undefined;
  const config = SCENE_CONFIG[scene];
  const optionOverrides = config.fieldPolicy.optionOverrides ?? {};
  if (optionOverrides[key]?.length) return optionOverrides[key];
  if (key === "stimmung") return config.allowedMoods;
  if (key === "personenModus" && config.allowedPersonModes?.length) return config.allowedPersonModes;
  if (key === "shotType") {
    const byPerson = brief.personenModus ? SHOT_OPTIONS_BY_PERSONENMODUS[brief.personenModus as PersonenOption] : undefined;
    return byPerson?.length ? config.allowedShotTypes.filter((shot) => byPerson.includes(shot)) : config.allowedShotTypes;
  }
  return undefined;
}

function enforceSceneContract(prompt: string, brief: PromptBrief): string {
  const scene = brief.bildtyp as BildtypOption | "";
  if (!scene || !SCENE_CONFIG[scene]) return prompt;
  const contract = SCENE_CONFIG[scene].promptContract;
  const lockLine = contract.hardLocks.join(" ");
  const negativeLine =
    contract.mustExclude.length > 0
      ? `Scene exclusion lock: avoid ${contract.mustExclude.map((regex) => regex.source.replace(/[()]/g, "")).join(" | ")}.`
      : "";
  return [prompt, lockLine, negativeLine].filter(Boolean).join(" ");
}

function buildPrompt(brief: PromptBrief) {
  const { servingType, glass, liquid, foam, carbonation } = resolveBeerProfile(brief);
  const ratio = ratioByPlatform[brief.plattform as Plattform];
  const isStudioProduct = brief.bildtyp === "Produkt-Studio";
  const sceneParts = getScenePromptParts(brief);
  const scene = isStudioProduct
    ? "isolated premium studio product scene on seamless neutral background (light gray/white), zero environmental context, catalog-ready composition"
    : trendByMood[brief.stimmung as Stimmung];
  const light = isStudioProduct
    ? "controlled high-key studio softbox lighting, even exposure, clean shadow gradient under product, no sunlight direction cues"
    : lightByMood[brief.stimmung as Stimmung];
  const lens = isStudioProduct
    ? "captured with 85mm lens at f/8, front-priority product composition, crisp edge definition"
    : lensByPlatform[brief.plattform as Plattform];
  const brandPart =
    brief.markenname && brief.markenname.toLowerCase() !== "generisch"
      ? `for the brewery brand "${brief.markenname}"`
      : "for a premium craft brewery campaign";

  const labelPart = brief.textImLabel
    ? `Text on label reads "${brief.textImLabel}" in elegant legible typography.`
    : "";
  const referenceStrengthPart =
    brief.referenzStaerke === "Strikt"
      ? "Reference adherence: STRICT. Match logo, layout, typography proportions, and color blocks from reference as closely as possible without distortion."
      : brief.referenzStaerke === "Hoch"
        ? "Reference adherence: HIGH. Keep branding, composition language, and typography style closely aligned to the reference."
        : brief.referenzStaerke === "Niedrig"
          ? "Reference adherence: LOW. Use reference mostly for general mood and color direction."
          : "Reference adherence: MEDIUM. Follow key brand cues from reference while allowing creative adaptation.";
  const labelQualityPart =
    brief.etikettModus === "Ja, Etikett 1:1"
      ? "Label fidelity requirement: text must be tack-sharp, undistorted, front-readable, and free from warped or melted glyphs."
      : "If any label text appears, keep it crisp and readable.";
  const bgPart = brief.besondererHintergrund
    ? isStudioProduct
      ? `Background detail override: ${brief.besondererHintergrund}. Keep it minimal, neutral, and studio-like without outdoor context.`
      : `Background detail: ${brief.besondererHintergrund}.`
    : "";
  const seasonPart = brief.saisonalerBezug ? `Seasonal context: ${brief.saisonalerBezug}.` : "";
  const combinedAvoids = [...DEFAULT_NEGATIVE_PROMPTS, ...(brief.vermeiden ? [brief.vermeiden] : [])].join(", ");
  const avoidPart = `Avoid: ${combinedAvoids}.`;
  const bildtypPart = sceneParts.sceneType || (brief.bildtyp ? sceneByBildtyp[brief.bildtyp as BildtypOption] : "");
  const sceneHardRule = sceneParts.sceneCore
    ? `Scene hard rules: ${sceneParts.sceneCore} ${sceneParts.sceneComposition}`
    : brief.bildtyp
      ? sceneHardRulesByBildtyp[brief.bildtyp as BildtypOption]
      : "";
  const sceneContextRule = sceneParts.sceneContext ? `Scene context rules: ${sceneParts.sceneContext}` : "";
  const sceneNegativeRule = sceneParts.sceneNegative || (brief.bildtyp ? sceneNegativeRulesByBildtyp[brief.bildtyp as BildtypOption] : "");
  const sceneContractLock =
    brief.bildtyp && SCENE_CONFIG[brief.bildtyp as BildtypOption]
      ? SCENE_CONFIG[brief.bildtyp as BildtypOption].promptContract.hardLocks.join(" ")
      : "";
  const macroRealismRule =
    brief.bildtyp === "Makro/Detail"
      ? [
          "Macro realism lock: use a true macro-photography look (around 85-120mm macro lens feel) with realistic depth compression.",
          "Focus behavior: keep only the key branding/material zone tack-sharp, with natural optical falloff outside that zone.",
          "Material realism: condensation droplets must vary in size and spacing, foam edge must be physically irregular, and glass refraction must remain believable.",
          "Texture realism: preserve micro label print texture, subtle paper grain/ink edges, and tiny real-world imperfections rather than sterile CGI smoothness.",
        ].join(" ")
      : "";
  const personRule =
    brief.personenModus === "Person mit Gesicht"
      ? "Human subject requirement (MANDATORY): include at least one clearly visible person with a natural, fully visible face (both eyes, nose, mouth visible). The person must actively interact with the beer setup (holding, pouring, or presenting bottle/glass). Face must occupy a meaningful image area (roughly >= 12% of frame height) and must not be cropped, blurred, turned away, or occluded."
      : brief.personenModus === "Person ohne Gesicht"
        ? "Human subject requirement: include at least one person in the scene, but do NOT show a recognizable face. Keep face turned away, out of frame, or naturally occluded."
        : brief.personenModus === "Hände/Arme ohne Gesicht"
          ? "Human subject requirement: include realistic hands/arms interacting with bottle or glass; no visible face or full person."
          : "Human subject requirement: no humans, no hands, no body parts visible in frame.";
  const personNegativeRule =
    brief.personenModus === "Person mit Gesicht"
      ? "Person negatives: do not output bottle-only packshot, do not hide face, do not use silhouette/back view only, do not place person too far in background."
      : brief.personenModus === "Person ohne Gesicht"
        ? "Person negatives: no recognizable facial features, no clear frontal portrait."
        : brief.personenModus === "Hände/Arme ohne Gesicht"
          ? "Person negatives: no visible face and no full-body subject."
          : "";
  const personCompositionRule =
    brief.personenModus === "Person mit Gesicht"
      ? "Composition mandate: include at least one person in foreground or midground with a clearly readable face and natural expression; avoid product-only framing. Keep person and product both important in frame."
      : "";
  const genderPart = getGenderPromptSentence(brief, "assistant");
  const studioLockRule = isStudioProduct
    ? "Studio lock (non-negotiable): no outdoor scenery, no mountains/forest/river/sky, no beer garden/bar/restaurant context, no location storytelling. Keep this a controlled studio setup with product-first composition."
    : "";
  const studioStyleRule =
    isStudioProduct && brief.studioStyle
      ? studioStyleDirectiveByOption[brief.studioStyle as StudioStyleOption]
      : "";
  const studioPropsRule =
    isStudioProduct && brief.studioStyle
      ? studioPropsRuleByStyle[brief.studioStyle as StudioStyleOption]
      : "";
  const selectedStudioProps =
    isStudioProduct && brief.studioProps
      ? brief.studioProps
          .split(" | ")
          .map((s) => s.trim())
          .filter(Boolean) as Array<(typeof STUDIO_PROP_OPTIONS)[number]>
      : [];
  const studioDetailPart =
    selectedStudioProps.length > 0
      ? `Requested prop set: ${selectedStudioProps.map((prop) => studioPropEnglishNameByOption[prop]).join(", ")}. Keep props tasteful and secondary to product hierarchy.`
      : "";
  const studioPropHardRules =
    selectedStudioProps.length > 0
      ? selectedStudioProps
          .map((prop) => studioPropDirectiveByOption[prop] ?? "")
          .filter(Boolean)
          .join(" ")
      : "";
  const studioPropExclusivityRule =
    selectedStudioProps.length > 0
      ? `Prop exclusivity: do not introduce unrelated garnish/props beyond selected set (${selectedStudioProps
          .map((prop) => studioPropEnglishNameByOption[prop])
          .join(", ")}).`
      : "";
  const ratioLockRule = `Aspect ratio lock: final composition must strictly match ${ratio}.`;
  const servingCompatibility = validateServingCompatibility(brief);
  const strictGlassRule =
    servingCompatibility.beerFamily === "weizen"
      ? `Mandatory glass constraint: use only ${glass}. Do not substitute with Pilsner flute, Willibecher, Stange, goblet, or stein.`
      : `Mandatory glass constraint: use only ${glass}. Never use a Weizen glass for ${brief.biertyp}.`;
  const servingTruthLock = [
    `Serving truth lock: beer family is ${servingCompatibility.beerFamily}, keep bottle and poured glass in same family.`,
    `Glass exclusivity lock: do not substitute ${glass} with another glass type.`,
    "No substitution lock: do not alter beer style between bottle label and poured liquid.",
  ].join(" ");
  const gastroServingLock =
    brief.bildtyp === "Gastro-Serviermoment"
      ? "Gastro serving lock: serving action must preserve exact same variant in bottle and glass; no cross-style pour is allowed. Capture the exact moment of pour or handoff; reject static posing."
      : "";
  const selectedBottleType = normalizeFlaschenTyp(brief.flaschenTyp as FlaschenTyp | "");
  const bottleIdentityLock =
    (brief.behaelter === "Nur Flasche" || brief.behaelter === "Flasche + Glas") && selectedBottleType
      ? `Bottle identity lock (NON-NEGOTIABLE): selected bottle type is ${selectedBottleType}. Render exactly this silhouette only; never reinterpret as another returnable bottle family.`
      : "";
  const bottleShapePriorityRule =
    selectedBottleType === "Stubbi / NRW"
      ? "Priority geometry override (Stubbi/NRW): silhouette fidelity is mandatory. If any conflict occurs with style, scene, food styling, or lens aesthetics, keep the Stubbi/NRW geometry and sacrifice secondary styling instead."
      : "";
  const containerRule =
    brief.behaelter === "Flasche + Glas"
      ? "Composition constraint: show BOTH a bottle/can and a poured glass in the same frame, side by side, both clearly visible."
      : brief.behaelter === "Nur Flasche"
        ? "Composition constraint: show ONLY bottle/can, no poured glass visible."
        : "Composition constraint: show ONLY poured glass, no bottle/can visible.";

  const variantConsistencyRule =
    brief.behaelter === "Flasche + Glas"
      ? `Product consistency lock: the poured glass MUST be the exact same product variant as the bottle/can (same beer family, same alcohol state). If bottle is ${servingType}, the glass content must also be ${servingType}. No style mismatch allowed.`
      : "";

  if (brief.kiPlattform === "Midjourney") {
    const core = [
      `${brief.biertyp} beer ${brandPart}`,
      genderPart,
      `${liquid}`,
      `${foam}`,
      `${carbonation}`,
      `${glass}`,
      brief.behaelter === "Flasche + Glas"
        ? `glass content must be same variant as bottle (${servingType}), no style mismatch`
        : "",
      "crystal-clear dielectric glass material with accurate refraction",
      "fine condensation perspiration droplets on chilled surface",
      `${scene}`,
      `${light}`,
      `${lens}`,
      labelPart ? labelPart.replace(/\.$/, "") : "",
      seasonPart ? seasonPart.replace(/^Seasonal context:\s*/, "").replace(/\.$/, "") : "",
      bgPart ? bgPart.replace(/^Background detail:\s*/, "").replace(/\.$/, "") : "",
      "professional beverage photography",
      avoidPart ? `--no ${brief.vermeiden}` : "",
      `--ar ${ratio} --style raw --v 6.1 --q 2`,
    ]
      .filter(Boolean)
      .join(", ");

    return { prompt: core, ratio };
  }

  const prompt = [
    `Create a photorealistic brewery marketing image ${brandPart}.`,
    "Priority order: hard constraints > scene rules > product realism > style polish.",
    strictGlassRule,
    servingTruthLock,
    gastroServingLock,
    bottleIdentityLock,
    bottleShapePriorityRule,
    containerRule,
    variantConsistencyRule,
    ratioLockRule,
    referenceStrengthPart,
    labelQualityPart,
    labelPart,
    bildtypPart,
    sceneHardRule,
    sceneContextRule,
    sceneNegativeRule,
    sceneContractLock,
    macroRealismRule,
    personRule,
    personCompositionRule,
    personNegativeRule,
    genderPart,
    studioLockRule,
    studioStyleRule,
    studioPropsRule,
    studioDetailPart,
    studioPropHardRules,
    studioPropExclusivityRule,
    `Feature a perfectly poured ${servingType} in a ${glass}, with ${liquid}, ${carbonation}, and ${foam}.`,
    "Use crystal-clear glass with subsurface scattering, dielectric refraction, and crisp specular highlights on condensation droplets.",
    `Scene: ${scene}.`,
    `Lighting: ${light} with subtle rim lighting to separate the glass from background.`,
    `${lens}, composed for ${ratio} aspect ratio.`,
    seasonPart,
    bgPart,
    avoidPart,
    "Render high detail textures and premium commercial quality.",
  ]
    .filter(Boolean)
    .join(" ");

  return { prompt, ratio };
}

function enforceContainerConstraints(prompt: string, brief: PromptBrief): string {
  const lower = prompt.toLowerCase();
  if (brief.behaelter === "Flasche + Glas") {
    const hasBottle = /(bottle|can|flasche|dose)/i.test(lower);
    const hasGlass = /(glass|willibecher|weizen glass|pilsner flute|snifter|goblet|pokal|stein)/i.test(lower);
    if (!hasBottle || !hasGlass) {
      return `${prompt} Ensure composition contains BOTH a bottle/can and a poured glass, side by side, both fully visible and in realistic proportion.`;
    }
  }
  if (brief.behaelter === "Nur Flasche" && /(poured glass|glass of beer|beer glass)/i.test(lower)) {
    return `${prompt} Ensure there is NO poured glass visible; bottle/can only.`;
  }
  if (brief.behaelter === "Nur Glas" && /(beer bottle|bottle|can|flasche|dose)/i.test(lower)) {
    return `${prompt} Ensure there is NO bottle/can visible; glass only.`;
  }
  return prompt;
}

function enforcePeopleConstraints(prompt: string, brief: PromptBrief): string {
  if (brief.personenModus === "Person mit Gesicht") {
    const hasFaceRule = /(clearly visible.*face|full.*recognizable face|eyes.*nose.*mouth|human subject requirement)/i.test(prompt);
    const hasBottleOnlyRule = /(bottle\/can only|bottle only|no humans|no hands|no body parts|product-only|do not return a bottle-only)/i.test(
      prompt,
    );
    let next = prompt;
    if (!hasFaceRule) {
      next = `${next} Human subject requirement (MANDATORY): include at least one clearly visible, fully recognizable face (eyes, nose, mouth visible), interacting naturally with the product.`;
    }
    if (hasBottleOnlyRule) {
      next = `${next} Override conflict rule: when 'Person mit Gesicht' is selected, do NOT use bottle-only composition.`;
    }
    next = `${next} Hard validation: image is invalid if no clearly visible face appears in-frame.`;
    return next;
  }

  if (brief.personenModus === "Person ohne Gesicht") {
    return `${prompt} Hard validation: image is invalid if a recognizable face is visible.`;
  }

  if (brief.personenModus === "Hände/Arme ohne Gesicht") {
    return `${prompt} Hard validation: image is invalid if a full person or recognizable face is visible.`;
  }

  return `${prompt} Hard validation: image is invalid if any humans, hands, or body parts are visible.`;
}

function getGenderPromptSentence(brief: PromptBrief, promptMode?: "assistant" | "manual"): string {
  if (!brief.personGeschlecht || brief.personGeschlecht === "Egal") {
    return "";
  }
  const humanInBrief = Boolean(brief.personenModus && brief.personenModus !== "Kein Mensch");
  if (!humanInBrief && promptMode !== "manual") {
    return "";
  }
  if (brief.personenModus === "Kein Mensch") {
    return "";
  }
  if (brief.personGeschlecht === "Frau") {
    return "Gender depiction lock (MANDATORY): any visible human subject or body parts must read clearly as an adult woman (female-presenting). For hands/arms-only shots, show a woman's hands/arms with believable female-coded proportions. Do not depict an obviously male-presenting subject.";
  }
  return "Gender depiction lock (MANDATORY): any visible human subject or body parts must read clearly as an adult man (male-presenting). For hands/arms-only shots, show a man's hands/arms with believable male-coded proportions. Do not depict an obviously female-presenting subject.";
}

function appendGenderConstraint(
  prompt: string,
  brief: PromptBrief,
  promptMode?: "assistant" | "manual",
): string {
  const sentence = getGenderPromptSentence(brief, promptMode);
  if (!sentence) return prompt;
  if (/Gender depiction lock \(MANDATORY\)/i.test(prompt)) return prompt;
  return `${prompt} ${sentence}`;
}

function runQualityCheck(brief: PromptBrief, prompt: string, ratio: string) {
  const { glass } = mapBeerData(brief.biertyp);
  const scene = brief.bildtyp as BildtypOption | "";
  const sceneMustHavePatterns: Partial<Record<BildtypOption, RegExp>> = {
    "Produkt-Studio": /(studio|seamless|catalog|clean background)/i,
    Lifestyle: /(lifestyle|authentic|everyday|natural context)/i,
    "Biergarten/Genussmoment": /(beer garden|outdoor|social|table)/i,
    "Gastro-Serviermoment": /(service|serving|bar|counter|hospitality)/i,
    "Event/Promotion": /(campaign|promotion|copy-space|cta|headline)/i,
    "Food-Pairing": /(food|pairing|dish|plate|culinary)/i,
    "Makro/Detail": /(macro|close-up|texture|micro-detail|condensation)/i,
  };
  const sceneNegativePatterns: Partial<Record<BildtypOption, RegExp>> = {
    "Produkt-Studio": /(outdoor mountain|beer garden setting)/i,
    "Makro/Detail": /(wide environmental|far distance)/i,
  };
  const peopleRuleSatisfied =
    brief.personenModus === "Person mit Gesicht"
      ? /(visible person|human subject|face|eyes|nose|mouth|portrait)/i.test(prompt)
      : brief.personenModus === "Person ohne Gesicht"
        ? /(include at least one person|human subject)/i.test(prompt) && /(do not show a recognizable face|no recognizable face|face turned away)/i.test(prompt)
        : brief.personenModus === "Hände\/Arme ohne Gesicht"
          ? /(hands|arms)/i.test(prompt) && /(no visible face|no full person)/i.test(prompt)
          : /(no humans|no hands|no body parts)/i.test(prompt);
  const checks = [
    prompt.toLowerCase().includes(glass.toLowerCase()),
    /(bubble|carbonation|effervescence)/i.test(prompt),
    /(foam|head|lacing)/i.test(prompt),
    /(condensation|chilled|frost)/i.test(prompt),
    /(lighting|light|chiaroscuro|daylight|tungsten|golden hour)/i.test(prompt),
    /(lens|mm|f\/)/i.test(prompt),
    Boolean(ratio),
    /^[\x00-\x7F\s\S]*$/.test(prompt) || true,
    Boolean(brief.stimmung),
    peopleRuleSatisfied,
    !/(real person|celebrity|famous person)/i.test(prompt),
    scene ? (sceneMustHavePatterns[scene] ? sceneMustHavePatterns[scene]!.test(prompt) : true) : true,
    scene ? (sceneNegativePatterns[scene] ? !sceneNegativePatterns[scene]!.test(prompt) : true) : true,
  ];
  return checks.every(Boolean);
}

function buildLabelLockPrefix(brief: PromptBrief, hasReferenceImage: boolean): string {
  if (brief.etikettModus !== "Ja, Etikett 1:1") return "";

  if (!hasReferenceImage) {
    return "";
  }

  const strengthLine = "REFERENCE STRENGTH: STRICT (FORCED). Treat the reference as locked brand identity.";

  return [
    "NON-NEGOTIABLE LABEL LOCK:",
    strengthLine,
    "PRIMARY SUBJECT LOCK: The generated bottle/can must be the SAME brand/product identity as in the attached reference, not a different brand.",
    "Do NOT invent or redesign the label.",
    "Do NOT replace with another bottle design, another logo, or another colorway.",
    "Do NOT paste, overlay, collage, sticker, or superimpose any reference image onto the result.",
    "Re-render the full bottle photorealistically in-scene; reference is for identity matching only.",
    "Preserve the original brand mark, label geometry, typography hierarchy, and color blocks from reference.",
    "Label text must be clean, sharp, readable, and undistorted (no warped, melted, mirrored, or blurred letters).",
    "Keep label placement physically correct on bottle curvature with realistic perspective, reflections, and contact shadows.",
    "Bottle neck label and main body label must remain stylistically consistent with reference.",
  ].join(" ");
}

function buildPhysicalRealismRule(brief: PromptBrief): string {
  const bottleScaleRule =
    brief.flaschenVolumen === "330ml"
      ? "Physical scale lock: 330ml bottle should appear compact in hand (roughly 22-24 cm height impression), never oversized."
      : brief.flaschenVolumen === "500ml"
        ? "Physical scale lock: 500ml bottle should appear standard beer-bottle size in hand (roughly 25-27 cm height impression)."
        : brief.flaschenVolumen === "750ml"
          ? "Physical scale lock: 750ml bottle can appear larger but still human-hand plausible, never toy-like or giant."
          : "Physical scale lock: bottle size must remain anatomically plausible relative to hands, arms, and body.";

  const bottleType = normalizeFlaschenTyp(brief.flaschenTyp as FlaschenTyp | "");
  const bottleShapeRule =
    bottleType === "Longneck"
      ? "Bottle geometry lock (Longneck): slim cylindrical body with clearly elongated narrow neck and realistic shoulder transition; never short, wide, or bulky."
      : bottleType === "Stubbi / NRW"
        ? "Bottle geometry lock (Stubbi/NRW): MUST render a compact German NRW/stubby returnable bottle silhouette with distinctly short neck, fuller shoulder/body ratio, and visibly shorter overall profile than a Longneck. Keep realistic crown-cap geometry and authentic returnable-bottle proportions."
        : bottleType === "Euroflasche"
          ? "Bottle geometry lock (Euroflasche): classic balanced returnable silhouette with medium neck and realistic body taper."
          : bottleType === "Bügelflasche"
            ? "Bottle geometry lock (Bügelflasche): swing-top silhouette with authentic closure and physically plausible neck/body proportions."
            : bottleType === "Dose"
              ? "Container geometry lock (Dose): standard cylindrical can silhouette with realistic dimensions."
              : "Bottle geometry lock: maintain realistic brewery container proportions.";
  const bottleTypeExclusionRule =
    bottleType === "Longneck"
      ? "Bottle type exclusion lock (Longneck): do NOT render Stubbi/NRW, Euroflasche, Buegelflasche, or can silhouettes."
      : bottleType === "Stubbi / NRW"
        ? "Bottle type exclusion lock (Stubbi/NRW): FORBIDDEN silhouettes are Longneck, Euroflasche, Buegelflasche, and can. Do NOT output medium/long neck bottles. NRW/Stubbi proportion lock: short neck + compact shoulder profile + visibly stubby body height, never medium-neck Euro silhouette."
        : bottleType === "Euroflasche"
          ? "Bottle type exclusion lock (Euroflasche): do NOT render Stubbi/NRW, Longneck, Buegelflasche, or can silhouettes."
          : bottleType === "Bügelflasche"
            ? "Bottle type exclusion lock (Buegelflasche): do NOT render Stubbi/NRW, Euroflasche, Longneck, or can silhouettes."
            : bottleType === "Dose"
              ? "Container type exclusion lock (Can): do NOT render any bottle silhouette."
              : "";

  const ipaGlassRule =
    detectBeerFamily(brief) === "ipa"
      ? "IPA glass lock: poured beer must be in a nonic pint IPA glass. Forbidden glass types: Weizen glass, Pilsner flute, Stange, stein, goblet."
      : "";

  return [
    bottleScaleRule,
    bottleShapeRule,
    bottleTypeExclusionRule,
    ipaGlassRule,
    "No cutout/sticker look: object must be fully integrated into scene with consistent perspective and lens distortion.",
    "Require realistic contact cues: finger occlusion, grip pressure, tiny deformations, and natural hand-to-glass interaction.",
    "Require coherent lighting and shadowing: contact shadows on fingers/palm, matching highlights, and color bleed from environment.",
    "Do not allow floating, pasted, or mismatched-edge artifacts around bottle silhouette.",
  ].join(" ");
}

function applySceneAutoFixes(brief: PromptBrief) {
  const next = { ...brief };
  const autoFixes: string[] = [];
  const scene = next.bildtyp as BildtypOption | "";
  if (!scene || !SCENE_CONFIG[scene]) {
    return { brief: next, autoFixes };
  }
  const config = SCENE_CONFIG[scene];
  const autoFixPolicy = config.autoFixPolicy;

  if (!next.stimmung || !config.allowedMoods.includes(next.stimmung as Stimmung)) {
    next.stimmung = autoFixPolicy.fallbackMood;
    autoFixes.push(`Stimmung an Szene angepasst (${next.stimmung}).`);
  }

  if (!next.shotType || !config.allowedShotTypes.includes(next.shotType as ShotType)) {
    next.shotType = autoFixPolicy.fallbackShotType;
    autoFixes.push(`Shot-Typ an Szene angepasst (${next.shotType}).`);
  }

  if (
    config.allowedPersonModes &&
    (!next.personenModus || !config.allowedPersonModes.includes(next.personenModus as PersonenOption))
  ) {
    next.personenModus = autoFixPolicy.fallbackPersonMode ?? config.allowedPersonModes[0] ?? next.personenModus;
    autoFixes.push(`Personenmodus an Szene angepasst (${next.personenModus}).`);
  }

  if (next.personenModus === "Person mit Gesicht" && (next.shotType === "POV / Over-Shoulder" || next.shotType === "Drone / Aerial")) {
    next.shotType = "Eye-Level";
    autoFixes.push("Shot-Typ für sichtbares Gesicht auf Eye-Level korrigiert.");
  }

  if (next.personenModus === "Hände/Arme ohne Gesicht" && next.shotType === "Wide Environmental") {
    next.shotType = "Close-Up / Detail";
    autoFixes.push("Shot-Typ für Hände/Arme auf Close-Up korrigiert.");
  }

  if (scene === "Makro/Detail" && !["Close-Up / Detail", "Eye-Level", "Flat Lay / Top-Down"].includes(next.shotType)) {
    next.shotType = "Close-Up / Detail";
    autoFixes.push("Makro/Detail auf nahen Shot-Typ korrigiert.");
  }

  if (scene === "Produkt-Studio" && next.besondererHintergrund.trim() && !(STUDIO_BACKGROUND_OPTIONS as readonly string[]).includes(next.besondererHintergrund)) {
    next.besondererHintergrund = STUDIO_BACKGROUND_OPTIONS[0];
    autoFixes.push("Produkt-Studio-Hintergrund auf Studio-Option korrigiert.");
  }
  if (scene === "Produkt-Studio" && !next.besondererHintergrund.trim()) {
    next.besondererHintergrund = autoFixPolicy.defaultBackground ?? STUDIO_BACKGROUND_OPTIONS[0];
    autoFixes.push("Produkt-Studio-Hintergrund automatisch gesetzt.");
  }
  if (scene !== "Produkt-Studio" && !next.besondererHintergrund.trim() && autoFixPolicy.defaultBackground) {
    next.besondererHintergrund = autoFixPolicy.defaultBackground;
    autoFixes.push(`Szenen-Hintergrund für ${scene} automatisch gesetzt.`);
  }
  if (!next.saisonalerBezug.trim() && autoFixPolicy.defaultSeason) {
    next.saisonalerBezug = autoFixPolicy.defaultSeason;
    autoFixes.push(`Saisonaler Bezug für ${scene} automatisch ergänzt.`);
  }

  // Hard boundaries: never auto-rewrite product-truth fields.
  next.biertyp = brief.biertyp;
  next.behaelter = brief.behaelter;
  next.flaschenTyp = normalizeFlaschenTyp(brief.flaschenTyp as FlaschenTyp | "");
  next.flaschenVolumen = brief.flaschenVolumen;
  next.etikettModus = brief.etikettModus;

  return { brief: next, autoFixes };
}

function evaluatePreflight(
  brief: PromptBrief,
  promptText: string,
  hasReferenceImage: boolean,
  autoFixes: string[] = [],
): PreflightReport {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const fixSuggestions: Array<{ text: string; field: keyof PromptBrief }> = [];
  const isStudioProduct = brief.bildtyp === "Produkt-Studio";
  const scene = brief.bildtyp as BildtypOption | "";
  const sceneConfig = scene ? SCENE_CONFIG[scene] : null;
  const serving = validateServingCompatibility(brief);
  blockers.push(...serving.blockers);
  fixSuggestions.push(...serving.fixSuggestions);

  if (brief.etikettModus === "Ja, Etikett 1:1" && !hasReferenceImage) {
    blockers.push("Für Etikett 1:1 fehlt ein Referenzbild.");
    fixSuggestions.push({ text: "Für Etikett 1:1 bitte ein Referenzbild hochladen.", field: "etikettModus" });
  }
  if (brief.etikettModus === "Ja, Etikett 1:1" && brief.referenzStaerke === "Niedrig") {
    blockers.push("Für Etikett 1:1 ist Referenzstärke 'Niedrig' zu schwach. Nutze mindestens 'Hoch'.");
  }
  if ((brief.behaelter === "Nur Flasche" || brief.behaelter === "Flasche + Glas") && !brief.flaschenVolumen) {
    blockers.push("Flaschenvolumen fehlt für Flaschen-Szenen.");
    fixSuggestions.push({ text: "Bitte Flaschenvolumen wählen.", field: "flaschenVolumen" });
  }

  if (promptText.trim().length < 120) {
    warnings.push("Prompt ist sehr kurz; höheres Risiko für generische Ergebnisse.");
  }
  if (
    brief.personenModus === "Person mit Gesicht" &&
    !/(visible person|human subject|natural.*face|eyes|nose|mouth)/i.test(promptText)
  ) {
    blockers.push("Gesicht angefordert, aber der Prompt erzwingt kein klar sichtbares Gesicht.");
  }
  if (brief.personenModus === "Person mit Gesicht" && brief.bildtyp === "Produkt-Studio") {
    warnings.push("Produkt-Studio + sichtbares Gesicht ist möglich, aber oft instabil. Für Menschenbilder eher Lifestyle oder Gastro nutzen.");
  }
  if (brief.personenModus === "Kein Mensch" && !/(no humans|no hands|no body parts)/i.test(promptText)) {
    warnings.push("Kein-Mensch-Modus ist nicht explizit im Prompt verankert.");
  }
  if (brief.referenzStaerke === "Strikt" && brief.etikettModus !== "Ja, Etikett 1:1") {
    warnings.push("Referenzstärke Strikt ohne Etikett-1:1 ist oft unnötig restriktiv.");
  }
  if (
    brief.etikettModus === "Ja, Etikett 1:1" &&
    !/label|brand|logo|typography|reference/i.test(promptText)
  ) {
    warnings.push("Prompt erwähnt Label/Branding kaum; Risiko für abweichendes Etikett steigt.");
  }
  if (brief.personenModus !== "Kein Mensch" && brief.shotType === "Drone / Aerial") {
    warnings.push("Menschen + Drone/Aerial erhöht Risiko für unnatürliche Komposition.");
  }
  if (
    brief.personenModus === "Person mit Gesicht" &&
    (brief.shotType === "POV / Over-Shoulder" || brief.shotType === "Drone / Aerial")
  ) {
    blockers.push("Für 'Person mit Gesicht' ist der gewählte Shot-Typ unpassend.");
    fixSuggestions.push({ text: "Für sichtbares Gesicht auf Eye-Level oder 45° Hero Shot wechseln.", field: "shotType" });
  }
  if (brief.personenModus === "Person mit Gesicht" && brief.bildtyp === "Lifestyle" && brief.behaelter === "Nur Flasche") {
    warnings.push("Lifestyle + Gesicht mit 'Nur Flasche' erhöht Risiko für bottle-only Ergebnisse. Besser 'Flasche + Glas'.");
  }
  if (brief.personenModus === "Hände/Arme ohne Gesicht" && brief.shotType === "Wide Environmental") {
    blockers.push("Für 'Hände/Arme ohne Gesicht' bitte einen nahen Shot-Typ wählen.");
  }
  if (sceneConfig) {
    const contract = sceneConfig.promptContract;
    const missingMustInclude = contract.mustInclude.some((regex) => !regex.test(promptText));
    if (missingMustInclude) {
      blockers.push(contract.blockerMessage);
      fixSuggestions.push({ text: `Szene-Regeln für ${scene} stärker erzwingen.`, field: "bildtyp" });
    }
    const sceneInputContext = `${brief.besondererHintergrund} ${brief.saisonalerBezug}`.trim();
    const hasForbiddenPattern = sceneInputContext
      ? contract.mustExclude.some((regex) => regex.test(sceneInputContext))
      : false;
    if (hasForbiddenPattern) {
      blockers.push(`Szene-Konflikt erkannt: Eingaben enthalten verbotene Muster für ${scene}.`);
      fixSuggestions.push({ text: `Hintergrund/Saison für ${scene} anpassen.`, field: "besondererHintergrund" });
    }
  }
  if (isStudioProduct && brief.personenModus !== "Kein Mensch") {
    warnings.push("Produkt-Studio liefert meist bessere Ergebnisse mit 'Kein Mensch'.");
  }
  const isKnownStudioBackground = (STUDIO_BACKGROUND_OPTIONS as readonly string[]).includes(
    brief.besondererHintergrund,
  );
  if (
    isStudioProduct &&
    brief.besondererHintergrund.trim() &&
    !isKnownStudioBackground &&
    /outdoor|berg|mountain|forest|fluss|river|himmel|sky|biergarten|bar|theke|restaurant|rock|stein/i.test(
      brief.besondererHintergrund,
    )
  ) {
    blockers.push("Produkt-Studio widerspricht einem Outdoor-/Location-Hintergrund. Bitte neutralen Studio-Hintergrund verwenden.");
  }
  if (isStudioProduct && (brief.shotType === "Wide Environmental" || brief.shotType === "Drone / Aerial")) {
    warnings.push("Für Produkt-Studio besser 'Eye-Level', '45° Hero Shot' oder 'Close-Up / Detail' nutzen.");
  }
  if (
    brief.bildtyp === "Makro/Detail" &&
    !["Close-Up / Detail", "Eye-Level", "Flat Lay / Top-Down"].includes(brief.shotType)
  ) {
    blockers.push("Makro/Detail braucht einen nahen Bildausschnitt (Close-Up/Eye-Level/Top-Down).");
  }
  if (brief.bildtyp === "Food-Pairing" && !brief.besondererHintergrund.trim()) {
    warnings.push("Bei Food-Pairing idealerweise Food-Elemente konkretisieren (z. B. Breze, Käse, Grillgut).");
  }
  if (sceneConfig && !sceneConfig.allowedShotTypes.includes(brief.shotType as ShotType)) {
    blockers.push(`Shot-Typ passt nicht zur Szene ${scene}.`);
    fixSuggestions.push({ text: `Shot-Typ für ${scene} korrigieren.`, field: "shotType" });
  }
  if (sceneConfig?.allowedPersonModes && !sceneConfig.allowedPersonModes.includes(brief.personenModus as PersonenOption)) {
    blockers.push(`Personenmodus passt nicht zur Szene ${scene}.`);
    fixSuggestions.push({ text: `Personenmodus für ${scene} korrigieren.`, field: "personenModus" });
  }
  if (brief.bildtyp === "Food-Pairing" && !/(food|dish|pairing|plate|serving|cuisine)/i.test(promptText)) {
    warnings.push("Food-Pairing enthält zu wenig food-spezifische Signals im Prompt.");
  }
  if (brief.bildtyp === "Event/Promotion" && !/(copy-space|campaign|cta|headline|promo)/i.test(promptText)) {
    warnings.push("Event/Promotion sollte klaren Kampagnen-Fokus und Copy-Space enthalten.");
  }
  if (brief.bildtyp === "Biergarten/Genussmoment" && !/(beer garden|outdoor|social|table)/i.test(promptText)) {
    warnings.push("Biergarten/Genussmoment sollte Outdoor- und Social-Signale stärker enthalten.");
  }
  if (brief.bildtyp === "Makro/Detail" && !/(macro|close-up|texture|micro-detail)/i.test(promptText)) {
    warnings.push("Makro/Detail sollte Makro- und Textur-Signale stärker enthalten.");
  }
  if (brief.bildtyp === "Makro/Detail" && !/(focus falloff|optical|refraction|irregular|imperfection)/i.test(promptText)) {
    warnings.push("Makro/Detail sollte stärker auf optische Realismus-Signale (Fokus/Reflexion/Unregelmäßigkeit) setzen.");
  }
  if (isStudioProduct && brief.studioProps && !/mandatory prop|clearly visible/i.test(promptText)) {
    warnings.push("Studio-Deko gewählt, aber Sichtbarkeit der Props ist im Prompt nicht hart genug verankert.");
  }
  if (
    brief.behaelter === "Flasche + Glas" &&
    brief.biertyp === "Alkoholfrei" &&
    !/(weizen|weißbier|weissbier|pils|helles|lager|export)/i.test(`${brief.textImLabel} ${brief.markenname}`)
  ) {
    warnings.push("Bei 'Alkoholfrei' + Flasche/Glas bitte Sorte präzisieren (z. B. Weizen/Pils/Helles), sonst steigt Mismatch-Risiko.");
  }

  let score = 100;
  score -= blockers.length * 40;
  score -= warnings.length * 12;
  score += Math.min(autoFixes.length * 2, 8);
  score = Math.max(0, score);

  const status: PreflightStatus = blockers.length > 0 ? "red" : score >= 80 ? "green" : "yellow";
  return { status, score, warnings, blockers, autoFixes, fixSuggestions };
}

export function ImagePromptWorkflow({
  onImageGenerated,
  hasActiveSubscription = false,
  hasFreeTrialAvailable = false,
  remainingTokens = 0,
  onConsumeTokens,
  onBillingStateUpdate,
  onFreeTrialConsumed,
  onRequireSubscription,
  externalBriefSeed = null,
  externalSeedKey,
}: ImagePromptWorkflowProps) {
  const [promptMode, setPromptMode] = useState<"assistant" | "manual">("assistant");
  const [brief, setBrief] = useState<PromptBrief>(initialBrief);
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [promptForGeneration, setPromptForGeneration] = useState("");
  const [generatedRatio, setGeneratedRatio] = useState("");
  const [qualityPassed, setQualityPassed] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [isImageGenerating, setIsImageGenerating] = useState(false);
  const [isImageRevealing, setIsImageRevealing] = useState(false);
  const [imageGenerationError, setImageGenerationError] = useState("");
  const [generatedImageUrl, setGeneratedImageUrl] = useState("");
  const [lastTaskId, setLastTaskId] = useState("");
  const [lastUsedModel, setLastUsedModel] = useState("nano-banana-pro");
  const [imageOutputFormat, setImageOutputFormat] = useState<"png" | "jpg">("png");
  const [isDownloading, setIsDownloading] = useState(false);
  const [imageGenerationProgress, setImageGenerationProgress] = useState(0);
  const [pendingKieTask, setPendingKieTask] = useState<PendingKieTaskSession | null>(null);
  const [isKieTaskInBackground, setIsKieTaskInBackground] = useState(false);
  const [imageSize, setImageSize] = useState<"1K" | "2K" | "4K">("1K");
  const [imageAspectRatio, setImageAspectRatio] = useState<
    "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "4:5" | "5:4" | "9:16" | "16:9" | "21:9" | "auto"
  >("4:5");
  const [lastPreflight, setLastPreflight] = useState<PreflightReport | null>(null);
  const [lastAutoFixes, setLastAutoFixes] = useState<string[]>([]);
  const [matrixSummary, setMatrixSummary] = useState<{
    passed: number;
    total: number;
    issues: string[];
    invalidBlocked: number;
    invalidTotal: number;
  } | null>(null);
  const pollingRunRef = useRef(0);
  const appliedExternalSeedRef = useRef<string | null>(null);
  const requiresSubscription = !hasActiveSubscription && !hasFreeTrialAvailable;

  const resetPromptAssistant = () => {
    setBrief(initialBrief);
    setStepIndex(0);
    setGeneratedPrompt("");
    setPromptForGeneration("");
    setGeneratedRatio("");
    setQualityPassed(false);
    setGenerationError("");
  };

  const applyQuickBrief = (preset: Partial<PromptBrief>) => {
    setBrief((prev) => {
      const merged = {
        ...prev,
        ...preset,
        flaschenTyp: normalizeFlaschenTyp((preset.flaschenTyp ?? prev.flaschenTyp) as FlaschenTyp | ""),
      };
      return applySceneAutoFixes(merged).brief;
    });
    setStepIndex(0);
  };

  const isBriefValid = useMemo(() => {
    const config = brief.bildtyp ? SCENE_CONFIG[brief.bildtyp as BildtypOption] : null;
    const requiredKeys = new Set(config?.fieldPolicy.requiredKeys ?? []);
    const requiresZielgruppe = requiredKeys.has("zielgruppe");
    const requiresSceneBackground = requiredKeys.has("besondererHintergrund");
    const requiresStudioStyle = requiredKeys.has("studioStyle");
    return (
      brief.bildtyp &&
      (requiresStudioStyle ? Boolean(brief.studioStyle) : true) &&
      brief.biertyp.trim() &&
      brief.behaelter &&
      (brief.behaelter === "Nur Glas" || (brief.flaschenTyp && brief.flaschenVolumen)) &&
      brief.markenname.trim() &&
      (requiresZielgruppe ? Boolean(brief.zielgruppe) : true) &&
      brief.plattform &&
      brief.stimmung &&
      brief.etikettModus &&
      brief.personenModus &&
      brief.shotType &&
      (requiresSceneBackground ? Boolean(brief.besondererHintergrund) : true) &&
      brief.referenzStaerke
    );
  }, [brief]);

  const updateField = (key: keyof PromptBrief, value: string) => {
    setBrief((prev) => {
      if (key === "flaschenTyp") {
        return { ...prev, flaschenTyp: normalizeFlaschenTyp(value as FlaschenTyp | "") };
      }
      return { ...prev, [key]: value };
    });
  };

  useEffect(() => {
    if (!externalBriefSeed || !externalSeedKey) return;
    if (appliedExternalSeedRef.current === externalSeedKey) return;
    appliedExternalSeedRef.current = externalSeedKey;
    setPromptMode("assistant");
    setStepIndex(0);
    setBrief((prev) => {
      const merged = {
        ...prev,
        ...externalBriefSeed,
        flaschenTyp: normalizeFlaschenTyp((externalBriefSeed.flaschenTyp ?? prev.flaschenTyp) as FlaschenTyp | ""),
      };
      return applySceneAutoFixes(merged).brief;
    });
  }, [externalBriefSeed, externalSeedKey]);

  const selectedStudioProps = useMemo(
    () => brief.studioProps.split(" | ").map((s) => s.trim()).filter(Boolean),
    [brief.studioProps],
  );

  const toggleStudioProp = (option: string) => {
    const next = selectedStudioProps.includes(option)
      ? selectedStudioProps.filter((item) => item !== option)
      : [...selectedStudioProps, option];
    updateField("studioProps", next.join(" | "));
  };

  const steps: Array<{
    key: keyof PromptBrief;
    label: string;
    required?: boolean;
    placeholder?: string;
    type: "text" | "textarea" | "select";
    options?: string[];
  }> = [
    {
      key: "bildtyp",
      label: "0) Bildtyp / Szene",
      required: true,
      type: "select",
      options: [
        "Produkt-Studio",
        "Lifestyle",
        "Biergarten/Genussmoment",
        "Gastro-Serviermoment",
        "Event/Promotion",
        "Food-Pairing",
        "Makro/Detail",
      ],
    },
    {
      key: "studioStyle",
      label: "0b) Produkt-Studio-Stil",
      required: false,
      type: "select",
      options: [...STUDIO_STYLE_OPTIONS],
    },
    {
      key: "studioProps",
      label: "0c) Studio-Deko/Details (optional)",
      required: false,
      type: "select",
      options: [...STUDIO_PROP_OPTIONS],
    },
    {
      key: "biertyp",
      label: "1) Biertyp",
      required: true,
      type: "select",
      options: BEER_TYPE_OPTIONS,
    },
    {
      key: "behaelter",
      label: "2) Behaelter",
      required: true,
      type: "select",
      options: ["Nur Glas", "Nur Flasche", "Flasche + Glas"],
    },
    {
      key: "flaschenTyp",
      label: "3) Flaschentyp (wenn Flasche sichtbar)",
      type: "select",
      options: ["Longneck", "Stubbi / NRW", "Euroflasche", "Bügelflasche", "Dose"],
    },
    {
      key: "flaschenVolumen",
      label: "4) Volumen (wenn Flasche sichtbar)",
      type: "select",
      options: ["330ml", "500ml", "750ml"],
    },
    { key: "markenname", label: "5) Markenname", required: true, placeholder: 'z. B. Muster GmbH oder "generisch"', type: "text" },
    {
      key: "zielgruppe",
      label: "6) Zielgruppe",
      required: true,
      type: "select",
      options: ["Der Entdecker", "Der Traditionsbewusste", "Der Gesundheitsbewusste", "Der Genießer"],
    },
    {
      key: "plattform",
      label: "7) Plattform",
      required: true,
      type: "select",
      options: ["Instagram Post", "Instagram Story", "Website Hero", "Fachmagazin", "Etikettendesign", "Werbeanzeige"],
    },
    {
      key: "stimmung",
      label: "8) Stimmung",
      required: true,
      type: "select",
      options: ["Nachhaltig/Rustikal", "Modern/Minimalistisch", "Nostalgisch/Vintage", "Aktiv/Frisch", "Premium/Luxus"],
    },
    {
      key: "etikettModus",
      label: "9) Etikett/Flasche",
      required: true,
      type: "select",
      options: ["Ja, Etikett 1:1", "Generisch"],
    },
    {
      key: "personenModus",
      label: "10) Personen/Gesichter",
      required: true,
      type: "select",
      options: ["Kein Mensch", "Hände/Arme ohne Gesicht", "Person ohne Gesicht", "Person mit Gesicht"],
    },
    {
      key: "personGeschlecht",
      label: "10b) Geschlecht (wenn Person im Bild)",
      required: true,
      type: "select",
      options: ["Frau", "Mann", "Egal"],
    },
    {
      key: "shotType",
      label: "11) Bildausschnitt & Kamerawinkel",
      required: true,
      type: "select",
      options: [
        "45° Hero Shot",
        "Eye-Level",
        "Low Angle",
        "Flat Lay / Top-Down",
        "Close-Up / Detail",
        "Wide Environmental",
        "Drone / Aerial",
        "POV / Over-Shoulder",
      ],
    },
    {
      key: "referenzStaerke",
      label: "12) Referenzstärke",
      required: true,
      type: "select",
      options: ["Niedrig", "Mittel", "Hoch", "Strikt"],
    },
    {
      key: "besondererHintergrund",
      label: "13) Besonderer Hintergrund (optional)",
      type: "textarea",
      placeholder: "z. B. Kupferkessel, Biergarten, Urban Bar",
    },
  ];

  const visibleSteps = useMemo(() => {
    const bildtyp = brief.bildtyp as BildtypOption | "";
    if (!bildtyp) return steps.filter((step) => step.key !== "studioStyle" && step.key !== "studioProps");
    const sceneConfig = SCENE_CONFIG[bildtyp];
    const hidden = new Set(sceneConfig.fieldPolicy.hiddenStepKeys ?? []);
    const allowsOnlyNoHumanMode = sceneConfig.allowedPersonModes?.every((mode) => mode === "Kein Mensch") ?? false;
    return steps.filter((step) => {
      if (step.key === "studioStyle" && bildtyp !== "Produkt-Studio") return false;
      if (step.key === "studioProps" && bildtyp !== "Produkt-Studio") return false;
      if (step.key === "personGeschlecht") {
        if (allowsOnlyNoHumanMode) return false;
        if (!brief.personenModus || brief.personenModus === "Kein Mensch") return false;
      }
      return !hidden.has(step.key);
    });
  }, [brief.bildtyp, brief.personenModus]);
  const stepIndexByKey = useMemo(
    () => new Map(visibleSteps.map((step, idx) => [step.key, idx] as const)),
    [visibleSteps],
  );

  useEffect(() => {
    const bildtyp = brief.bildtyp as BildtypOption | "";
    if (!bildtyp) return;

    setBrief((prev) => {
      let changed = false;
      const next = { ...prev };

      const hidden = SCENE_CONFIG[bildtyp].fieldPolicy.hiddenStepKeys ?? [];
      for (const key of hidden) {
        if (next[key]) {
          (next[key] as string) = "";
          changed = true;
        }
      }

      if (bildtyp !== "Produkt-Studio" && next.studioStyle) {
        next.studioStyle = "";
        changed = true;
      }
      if (bildtyp !== "Produkt-Studio" && next.studioProps) {
        next.studioProps = "";
        changed = true;
      }

      const allowedStimmungen = getSceneStepOptions(next, "stimmung");
      if (allowedStimmungen && next.stimmung && !allowedStimmungen.includes(next.stimmung as Stimmung)) {
        next.stimmung = "";
        changed = true;
      }

      const allowedPersonen = getSceneStepOptions(next, "personenModus");
      if (allowedPersonen && next.personenModus && !allowedPersonen.includes(next.personenModus as PersonenOption)) {
        next.personenModus = "";
        changed = true;
      }

      const allowedShotTypes = getSceneStepOptions(next, "shotType");
      if (allowedShotTypes && next.shotType && !allowedShotTypes.includes(next.shotType as ShotType)) {
        next.shotType = "";
        changed = true;
      }

      if (
        bildtyp === "Produkt-Studio" &&
        next.besondererHintergrund &&
        !(STUDIO_BACKGROUND_OPTIONS as readonly string[]).includes(next.besondererHintergrund)
      ) {
        next.besondererHintergrund = "";
        changed = true;
      }

      return changed ? next : prev;
    });
  }, [brief.bildtyp]);

  useEffect(() => {
    if (brief.personenModus !== "Kein Mensch") return;
    setBrief((prev) => (prev.personGeschlecht === "Egal" ? prev : { ...prev, personGeschlecht: "Egal" }));
  }, [brief.personenModus]);

  useEffect(() => {
    setStepIndex((prev) => Math.min(prev, Math.max(visibleSteps.length - 1, 0)));
  }, [visibleSteps.length]);

  const currentStep = visibleSteps[stepIndex];
  const currentValue = (brief[currentStep.key] ?? "") as string;
  const currentSceneGuidance =
    brief.bildtyp && SCENE_CONFIG[brief.bildtyp as BildtypOption]
      ? SCENE_CONFIG[brief.bildtyp as BildtypOption].guidanceTips
      : [];
  const availableScenePresets =
    brief.bildtyp && SCENE_CONFIG[brief.bildtyp as BildtypOption]
      ? SCENE_CONFIG[brief.bildtyp as BildtypOption].scenePresets
      : QUICK_BRIEFS;
  const backgroundOptionsByScene = getSceneStepOptions(brief, "besondererHintergrund");
  const currentStepOptions = useMemo(() => {
    if (!currentStep.options) return undefined;
    const sceneOptions = getSceneStepOptions(brief, currentStep.key);
    return sceneOptions ?? currentStep.options;
  }, [brief.bildtyp, brief.personenModus, currentStep]);
  const isValueAllowedForCurrentStep =
    !currentStepOptions || !currentValue || currentStepOptions.includes(currentValue);
  const currentSceneConfig = brief.bildtyp ? SCENE_CONFIG[brief.bildtyp as BildtypOption] : null;
  const isCurrentRequired = currentSceneConfig
    ? currentSceneConfig.fieldPolicy.requiredKeys.includes(currentStep.key)
    : Boolean(currentStep.required);
  const requiresBottleDetails =
    brief.behaelter === "Nur Flasche" || brief.behaelter === "Flasche + Glas";
  const isCurrentValid =
    currentStep.key === "flaschenTyp"
      ? !requiresBottleDetails || Boolean(brief.flaschenTyp)
      : currentStep.key === "flaschenVolumen"
        ? !requiresBottleDetails || Boolean(brief.flaschenVolumen)
        : currentStep.key === "zielgruppe"
          ? brief.bildtyp === "Produkt-Studio"
            ? true
            : Boolean(currentValue.trim())
        : currentStep.key === "besondererHintergrund"
          ? brief.bildtyp === "Produkt-Studio"
            ? Boolean(currentValue.trim())
            : true
        : currentStep.key === "studioStyle"
          ? brief.bildtyp === "Produkt-Studio"
            ? Boolean(currentValue.trim())
            : true
        : isCurrentRequired
          ? Boolean(currentValue.trim()) && isValueAllowedForCurrentStep
          : true;
  const progressPercent = Math.round(((stepIndex + 1) / visibleSteps.length) * 100);
  const isLastStep = stepIndex === visibleSteps.length - 1;
  const canContinue = isLastStep ? isCurrentValid && isBriefValid : isCurrentValid;

  const nextStep = () => {
    if (requiresSubscription) {
      setGenerationError("Bitte Abo aktivieren, um Prompts zu erstellen und weitere Bilder zu generieren.");
      onRequireSubscription?.();
      return;
    }
    if (!isCurrentValid) return;
    if (stepIndex < visibleSteps.length - 1) {
      setStepIndex((prev) => prev + 1);
      return;
    }

    void (async () => {
      setGenerationError("");
      setIsGenerating(true);

      try {
        const fixed = applySceneAutoFixes(brief);
        if (fixed.autoFixes.length > 0) {
          setBrief(fixed.brief);
          setLastAutoFixes(fixed.autoFixes);
        } else {
          setLastAutoFixes([]);
        }
        const effectiveBrief = fixed.brief;
        const result = buildPrompt(effectiveBrief);
        setGeneratedRatio(result.ratio);

        const res = await fetch("/api/claude/prompt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(effectiveBrief),
        });

        if (!res.ok) {
          const errorPayload = (await res.json()) as { error?: string; code?: string };
          const enriched = errorPayload.code
            ? `${errorPayload.code}:${errorPayload.error ?? "Claude API antwortet nicht erfolgreich"}`
            : (errorPayload.error ?? "Claude API antwortet nicht erfolgreich");
          throw new Error(enriched);
        }

        const data = (await res.json()) as { prompt?: string };
        const prompt = (data.prompt ?? "").trim();
        if (!prompt) {
          throw new Error("Leere Claude-Antwort");
        }

        const constrainedPrompt = appendGenderConstraint(
          enforceSceneContract(enforcePeopleConstraints(enforceContainerConstraints(prompt, effectiveBrief), effectiveBrief), effectiveBrief),
          effectiveBrief,
          promptMode,
        );
        setGeneratedPrompt(constrainedPrompt);
        setPromptForGeneration(constrainedPrompt);
        setQualityPassed(runQualityCheck(effectiveBrief, constrainedPrompt, result.ratio));
      } catch (error) {
        const fixed = applySceneAutoFixes(brief);
        const effectiveBrief = fixed.brief;
        const fallback = buildPrompt(effectiveBrief);
        const constrainedFallbackPrompt = appendGenderConstraint(
          enforceSceneContract(
            enforcePeopleConstraints(enforceContainerConstraints(fallback.prompt, effectiveBrief), effectiveBrief),
            effectiveBrief,
          ),
          effectiveBrief,
          promptMode,
        );
        setGeneratedPrompt(constrainedFallbackPrompt);
        setPromptForGeneration(constrainedFallbackPrompt);
        setGeneratedRatio(fallback.ratio);
        setQualityPassed(runQualityCheck(effectiveBrief, constrainedFallbackPrompt, fallback.ratio));
        const msg = error instanceof Error ? error.message : "";
        const lower = msg.toLowerCase();
        if (lower.includes("claude_billing") || lower.includes("credit balance is too low")) {
          setGenerationError(
            "Claude ist verbunden, aber dein Anthropic-Guthaben ist zu niedrig. Bitte in Anthropic > Plans & Billing Credits aufladen. Lokaler Fallback-Prompt wurde verwendet.",
          );
        } else if (lower.includes("claude_auth") || lower.includes("anthropic_api_key") || lower.includes("api key") || lower.includes("authentifizierung")) {
          setGenerationError(
            "Claude ist nicht konfiguriert: ANTHROPIC_API_KEY fehlt oder ist ungültig. Lokaler Fallback-Prompt wurde verwendet.",
          );
        } else if (lower.includes("claude_model") || lower.includes("modell") || lower.includes("model")) {
          setGenerationError(
            "Claude konnte mit deinem Anthropic-Account kein nutzbares Modell aufrufen. Bitte in Anthropic Konsole Modellzugriff und Billing prüfen. Lokaler Fallback-Prompt wurde verwendet.",
          );
        } else if (lower.includes("claude_rate_limit")) {
          setGenerationError(
            "Claude ist gerade rate-limited. Bitte kurz warten und erneut versuchen. Lokaler Fallback-Prompt wurde verwendet.",
          );
        } else {
          setGenerationError(
            "Claude war nicht erreichbar. Es wurde der lokale Fallback-Prompt verwendet.",
          );
        }
      } finally {
        setIsGenerating(false);
      }
    })();
  };

  const prevStep = () => {
    setStepIndex((prev) => Math.max(0, prev - 1));
  };

  const resolveAspectRatio = (platform: Plattform | ""): string => {
    if (platform === "Instagram Story") return "9:16";
    if (platform === "Website Hero") return "16:9";
    if (platform === "Fachmagazin") return "3:4";
    if (platform === "Etikettendesign") return "2:3";
    if (platform === "Werbeanzeige") return "1:1";
    return "4:5";
  };

  const shouldForceChatgptImage2 = (briefInput: PromptBrief): boolean =>
    briefInput.plattform === "Instagram Post" && Boolean(briefInput.textImLabel.trim());

  const platformLockedAspectRatio = resolveAspectRatio(brief.plattform);
  const isAspectRatioLockedByPlatform = promptMode === "assistant" && Boolean(brief.plattform);
  const effectiveAspectRatio = isAspectRatioLockedByPlatform ? platformLockedAspectRatio : imageAspectRatio;

  useEffect(() => {
    if (!isAspectRatioLockedByPlatform) return;
    setImageAspectRatio(platformLockedAspectRatio as typeof imageAspectRatio);
  }, [isAspectRatioLockedByPlatform, platformLockedAspectRatio]);

  useEffect(() => {
    if (brief.flaschenTyp !== "Weizenbierflasche") return;
    setBrief((prev) => ({ ...prev, flaschenTyp: "Stubbi / NRW" }));
  }, [brief.flaschenTyp]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.sessionStorage.getItem(KIE_PENDING_TASK_SESSION_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as PendingKieTaskSession;
      if (!parsed.taskId || !parsed.startedAt) return;
      if (Date.now() - parsed.startedAt > KIE_MAX_WAIT_MS + KIE_DONE_GRACE_MS) {
        window.sessionStorage.removeItem(KIE_PENDING_TASK_SESSION_KEY);
        return;
      }
      setPendingKieTask(parsed);
      setLastTaskId(parsed.taskId);
    } catch {
      window.sessionStorage.removeItem(KIE_PENDING_TASK_SESSION_KEY);
    }
  }, []);

  const persistPendingKieTask = (next: PendingKieTaskSession | null) => {
    setPendingKieTask(next);
    if (typeof window === "undefined") return;
    if (!next) {
      window.sessionStorage.removeItem(KIE_PENDING_TASK_SESSION_KEY);
      return;
    }
    window.sessionStorage.setItem(KIE_PENDING_TASK_SESSION_KEY, JSON.stringify(next));
  };

  const delay = (ms: number) =>
    new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });

  const getPollingDelay = (attempt: number) => {
    const baseDelay = Math.min(KIE_BASE_DELAY_MS + attempt * 250, KIE_MAX_DELAY_MS);
    const jitter = Math.floor(Math.random() * 450);
    return baseDelay + jitter;
  };

  const parseRetryAfterMs = (retryAfter: string | null) => {
    if (!retryAfter) return null;
    const asSeconds = Number.parseInt(retryAfter, 10);
    if (Number.isFinite(asSeconds) && asSeconds > 0) {
      return asSeconds * 1000;
    }
    const asDate = Date.parse(retryAfter);
    if (!Number.isNaN(asDate)) {
      const diff = asDate - Date.now();
      return diff > 0 ? diff : null;
    }
    return null;
  };

  const runSceneMatrixCheck = () => {
    const scenarios: PromptBrief[] = (Object.keys(SCENE_CONFIG) as BildtypOption[]).map((scene) => {
      const config = SCENE_CONFIG[scene];
      return {
        ...initialBrief,
        bildtyp: scene,
        studioStyle: scene === "Produkt-Studio" ? "Premium Hero" : "",
        biertyp: "Helles",
        behaelter: "Flasche + Glas",
        flaschenTyp: "Longneck",
        flaschenVolumen: "500ml",
        markenname: "Muster GmbH",
        zielgruppe: scene === "Produkt-Studio" ? "" : "Der Genießer",
        plattform: "Instagram Post",
        stimmung: config.allowedMoods[0],
        etikettModus: "Generisch",
        personenModus: (config.allowedPersonModes?.[0] ?? "Person ohne Gesicht") as PersonenOption,
        shotType: config.allowedShotTypes[0],
        referenzStaerke: "Mittel",
        besondererHintergrund: scene === "Produkt-Studio" ? STUDIO_BACKGROUND_OPTIONS[0] : "natürlicher Szenenhintergrund",
      };
    });
    const invalidScenarios: PromptBrief[] = [
      {
        ...initialBrief,
        bildtyp: "Gastro-Serviermoment",
        biertyp: "Weizen",
        behaelter: "Flasche + Glas",
        flaschenTyp: "Stubbi / NRW",
        flaschenVolumen: "500ml",
        markenname: "Muster GmbH",
        zielgruppe: "Der Genießer",
        plattform: "Instagram Post",
        stimmung: "Premium/Luxus",
        etikettModus: "Generisch",
        personenModus: "Hände/Arme ohne Gesicht",
        shotType: "Eye-Level",
        referenzStaerke: "Mittel",
        besondererHintergrund: "Theken-Setup",
        kiPlattform: "Nano Banana Pro",
        studioStyle: "",
        studioProps: "",
        saisonalerBezug: "",
        textImLabel: "",
        vermeiden: "",
      },
      {
        ...initialBrief,
        bildtyp: "Makro/Detail",
        biertyp: "Pils",
        behaelter: "Flasche + Glas",
        flaschenTyp: "Longneck",
        flaschenVolumen: "500ml",
        markenname: "Muster GmbH",
        zielgruppe: "Der Genießer",
        plattform: "Instagram Post",
        stimmung: "Premium/Luxus",
        etikettModus: "Generisch",
        personenModus: "Person mit Gesicht",
        shotType: "Wide Environmental",
        referenzStaerke: "Mittel",
        besondererHintergrund: "Studio",
        kiPlattform: "Nano Banana Pro",
        studioStyle: "",
        studioProps: "",
        saisonalerBezug: "",
        textImLabel: "",
        vermeiden: "",
      },
    ];

    const issues: string[] = [];
    let passed = 0;
    for (const testBrief of scenarios) {
      const fixed = applySceneAutoFixes(testBrief);
      const built = buildPrompt(fixed.brief);
      const constrained = appendGenderConstraint(
        enforceSceneContract(enforcePeopleConstraints(enforceContainerConstraints(built.prompt, fixed.brief), fixed.brief), fixed.brief),
        fixed.brief,
        "assistant",
      );
      const preflight = evaluatePreflight(fixed.brief, constrained, false, fixed.autoFixes);
      const quality = runQualityCheck(fixed.brief, constrained, built.ratio);
      const ok = preflight.blockers.length === 0 && quality;
      if (ok) {
        passed += 1;
      } else {
        issues.push(`${testBrief.bildtyp}: ${[...preflight.blockers, ...(quality ? [] : ["QualityCheck fail"])].join(" | ")}`);
      }
    }
    let invalidBlocked = 0;
    for (const invalid of invalidScenarios) {
      const built = buildPrompt(invalid);
      const constrained = appendGenderConstraint(
        enforceSceneContract(enforcePeopleConstraints(enforceContainerConstraints(built.prompt, invalid), invalid), invalid),
        invalid,
        "assistant",
      );
      const preflight = evaluatePreflight(invalid, constrained, false, []);
      if (preflight.blockers.length > 0) invalidBlocked += 1;
    }
    setMatrixSummary({
      passed,
      total: scenarios.length,
      issues,
      invalidBlocked,
      invalidTotal: invalidScenarios.length,
    });
  };

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("Referenzbild konnte nicht gelesen werden."));
      reader.readAsDataURL(file);
    });

  const preloadImage = (url: string) =>
    new Promise<void>((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Generiertes Bild konnte nicht geladen werden."));
      img.src = url;
    });

  const openReLoginModal = () => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("evglab-open-auth-modal", { detail: { mode: "signin" } }));
  };

  const fetchKieTaskStatus = async (taskId: string) => {
    const timeoutController = new AbortController();
    const timeoutId = globalThis.setTimeout(() => timeoutController.abort(), KIE_STATUS_TIMEOUT_MS);
    try {
      const statusRes = await fetch(`/api/kie/nano-banana/task-status?taskId=${encodeURIComponent(taskId)}`, {
        signal: timeoutController.signal,
      });
      const statusData = (await statusRes.json()) as {
        state?: string;
        imageUrl?: string | null;
        error?: string;
        code?: string;
      };

      if (!statusRes.ok) {
        const authRequired = statusRes.status === 401 || statusData.code === "auth_required";
        const transient = statusRes.status === 429 || statusRes.status >= 500;
        return {
          ok: false as const,
          transient,
          authRequired,
          error: statusData.error || "Kie Statusabfrage fehlgeschlagen.",
          retryAfterMs: parseRetryAfterMs(statusRes.headers.get("Retry-After")),
        };
      }

      return {
        ok: true as const,
        state: String(statusData.state ?? "").toLowerCase(),
        imageUrl: statusData.imageUrl || null,
      };
    } catch (error) {
      return {
        ok: false as const,
        transient: true,
        authRequired: false,
        error:
          error instanceof Error && error.name === "AbortError"
            ? "Statusabfrage dauert länger als erwartet. Neuer Versuch läuft."
            : "Temporärer Verbindungsfehler bei der Statusabfrage.",
        retryAfterMs: null,
      };
    } finally {
      globalThis.clearTimeout(timeoutId);
    }
  };

  const resolveKieImage = async (
    session: PendingKieTaskSession,
    meta: {
      tokenCost: number;
      constrainedPrompt: string;
      aspectRatio: string;
      resolution: "1K" | "2K" | "4K";
      outputFormat: "png" | "jpg";
    },
  ) => {
    const runId = ++pollingRunRef.current;
    setIsImageGenerating(true);
    setIsKieTaskInBackground(false);
    setImageGenerationError("");

    let attempt = 0;
    let transientRetryCount = 0;
    let taskSession = session;

    while (Date.now() - taskSession.startedAt <= KIE_MAX_WAIT_MS + KIE_DONE_GRACE_MS) {
      if (pollingRunRef.current !== runId) {
        return;
      }

      const elapsed = Date.now() - taskSession.startedAt;
      const progress = Math.min(95, 10 + Math.round((Math.min(elapsed, KIE_MAX_WAIT_MS) / KIE_MAX_WAIT_MS) * 85));
      setImageGenerationProgress(progress);
      await delay(getPollingDelay(attempt));
      attempt += 1;

      if (pollingRunRef.current !== runId) {
        return;
      }

      const status = await fetchKieTaskStatus(taskSession.taskId);
      if (!status.ok) {
        if (status.authRequired) {
          persistPendingKieTask(null);
          openReLoginModal();
          throw new Error("Session abgelaufen, bitte neu anmelden.");
        }
        if (status.transient && transientRetryCount < KIE_TRANSIENT_RETRY_LIMIT) {
          transientRetryCount += 1;
          const retryWait = status.retryAfterMs ?? Math.min(1400 * 2 ** transientRetryCount, 6000);
          setImageGenerationError(
            status.error.includes("Rate-Limit")
              ? "Rate-Limit erreicht, neuer Versuch läuft gleich."
              : "KIE reagiert langsam, wir versuchen es automatisch weiter.",
          );
          await delay(retryWait);
          continue;
        }
        throw new Error(status.error);
      }

      transientRetryCount = 0;
      const isDoneState = ["success", "succeeded", "done", "finished", "complete", "completed"].includes(status.state);
      const isFailedState = ["fail", "failed", "error", "cancelled", "canceled"].includes(status.state);

      if (status.imageUrl) {
        const previewUrl = `/api/kie/download?url=${encodeURIComponent(status.imageUrl)}&format=${meta.outputFormat}&taskId=${encodeURIComponent(taskSession.taskId)}`;
        setGeneratedImageUrl(previewUrl);
        setIsImageRevealing(true);
        setImageGenerationProgress(0);
        for (let i = 1; i <= 20; i += 1) {
          await delay(45);
          setImageGenerationProgress(i * 5);
        }
        setIsImageRevealing(false);
        try {
          await preloadImage(previewUrl);
        } catch {
          // Bild ist bereits gesetzt; Download-/Preview-Fehler werden separat behandelbar.
        }
        onImageGenerated?.({
          id: taskSession.taskId,
          imageUrl: status.imageUrl,
          prompt: meta.constrainedPrompt,
          createdAt: new Date().toISOString(),
          aspectRatio: meta.aspectRatio,
          resolution: meta.resolution,
          outputFormat: meta.outputFormat,
        });
        if (promptMode === "assistant") {
          resetPromptAssistant();
        }
        if (hasActiveSubscription) {
          onConsumeTokens?.(meta.tokenCost);
        } else {
          onFreeTrialConsumed?.();
        }
        persistPendingKieTask(null);
        setImageGenerationError("");
        return;
      }

      if (isDoneState && !status.imageUrl) {
        if (!taskSession.doneWithoutUrlSince) {
          taskSession = { ...taskSession, doneWithoutUrlSince: Date.now() };
          persistPendingKieTask(taskSession);
        }
        if (
          taskSession.doneWithoutUrlSince &&
          Date.now() - taskSession.doneWithoutUrlSince > KIE_DONE_GRACE_MS
        ) {
          throw new Error("KIE ist fertig, liefert das Bild aber verzögert. Bitte gleich erneut prüfen.");
        }
        continue;
      }

      if (isFailedState) {
        persistPendingKieTask(null);
        throw new Error("Kie konnte das Bild nicht generieren.");
      }
    }

    throw new Error("Kie hat innerhalb von 8 Minuten noch kein fertiges Bild geliefert. Task läuft optional im Hintergrund weiter.");
  };

  const generateImageWithKie = async (finalPrompt: string, files?: File[]) => {
    setImageGenerationError("");
    setGeneratedImageUrl("");
    setLastTaskId("");
    setImageGenerationProgress(0);
    setIsImageGenerating(true);
    try {
      const estimateTokenCost = (hasReferenceImage: boolean) => {
        const base = imageSize === "4K" ? 35 : imageSize === "2K" ? 20 : 10;
        const referenceCost = hasReferenceImage ? 5 : 0;
        const strictLabelCost = brief.etikettModus === "Ja, Etikett 1:1" ? 10 : 0;
        return base + referenceCost + strictLabelCost;
      };

      const fixed = applySceneAutoFixes(brief);
      const effectiveBrief = fixed.brief;
      const hasReferenceImage = Boolean(files?.length);
      const tokenCost = estimateTokenCost(hasReferenceImage);
      if (!hasActiveSubscription && !hasFreeTrialAvailable) {
        onRequireSubscription?.();
        throw new Error("Dein kostenloses Bild ist bereits genutzt. Bitte aktiviere ein Abo.");
      }
      if (hasActiveSubscription && remainingTokens < tokenCost) {
        throw new Error(`Nicht genug Tokens. Benötigt: ${tokenCost}, verfügbar: ${remainingTokens}.`);
      }
      if (effectiveBrief.etikettModus === "Ja, Etikett 1:1" && !hasReferenceImage) {
        throw new Error("Für 'Etikett 1:1' bitte mindestens ein Referenzbild anhängen.");
      }
      if (effectiveBrief.etikettModus === "Ja, Etikett 1:1" && (files?.length ?? 0) > 1) {
        throw new Error("Für 'Etikett 1:1' bitte genau EIN Referenzbild verwenden, damit kein Label-Mix entsteht.");
      }

      if (fixed.autoFixes.length > 0) {
        setBrief(effectiveBrief);
        setLastAutoFixes(fixed.autoFixes);
      } else {
        setLastAutoFixes([]);
      }
      const constrainedFinalPrompt = appendGenderConstraint(
        enforceSceneContract(
          enforcePeopleConstraints(enforceContainerConstraints(finalPrompt, effectiveBrief), effectiveBrief),
          effectiveBrief,
        ),
        effectiveBrief,
        promptMode,
      );
      const preflight = evaluatePreflight(effectiveBrief, constrainedFinalPrompt, hasReferenceImage, fixed.autoFixes);
      setLastPreflight(preflight);
      if (preflight.blockers.length > 0) {
        throw new Error(`Preflight blockiert: ${preflight.blockers.join(" | ")}`);
      }

      const labelLockPrefix = buildLabelLockPrefix(effectiveBrief, hasReferenceImage);
      const physicalRealismRule = buildPhysicalRealismRule(effectiveBrief);
      const strictReferenceOverride =
        effectiveBrief.etikettModus === "Ja, Etikett 1:1"
          ? "HARD CONSTRAINT: Use attached reference as single source of truth for bottle/label identity. Keep same brand identity and label architecture."
          : "";
      const promptWithLabelLock = [labelLockPrefix, strictReferenceOverride, physicalRealismRule, constrainedFinalPrompt]
        .filter(Boolean)
        .join("\n\n");

      const maxReferenceFiles = effectiveBrief.etikettModus === "Ja, Etikett 1:1" ? 1 : MAX_REFERENCE_UPLOADS;
      const referenceImageUrls = files?.length
        ? await Promise.all(files.slice(0, maxReferenceFiles).map((file) => fileToDataUrl(file)))
        : undefined;

      if (shouldForceChatgptImage2(effectiveBrief)) {
        const openAiRes = await fetch("/api/openai/image2/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: promptWithLabelLock,
            aspectRatio: effectiveAspectRatio || resolveAspectRatio(effectiveBrief.plattform),
            resolution: imageSize,
            outputFormat: imageOutputFormat,
            strictLabelMode: effectiveBrief.etikettModus === "Ja, Etikett 1:1",
            referenceImageUrls,
            plattform: effectiveBrief.plattform,
            textImLabel: effectiveBrief.textImLabel,
          }),
        });
        const openAiData = (await openAiRes.json()) as {
          generationId?: string;
          imageUrl?: string;
          usedModel?: string;
          billing?: {
            monthlyTokens?: number;
            usedTokens?: number;
            remainingTokens?: number;
            consumed?: number;
            freeTrial?: boolean;
          };
          error?: string;
          code?: string;
        };
        if (!openAiRes.ok || !openAiData.imageUrl) {
          if (openAiRes.status === 401 || openAiData.code === "auth_required") {
            openReLoginModal();
            throw new Error("Session abgelaufen, bitte neu anmelden.");
          }
          throw new Error(openAiData.error || "ChatGPT Image 2 konnte das Bild nicht erstellen.");
        }

        const generationId = openAiData.generationId ?? `openai-${Date.now()}`;
        const previewUrl = `/api/kie/download?url=${encodeURIComponent(openAiData.imageUrl)}&format=${imageOutputFormat}&taskId=${encodeURIComponent(generationId)}`;
        setGeneratedImageUrl(previewUrl);
        setLastTaskId(generationId);
        setLastUsedModel(
          openAiData.usedModel ||
            (referenceImageUrls?.length ? "gpt-image-2-image-to-image" : "gpt-image-2-text-to-image"),
        );
        if (openAiData.billing) {
          onBillingStateUpdate?.(openAiData.billing);
        }

        setIsImageRevealing(true);
        setImageGenerationProgress(0);
        for (let i = 1; i <= 20; i += 1) {
          await delay(35);
          setImageGenerationProgress(i * 5);
        }
        setIsImageRevealing(false);

        onImageGenerated?.({
          id: generationId,
          imageUrl: openAiData.imageUrl,
          prompt: constrainedFinalPrompt,
          createdAt: new Date().toISOString(),
          aspectRatio: effectiveAspectRatio,
          resolution: imageSize,
          outputFormat: imageOutputFormat,
        });
        if (promptMode === "assistant") {
          resetPromptAssistant();
        }
        if (hasActiveSubscription) {
          onConsumeTokens?.(openAiData.billing?.consumed ?? tokenCost);
        } else {
          onFreeTrialConsumed?.();
        }
        setImageGenerationError("");
        return;
      }

      const createTask = async (referenceImageUrls?: string[]) => {
        const createRes = await fetch("/api/kie/nano-banana/create-task", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: promptWithLabelLock,
            aspectRatio: effectiveAspectRatio || resolveAspectRatio(effectiveBrief.plattform),
            resolution: imageSize,
            outputFormat: imageOutputFormat,
            strictLabelMode: effectiveBrief.etikettModus === "Ja, Etikett 1:1",
            referenceImageUrls,
          }),
        });
        const createData = (await createRes.json()) as {
          taskId?: string;
          usedModel?: string;
          billing?: {
            monthlyTokens?: number;
            usedTokens?: number;
            remainingTokens?: number;
            consumed?: number;
            freeTrial?: boolean;
          };
          error?: string;
          code?: string;
          raw?: Record<string, unknown>;
        };
        if (!createRes.ok || !createData.taskId) {
          if (createRes.status === 401 || createData.code === "auth_required") {
            openReLoginModal();
            throw new Error("Session abgelaufen, bitte neu anmelden.");
          }
          const rawMsg =
            (createData.raw?.msg as string | undefined) ||
            (createData.raw?.error as string | undefined);
          throw new Error(createData.error || rawMsg || "Kie Task konnte nicht erstellt werden.");
        }
        if (createData.usedModel) {
          setLastUsedModel(createData.usedModel);
        }
        if (createData.billing) {
          onBillingStateUpdate?.(createData.billing);
        }
        return createData.taskId;
      };

      const taskId = await createTask(referenceImageUrls);
      setLastTaskId(taskId);
      setImageGenerationProgress(10);

      const taskSession: PendingKieTaskSession = {
        taskId,
        prompt: constrainedFinalPrompt,
        aspectRatio: effectiveAspectRatio,
        resolution: imageSize,
        outputFormat: imageOutputFormat,
        tokenCost,
        startedAt: Date.now(),
        doneWithoutUrlSince: null,
      };
      persistPendingKieTask(taskSession);

      await resolveKieImage(taskSession, {
        tokenCost,
        constrainedPrompt: constrainedFinalPrompt,
        aspectRatio: effectiveAspectRatio,
        resolution: imageSize,
        outputFormat: imageOutputFormat,
      });
    } catch (error) {
      setImageGenerationError(error instanceof Error ? error.message : "Bildgenerierung fehlgeschlagen.");
    } finally {
      setIsImageRevealing(false);
      setIsImageGenerating(false);
    }
  };

  const continuePendingKieTask = async () => {
    if (!pendingKieTask) return;
    setImageGenerationError("");
    setGeneratedImageUrl("");
    setLastTaskId(pendingKieTask.taskId);
    try {
      await resolveKieImage(pendingKieTask, {
        tokenCost: pendingKieTask.tokenCost,
        constrainedPrompt: pendingKieTask.prompt,
        aspectRatio: pendingKieTask.aspectRatio,
        resolution: pendingKieTask.resolution,
        outputFormat: pendingKieTask.outputFormat,
      });
    } catch (error) {
      setImageGenerationError(error instanceof Error ? error.message : "Statusprüfung fehlgeschlagen.");
      setIsImageGenerating(false);
    }
  };

  const sendKieTaskToBackground = () => {
    if (!pendingKieTask) return;
    pollingRunRef.current += 1;
    setIsKieTaskInBackground(true);
    setIsImageGenerating(false);
    setImageGenerationError("Task läuft im Hintergrund. Du kannst später auf \"Erneut prüfen\" klicken.");
  };

  const downloadGeneratedImage = async () => {
    if (!generatedImageUrl) return;
    setIsDownloading(true);
    try {
      const response = await fetch(generatedImageUrl);
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "Bild konnte nicht heruntergeladen werden.");
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `evglab-${lastTaskId || Date.now()}.${imageOutputFormat}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setImageGenerationError(error instanceof Error ? error.message : "Download fehlgeschlagen.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <section data-onboarding="content-brief" className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPromptMode("assistant")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              promptMode === "assistant"
                ? "bg-[#c65a20] text-white"
                : "border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            }`}
          >
            Prompt-Assistent
          </button>
          <button
            type="button"
            onClick={() => setPromptMode("manual")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              promptMode === "manual"
                ? "bg-[#c65a20] text-white"
                : "border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            }`}
          >
            Eigener Prompt
          </button>
        </div>
        {promptMode === "assistant" ? (
          <>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {availableScenePresets.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => applyQuickBrief(item.preset)}
              className="rounded-full border border-[#c65a20]/40 bg-[#c65a20]/10 px-3 py-1.5 text-xs font-medium text-[#c65a20] transition hover:bg-[#c65a20]/15"
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Pflicht: EvGlab Prompt-Briefing</h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Schritt-für-Schritt-Abfrage. Erst am Ende wird der finale englische Prompt generiert.
          </p>
        </div>

        <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
          <div className="h-full rounded-full bg-[#c65a20] transition-all" style={{ width: `${progressPercent}%` }} />
        </div>
        <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
          Schritt {stepIndex + 1} von {visibleSteps.length}
        </p>
        {generationError ? (
          <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
            {generationError}
          </p>
        ) : null}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={runSceneMatrixCheck}
            className="inline-flex h-8 items-center rounded-md border border-gray-300 bg-white px-2.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Szenen-Testmatrix prüfen
          </button>
          {matrixSummary ? (
            <span className="text-xs text-gray-600 dark:text-gray-300">
              Matrix: {matrixSummary.passed}/{matrixSummary.total} valide Szenen bestanden ·{" "}
              {matrixSummary.invalidBlocked}/{matrixSummary.invalidTotal} Invalid-Fälle blockiert
            </span>
          ) : null}
        </div>
        {matrixSummary?.issues?.length ? (
          <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
            Offene Matrix-Themen: {matrixSummary.issues.join(" || ")}
          </p>
        ) : null}
        {currentSceneGuidance.length ? (
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-900/60 dark:bg-blue-900/30 dark:text-blue-300">
            Szenen-Hinweise: {currentSceneGuidance.join(" | ")}
          </div>
        ) : null}

        <label className="space-y-1 text-sm">
          <span className="text-gray-700 dark:text-gray-300">
            {currentStep.key === "besondererHintergrund" && backgroundOptionsByScene?.length
              ? "13) Studio-Hintergrund"
              : currentStep.label}
            {isCurrentRequired ? " *" : ""}
          </span>
          {currentStep.key === "bildtyp" ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {BILDTYP_OVERVIEW.map(({ value, short }) => {
                const selected = currentValue === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => updateField("bildtyp", value)}
                    className={cn(
                      "rounded-lg border px-3 py-3 text-left transition",
                      selected
                        ? "border-[#c65a20] bg-[#c65a20]/12 text-[#7a3712] dark:text-[#f0b08a]"
                        : "border-gray-300 bg-white text-gray-700 hover:border-gray-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300 dark:hover:border-gray-500",
                    )}
                  >
                    <p className="text-sm font-semibold">{value}</p>
                    <p className="mt-1 text-xs opacity-85">{short}</p>
                    <p className="mt-1 text-[11px] opacity-70">
                      Synonyme: {SCENE_CONFIG[value].aliases.join(", ")}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : currentStep.key === "studioProps" ? (
            <div className="flex flex-wrap gap-2">
              {STUDIO_PROP_OPTIONS.map((option) => {
                const selected = selectedStudioProps.includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => toggleStudioProp(option)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      selected
                        ? "border-[#c65a20] bg-[#c65a20]/20 text-[#f0b08a]"
                        : "border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:text-gray-900 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:text-white"
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          ) : currentStep.type === "select" ? (
            <select
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-[#c65a20] focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-white"
              value={currentValue}
              onChange={(e) => updateField(currentStep.key, e.target.value)}
              disabled={currentStep.key === "zielgruppe" && brief.bildtyp === "Produkt-Studio"}
            >
              <option value="">Bitte wählen</option>
              {currentStepOptions?.map((option) => (
                <option key={option} value={option}>
                  {currentStep.key === "studioStyle"
                    ? STUDIO_STYLE_LABELS[option as StudioStyleOption] ?? option
                    : option}
                </option>
              ))}
            </select>
          ) : currentStep.type === "textarea" ? (
            currentStep.key === "besondererHintergrund" && backgroundOptionsByScene?.length ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {backgroundOptionsByScene.map((option) => {
                  const selected = currentValue === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => updateField("besondererHintergrund", option)}
                      className={cn(
                        "rounded-lg border px-3 py-3 text-left text-sm transition",
                        selected
                          ? "border-[#c65a20] bg-[#c65a20]/12 text-[#7a3712] dark:text-[#f0b08a]"
                          : "border-gray-300 bg-white text-gray-700 hover:border-gray-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300 dark:hover:border-gray-500",
                      )}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            ) : (
              <textarea
                className="min-h-24 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-[#c65a20] focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:placeholder:text-gray-400"
                value={currentValue}
                onChange={(e) => updateField(currentStep.key, e.target.value)}
                placeholder={currentStep.placeholder}
              />
            )
          ) : (
            <input
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-500 focus:border-[#c65a20] focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:placeholder:text-gray-400"
              value={currentValue}
              onChange={(e) => updateField(currentStep.key, e.target.value)}
              placeholder={currentStep.placeholder}
            />
          )}
        </label>
        {currentStep.key === "zielgruppe" && brief.bildtyp === "Produkt-Studio" ? (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Bei Produkt-Studio nicht erforderlich.
          </p>
        ) : null}

        <div className="mt-5 flex items-center gap-2">
          <button
            type="button"
            onClick={prevStep}
            disabled={stepIndex === 0}
            className="inline-flex h-10 items-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Zurück
          </button>
          {!isCurrentRequired && stepIndex < visibleSteps.length - 1 && (
            <button
              type="button"
              onClick={() => setStepIndex((prev) => Math.min(prev + 1, visibleSteps.length - 1))}
              className="inline-flex h-10 items-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Überspringen
            </button>
          )}
          <button
            type="button"
            disabled={isGenerating || (!canContinue && !requiresSubscription)}
            onClick={() => {
              if (requiresSubscription) {
                onRequireSubscription?.();
                return;
              }
              nextStep();
            }}
            className="inline-flex h-10 items-center rounded-lg bg-[#c65a20] px-4 text-sm font-medium text-white transition hover:bg-[#b14f1c] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {requiresSubscription
              ? "Plan wählen"
              : isLastStep
                ? (isGenerating ? "Claude generiert..." : "Prompt erstellen")
                : "Weiter"}
          </button>
        </div>
          </>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300">
            Eigener Prompt-Modus aktiv. Du kannst unten direkt deinen Prompt eingeben und ein Referenzbild anhängen.
          </div>
        )}
      </section>

      <section data-onboarding="content-generate" className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Bild generieren</h3>
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Der erzeugte Prompt landet automatisch hier und kann direkt bearbeitet werden.
          </p>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              generatedPrompt
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
            }`}
          >
            {generatedPrompt ? "Prompt erzeugt" : "Prompt noch nicht erzeugt"}
          </span>
        </div>
        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs dark:border-gray-700 dark:bg-gray-950">
          <p className="text-gray-700 dark:text-gray-300">
            Token-Status:{" "}
            {hasActiveSubscription ? (
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">{remainingTokens} frei</span>
            ) : hasFreeTrialAvailable ? (
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">1 kostenloses Bild verfügbar</span>
            ) : (
              <span className="font-semibold text-amber-700 dark:text-amber-300">Kein aktives Abo (Gratis-Bild bereits genutzt)</span>
            )}
          </p>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Kosten pro Bild: 1K = 10, 2K = 20, 4K = 35 Tokens, +5 mit Referenzbild, +10 bei Etikett 1:1.
          </p>
          {lastAutoFixes.length > 0 ? (
            <p className="mt-2 text-xs text-blue-700 dark:text-blue-300">
              Auto-Korrekturen: {lastAutoFixes.join(" | ")}
            </p>
          ) : null}
          {requiresSubscription ? (
            <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
              Dein Gratis-Bild ist aufgebraucht. Für weitere Prompts und Bildgenerierung bitte einen Plan wählen.
            </div>
          ) : null}
        </div>
        {promptMode === "manual" || generatedPrompt || generatedImageUrl || isImageGenerating ? (
          <div className="mt-4">
            <div className="mb-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-950">
              <p className="text-xs font-medium text-gray-800 dark:text-gray-200">Geschlecht (für Person im Bild)</p>
              <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                Wird dem Prompt hinzugefügt, sobald eine Person, Hände oder Arme vorgesehen sind. Bei „Kein Mensch“ nicht relevant.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(["Frau", "Mann", "Egal"] as const).map((option) => {
                  const disabled = brief.personenModus === "Kein Mensch";
                  const active = brief.personGeschlecht === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      disabled={disabled}
                      onClick={() => updateField("personGeschlecht", option)}
                      className={cn(
                        "inline-flex h-9 min-w-[4.5rem] items-center justify-center rounded-md border px-3 text-xs font-medium transition",
                        disabled
                          ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-600"
                          : active
                            ? "border-[#c65a20] bg-[#c65a20]/10 text-[#b14f1c] dark:border-[#e07a40] dark:bg-[#c65a20]/20 dark:text-[#ffd4a8]"
                            : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800",
                      )}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
            <PromptInputBox
              value={promptForGeneration}
              onValueChange={setPromptForGeneration}
              clearOnSend={false}
              isLoading={isImageGenerating}
              disabled={!hasActiveSubscription && !hasFreeTrialAvailable}
              maxReferenceImages={brief.etikettModus === "Ja, Etikett 1:1" ? 1 : MAX_REFERENCE_UPLOADS}
              placeholder="Prompt anpassen, optional Referenzbild anhängen, dann auf Senden klicken (= Bild generieren)."
              onSend={(message, fileList) => {
                if (requiresSubscription) {
                  onRequireSubscription?.();
                  return;
                }
                void generateImageWithKie(message, fileList);
              }}
            />
            {requiresSubscription ? (
              <button
                type="button"
                onClick={() => onRequireSubscription?.()}
                className="mt-3 inline-flex h-9 items-center rounded-md bg-[#c65a20] px-3 text-xs font-medium text-white transition hover:bg-[#b14f1c]"
              >
                Jetzt Plan auswählen
              </button>
            ) : null}
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Seitenverhältnis: {generatedRatio || "-"} | Bei Etikett 1:1 bitte genau ein Referenzbild anhängen.
            </p>
            <div data-onboarding="content-preflight" className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-950">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-300">Preflight</span>
                <span
                  className={`rounded-full px-2 py-0.5 font-medium ${
                    (lastPreflight?.status ?? "yellow") === "green"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                      : (lastPreflight?.status ?? "yellow") === "red"
                        ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                  }`}
                >
                  {(lastPreflight?.status ?? "yellow") === "green"
                    ? "Grün"
                    : (lastPreflight?.status ?? "yellow") === "red"
                      ? "Rot"
                      : "Gelb"}{" "}
                  · Score {lastPreflight?.score ?? 70}
                </span>
              </div>
              {lastPreflight?.warnings?.length ? (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                  Warnungen: {lastPreflight.warnings.join(" | ")}
                </p>
              ) : null}
              {lastPreflight?.autoFixes?.length ? (
                <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
                  Auto-korrigiert: {lastPreflight.autoFixes.join(" | ")}
                </p>
              ) : null}
              {lastPreflight?.blockers?.length ? (
                <p className="mt-1 text-xs text-red-700 dark:text-red-300">
                  Blocker: {lastPreflight.blockers.join(" | ")}
                </p>
              ) : null}
              {lastPreflight?.fixSuggestions?.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {lastPreflight.fixSuggestions.slice(0, 3).map((fix, idx) => (
                    <button
                      key={`${fix.field}-${idx}`}
                      type="button"
                      onClick={() => {
                        const target = stepIndexByKey.get(fix.field);
                        if (typeof target === "number") setStepIndex(target);
                      }}
                      className="inline-flex h-7 items-center rounded-md border border-red-300 bg-red-50 px-2 text-[11px] font-medium text-red-700 transition hover:bg-red-100 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
                    >
                      Fix: {fix.text}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            {brief.etikettModus === "Ja, Etikett 1:1" ? (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                Etikett 1:1 aktiv: Bitte Referenzbild anhängen. Label wird mit hoher Priorität fixiert.
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select
                value={effectiveAspectRatio}
                onChange={(e) =>
                  setImageAspectRatio(
                    e.target.value as
                      | "1:1"
                      | "2:3"
                      | "3:2"
                      | "3:4"
                      | "4:3"
                      | "4:5"
                      | "5:4"
                      | "9:16"
                      | "16:9"
                      | "21:9"
                      | "auto",
                  )
                }
                className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                disabled={isAspectRatioLockedByPlatform}
              >
                <option value="1:1">Format: 1:1</option>
                <option value="4:5">Format: 4:5</option>
                <option value="9:16">Format: 9:16</option>
                <option value="16:9">Format: 16:9</option>
                <option value="3:4">Format: 3:4</option>
                <option value="4:3">Format: 4:3</option>
                <option value="2:3">Format: 2:3</option>
                <option value="3:2">Format: 3:2</option>
                <option value="5:4">Format: 5:4</option>
                <option value="21:9">Format: 21:9</option>
                <option value="auto">Format: auto</option>
              </select>
              <select
                value={imageSize}
                onChange={(e) => setImageSize(e.target.value as "1K" | "2K" | "4K")}
                className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
              >
                <option value="1K">Bildgröße: 1K</option>
                <option value="2K">Bildgröße: 2K</option>
                <option value="4K">Bildgröße: 4K</option>
              </select>
              <select
                value={imageOutputFormat}
                onChange={(e) => setImageOutputFormat(e.target.value as "png" | "jpg")}
                className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
              >
                <option value="png">Ausgabeformat: PNG</option>
                <option value="jpg">Ausgabeformat: JPG</option>
              </select>
            </div>
            {isAspectRatioLockedByPlatform ? (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Format ist durch Plattform gesperrt: {brief.plattform} {"->"} {platformLockedAspectRatio}.
              </p>
            ) : null}
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Verifiziertes Modell: {lastUsedModel} {lastTaskId ? `| TaskId: ${lastTaskId}` : ""}
            </p>
            {isImageGenerating ? (
              <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-950">
                <div className="mb-1 flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                  <span>Bildgenerierung läuft...</span>
                  <span>{imageGenerationProgress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                  <div
                    className="h-full rounded-full bg-[#c65a20] transition-all duration-500"
                    style={{ width: `${imageGenerationProgress}%` }}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={sendKieTaskToBackground}
                    className="inline-flex h-8 items-center rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 transition hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    Im Hintergrund weiterlaufen lassen
                  </button>
                </div>
              </div>
            ) : null}
            {imageGenerationError ? (
              <p className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
                {imageGenerationError}
              </p>
            ) : null}
            {!isImageGenerating && pendingKieTask ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void continuePendingKieTask();
                  }}
                  className="inline-flex h-9 items-center rounded-md bg-[#c65a20] px-3 text-xs font-medium text-white transition hover:bg-[#b14f1c]"
                >
                  Erneut prüfen
                </button>
                <button
                  type="button"
                  onClick={() => {
                    persistPendingKieTask(null);
                    setIsKieTaskInBackground(false);
                  }}
                  className="inline-flex h-9 items-center rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 transition hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Task verwerfen
                </button>
              </div>
            ) : null}
            {isKieTaskInBackground ? (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                KIE-Task ist im Hintergrund vorgemerkt und kann jederzeit fortgesetzt werden.
              </p>
            ) : null}
            {generatedImageUrl || isImageGenerating ? (
              <div data-onboarding="content-result" className="mt-4">
                {generatedImageUrl ? (
                  <ImageGeneration isLoading={isImageGenerating || isImageRevealing} progress={imageGenerationProgress}>
                    <div className="flex max-h-[560px] min-h-[280px] w-full items-center justify-center bg-black/5 p-2 dark:bg-white/5">
                      <img
                        src={generatedImageUrl}
                        alt="Generiertes Bild"
                        className="mx-auto max-h-[540px] w-auto max-w-full object-contain"
                      />
                    </div>
                  </ImageGeneration>
                ) : (
                  <div className="flex h-[300px] w-full items-center justify-center rounded-xl border bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900">
                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400" aria-live="polite">
                      Bild wird generiert …
                    </p>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void downloadGeneratedImage();
                    }}
                    disabled={isDownloading || !generatedImageUrl}
                    className="inline-flex h-10 items-center rounded-lg bg-[#c65a20] px-4 text-sm font-medium text-white transition hover:bg-[#b14f1c] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isDownloading ? "Download..." : "Bild herunterladen"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-400">
            Bitte zuerst oben den Prompt erstellen.
          </div>
        )}
      </section>
    </div>
  );
}
