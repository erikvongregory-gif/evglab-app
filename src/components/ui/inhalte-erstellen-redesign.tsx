"use client";

/* eslint-disable @next/next/no-img-element */
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BrandProfileSetupModal, type BrandScanSuggestion } from "@/components/dashboard/BrandProfileSetupModal";
import { useStudioShell } from "@/components/studio/studio-workspace-shell";
import {
  STUDIO_PAD_X,
  STUDIO_TOKENS,
  useStudioPalette,
  type StudioPalette,
} from "@/components/ui/dashboard-studio-shell";
import type { HyperrealisticInput } from "@/app/(dashboard)/inhalte-erstellen/lib/schemas";
import { FLASCHEN_TYPEN, isDoseTyp } from "@/app/(dashboard)/inhalte-erstellen/lib/brewing-knowledge";
import { BEER_STYLE_OPTIONS, findBeerStyle, beerStyleLabel, type BeerStyleOption } from "@/app/(dashboard)/inhalte-erstellen/lib/beer-styles";
import type { OccasionTemplate } from "@/app/(dashboard)/inhalte-erstellen/lib/occasion-templates";
import { calculateGenerationTokenCost } from "@/lib/billing/generationTokenCost";
import { hyperrealisticSchema } from "@/app/(dashboard)/inhalte-erstellen/lib/schemas";
import { hasUsableBeerEtikett, type DashboardBeer } from "@/lib/dashboard/metadata";
import { readAndCompressImage } from "@/lib/images/compress-image";
import { InhalteErstellenStart } from "@/components/ui/inhalte-erstellen-start";
import {
  MarketingPromptCreateShell,
  type PromptSegment,
} from "@/components/ui/marketing-prompt-create-shell";

type ImageResponse = { b64_json?: string; url?: string };

type WasOption = BeerStyleOption;
type WoOption = { label: string; szene: HyperrealisticInput["szene"] };
type WieOption = { label: string; tageszeit: HyperrealisticInput["tageszeit"] };
type WofuerOption = { label: string; aspectRatio: HyperrealisticInput["aspectRatio"] };
type BehaelterOption = {
  code: NonNullable<HyperrealisticInput["behaelter"]>;
  label: string;
  hint: string;
};
type PersonenOption = {
  code: NonNullable<HyperrealisticInput["personenModus"]>;
  label: string;
  hint: string;
};
type StimmungOption = {
  code: NonNullable<HyperrealisticInput["stimmungTrend"]>;
  label: string;
};
type ShotTypeOption = {
  code: NonNullable<HyperrealisticInput["shotType"]>;
  label: string;
};
type KiPlattformOption = {
  code: NonNullable<HyperrealisticInput["kiPlattform"]>;
  label: string;
  hint: string;
};
type FlaschenOption = {
  code: HyperrealisticInput["flaschenTyp"];
  label: string;
};
type EtikettModusOption = {
  code: NonNullable<HyperrealisticInput["etikettModus"]>;
  label: string;
  hint: string;
};

const WAS_OPTIONS: WasOption[] = BEER_STYLE_OPTIONS;

const WO_OPTIONS: WoOption[] = [
  { label: "Biergarten", szene: "biergarten_sommer" },
  { label: "Wirtshaus innen", szene: "wirtshaus_innen" },
  { label: "Rustikaler Holztisch", szene: "kueche_zuhause" },
  { label: "Wiese & Picknick", szene: "wiese_picknick" },
  { label: "Strand · Sonnenuntergang", szene: "strand_sonnenuntergang" },
  { label: "Alpenpanorama", szene: "alpenpanorama" },
  { label: "Stadtbalkon abends", szene: "stadtbalkon_abend" },
  { label: "Brauereihof", szene: "brauereihof" },
  { label: "Public Viewing", szene: "fussball_public_viewing" },
];

const WIE_OPTIONS: WieOption[] = [
  { label: "Goldene Stunde", tageszeit: "goldene_stunde" },
  { label: "Warmes Abendlicht", tageszeit: "abend_warm" },
  { label: "Klares Mittagslicht", tageszeit: "mittag" },
  { label: "Blaue Stunde", tageszeit: "blaue_stunde" },
];

const WOFUER_OPTIONS: WofuerOption[] = [
  { label: "Insta-Post · 4:5", aspectRatio: "4:5" },
  { label: "Feed · 1:1", aspectRatio: "1:1" },
  { label: "Instagram-Story · 9:16", aspectRatio: "9:16" },
  { label: "Landscape · 16:9", aspectRatio: "16:9" },
];

/** Skill SCHRITT 1, Frage 1b — was zeigen wir? Glas, Flasche oder beides. */
const BEHAELTER_OPTIONS: BehaelterOption[] = [
  { code: "B", label: "Flasche + Glas", hint: "Klassischer Werbeshot mit Etikett & eingeschenktem Bier" },
  { code: "G", label: "Nur Glas", hint: "Hero-Glas — kein Flaschenprodukt sichtbar" },
  { code: "F", label: "Nur Flasche / Dose", hint: "Produktshot ohne eingeschenktes Glas" },
];

const FLASCHEN_OPTIONS: FlaschenOption[] = (
  Object.entries(FLASCHEN_TYPEN) as [FlaschenOption["code"], (typeof FLASCHEN_TYPEN)[FlaschenOption["code"]]][]
).map(([code, item]) => ({ code, label: item.pillLabel }));

/** Skill SCHRITT 1, Frage 8 — Personen [A–E]. */
const PERSONEN_OPTIONS: PersonenOption[] = [
  { code: "A", label: "Kein Mensch", hint: "Reines Produktbild — nur Flasche & Glas" },
  { code: "B", label: "Nur Hände", hint: "Hände halten Glas/Flasche, kein Gesicht sichtbar" },
  { code: "C", label: "Silhouette", hint: "Person sichtbar, Gesicht abgewandt" },
  { code: "D", label: "Person mit Gesicht", hint: "Anonyme Lifestyle-Figur (KI-generiert)" },
  { code: "E", label: "Gruppe", hint: "2–5 Personen, Lifestyle-Szene" },
];

const GRUPPEN_DYNAMIK_OPTIONS: { code: "E1" | "E2" | "E3" | "E4"; label: string; hint: string }[] = [
  { code: "E1", label: "Selfie-POV", hint: "Kamera-nah, Gläser gestreckt, lachend in Kamera" },
  { code: "E2", label: "Anstoßen / Prost", hint: "Gläser zusammen, Jubel, Mid-Toast" },
  { code: "E3", label: "Zusammensitzen", hint: "Holztisch, entspannte Runde" },
  { code: "E4", label: "Walking / Outdoor", hint: "Bewegung, Flaschen in Hand" },
];

const GRUPPEN_ANZAHL_OPTIONS: { code: "2" | "3" | "4_5"; label: string }[] = [
  { code: "2", label: "2" },
  { code: "3", label: "3" },
  { code: "4_5", label: "4–5" },
];

const GRUPPEN_TYP_OPTIONS: { code: NonNullable<HyperrealisticInput["gruppenTyp"]>; label: string }[] = [
  { code: "gemischt", label: "Gemischt" },
  { code: "frauen", label: "Nur Frauen" },
  { code: "maenner", label: "Nur Männer" },
  { code: "paerchen", label: "Pärchen" },
];

const PERSON_GENDER_OPTIONS: { code: NonNullable<HyperrealisticInput["personGender"]>; label: string }[] = [
  { code: "maennlich", label: "Männlich" },
  { code: "weiblich", label: "Weiblich" },
  { code: "divers", label: "Divers" },
];

const PERSON_ALTER_OPTIONS: { code: NonNullable<HyperrealisticInput["personAlter"]>; label: string }[] = [
  { code: "jung", label: "20–30" },
  { code: "mittel", label: "30–50" },
  { code: "aelter", label: "50+" },
];

const PERSON_KOERPER_OPTIONS: { code: NonNullable<HyperrealisticInput["personKoerper"]>; label: string }[] = [
  { code: "kopf_schultern", label: "Kopf + Schulter" },
  { code: "halbkoerper", label: "Halbkörper" },
  { code: "ganzkoerper", label: "Ganzkörper" },
];

const PERSON_MOOD_OPTIONS: { code: NonNullable<HyperrealisticInput["personMood"]>; label: string }[] = [
  { code: "entspannt", label: "Entspannt" },
  { code: "lachend", label: "Lachend" },
  { code: "nachdenklich", label: "Nachdenklich" },
  { code: "aktiv", label: "Aktiv" },
];

/** Skill — 5 Trend-Profile. */
const STIMMUNG_OPTIONS: StimmungOption[] = [
  { code: "nachhaltig", label: "Nachhaltig / Rustikal" },
  { code: "modern", label: "Modern / Minimalistisch" },
  { code: "nostalgie", label: "Nostalgisch / Vintage" },
  { code: "aktiv", label: "Aktiv / Frisch" },
  { code: "premium", label: "Premium / Luxus" },
];

/** Skill SCHRITT 1, Frage 9 — Shot Type [A–H]. */
const SHOT_TYPE_OPTIONS: ShotTypeOption[] = [
  { code: "A", label: "45° Hero" },
  { code: "B", label: "Eye-Level" },
  { code: "C", label: "Low Angle" },
  { code: "D", label: "Top-Down" },
  { code: "E", label: "Close-Up" },
  { code: "F", label: "Wide Environmental" },
  { code: "G", label: "Drone / Aerial" },
  { code: "H", label: "POV / Over-Shoulder" },
];

const KI_PLATTFORM_OPTIONS: KiPlattformOption[] = [
  { code: "gpt_image_2", label: "GPT Image 2", hint: "Beste Etikett-Treue (empfohlen)" },
  { code: "nano_banana_pro", label: "Nano Banana Pro", hint: "Sehr gute Text-Wiedergabe" },
  { code: "nano_banana_2", label: "Nano Banana 2", hint: "Schnell, ideal für Batch-Varianten" },
  { code: "midjourney", label: "Midjourney", hint: "Maximal stilistisch · kein Text-Rendering" },
];

const ETIKETT_MODUS_OPTIONS: EtikettModusOption[] = [
  { code: "marke", label: "Mit Marken-Etikett", hint: "Etikett 1:1 aus Referenzbild übernehmen" },
  { code: "generisch", label: "Generisch", hint: "KI gestaltet selbst ein passendes Etikett (fiktive Marke)" },
];

const EXTRA_OPTIONS = [
  "Kondens­tropfen",
  "Bokeh-Hintergrund",
  "Hopfen im Bild",
  "Wiesenblumen dezent",
  "Brezel · Snack-Beilage",
  "Wassertropfen am Glas",
];

const DEFAULT_VARIANT_COUNT = 3;

type VariantCount = 1 | 2 | 3;

const VARIANT_COUNT_OPTIONS: Array<{ code: `${VariantCount}`; label: string; hint: string }> = [
  { code: "1", label: "1 Variante", hint: "Ein Motiv — weniger Tokens" },
  { code: "2", label: "2 Varianten", hint: "Zwei Motive vergleichen" },
  { code: "3", label: "3 Varianten", hint: "Maximale Auswahl" },
];
// Realistische User-Erwartung: OpenAI gpt-image-2 (quality: medium) liefert in
// der Praxis zwischen ~45s und 2–3 min (je nach Auslastung/Varianten-Anzahl).
// Wir kommunizieren einen Bereich, damit die UI nicht früh wirkt, als sei etwas
// hängen geblieben.
const ESTIMATED_SECONDS = 60;
const ESTIMATED_SECONDS_MAX = 180;

type WizardStepId = "motiv" | "schauplatz" | "personen" | "stimmung" | "format" | "review";
type WizardStep = { id: WizardStepId; index: string; title: string; subtitle: string };
const WIZARD_STEPS: WizardStep[] = [
  { id: "motiv", index: "01", title: "Welches Motiv?", subtitle: "Bierstil, Behälter und Flaschendetails." },
  { id: "schauplatz", index: "02", title: "Wo spielt das Bild?", subtitle: "Schauplatz aussuchen." },
  { id: "personen", index: "03", title: "Mensch oder Produkt-Solo?", subtitle: "Modus A–E plus Detail-Optionen." },
  { id: "stimmung", index: "04", title: "Stimmung und Licht", subtitle: "Trend-Profil, Tageslicht und Bildausschnitt." },
  { id: "format", index: "05", title: "Format, Marke und Extras", subtitle: "Aspect-Ratio, Etikett und optionale Referenz." },
  { id: "review", index: "06", title: "Brief und Generieren", subtitle: "Letzter Check, dann gehts los." },
];

const ASPECT_CHIP_OPTIONS = [
  { label: "9:16", value: "9:16" as const },
  { label: "4:5", value: "4:5" as const },
  { label: "1:1", value: "1:1" as const },
  { label: "16:9", value: "16:9" as const },
];

const MICRO_STEP_META: Record<string, { title: string; subtitle?: string }> = {
  bierstil: { title: "Welches Bier?", subtitle: "Bierstil bestimmt Glas, Schaum und Farbe." },
  behaelter: { title: "Was soll im Bild sein?", subtitle: "Flasche, Glas oder beides?" },
  flaschentyp: { title: "Welche Flasche?", subtitle: "Silhouette und Volumen für realistische Proportionen." },
  flaschenfarbe: { title: "Flaschenfarbe?", subtitle: "Glas-/Flaschenfarbe passend zum Etikett." },
  schauplatz: { title: "Wo spielt die Szene?", subtitle: "Schauplatz und Stimmung der Umgebung." },
  personen: { title: "Mensch im Bild?", subtitle: "Produkt solo oder Lifestyle mit Personen?" },
  "person-gender": { title: "Geschlecht der Person", subtitle: "Nur für anonyme Lifestyle-Figuren." },
  "person-alter": { title: "Altersgruppe", subtitle: "Zielgruppe der Darstellung." },
  "person-koerper": { title: "Bildausschnitt Person", subtitle: "Wie viel von der Person ist sichtbar?" },
  "person-mood": { title: "Stimmung der Person", subtitle: "Ausdruck und Körpersprache." },
  "gruppe-anzahl": { title: "Wie viele Personen?", subtitle: "Gruppengröße in der Szene." },
  "gruppe-typ": { title: "Gruppentyp", subtitle: "Wer ist in der Gruppe?" },
  "gruppe-dynamik": { title: "Was macht die Gruppe?", subtitle: "Anstoßen, Sitzen, Outdoor …" },
  stimmung: { title: "Welche Trend-Stimmung?", subtitle: "Visueller Stil des Motivs." },
  licht: { title: "Welches Licht?", subtitle: "Tageszeit und Lichtstimmung." },
  shot: { title: "Bildausschnitt?", subtitle: "Kamerawinkel und Komposition." },
  format: { title: "Für welches Format?", subtitle: "Aspect Ratio für Social oder Print." },
  referenz: { title: "Referenz-Etikett", subtitle: "Optional: eigenes Etikett für diesen Run hochladen." },
  extras: { title: "Extras im Bild?", subtitle: "Optionale Details — mehr Extras = charakteristischer." },
  review: { title: "Prompt fertig — bereit zum Generieren?", subtitle: "Prüfe den Brief, wähle die Anzahl Varianten und starte." },
};

function buildMicroStepIds(
  behaelter: NonNullable<HyperrealisticInput["behaelter"]>,
  personenModus: NonNullable<HyperrealisticInput["personenModus"]>,
  flaschenTyp: HyperrealisticInput["flaschenTyp"],
): string[] {
  const ids = ["bierstil", "behaelter"];
  if (behaelter !== "G") {
    ids.push("flaschentyp");
    // Aluminium-Dose hat keine Glasfarbe — Frage überspringen.
    if (!isDoseTyp(flaschenTyp)) {
      ids.push("flaschenfarbe");
    }
  }
  ids.push("personen");
  ids.push("schauplatz");
  if (personenModus === "D") {
    ids.push("person-gender", "person-alter", "person-koerper", "person-mood");
  }
  if (personenModus === "E") {
    ids.push("gruppe-anzahl", "gruppe-typ", "gruppe-dynamik");
  }
  ids.push("stimmung", "licht");
  if (personenModus !== "E") {
    ids.push("shot");
  }
  ids.push("format", "referenz", "extras", "review");
  return ids;
}

type PromptBuildState = {
  was: WasOption;
  behaelter: NonNullable<HyperrealisticInput["behaelter"]>;
  flaschenTyp: HyperrealisticInput["flaschenTyp"];
  flaschenfarbe: HyperrealisticInput["flaschenfarbe"];
  wo: WoOption;
  wie: WieOption;
  wofuer: WofuerOption;
  personenModus: NonNullable<HyperrealisticInput["personenModus"]>;
  personGender?: HyperrealisticInput["personGender"];
  personAlter?: HyperrealisticInput["personAlter"];
  personKoerper?: HyperrealisticInput["personKoerper"];
  personMood?: HyperrealisticInput["personMood"];
  gruppenAnzahl?: HyperrealisticInput["gruppenAnzahl"];
  gruppenTyp?: HyperrealisticInput["gruppenTyp"];
  gruppenDynamik?: HyperrealisticInput["gruppenDynamik"];
  stimmungTrend: NonNullable<HyperrealisticInput["stimmungTrend"]>;
  shotType: NonNullable<HyperrealisticInput["shotType"]>;
  extras: string[];
  variantCount: VariantCount;
};

function segmentForMicroStep(stepId: string, s: PromptBuildState): PromptSegment | null {
  switch (stepId) {
    case "format":
      return { text: `${s.variantCount}× ${s.wofuer.aspectRatio}-Varianten`, highlight: true };
    case "flaschentyp": {
      const label = FLASCHEN_OPTIONS.find((o) => o.code === s.flaschenTyp)?.label ?? "Flasche";
      return { text: label, highlight: true };
    }
    case "flaschenfarbe": {
      const map = { braun: "braune Flasche", gruen: "grüne Flasche", klar: "klare Flasche" } as const;
      return { text: map[s.flaschenfarbe ?? "braun"], highlight: false };
    }
    case "bierstil":
      return { text: s.was.label, highlight: true };
    case "behaelter": {
      const map = { B: "Flasche + Glas", G: "Hero-Glas", F: "Produktfoto" } as const;
      return { text: map[s.behaelter], highlight: false };
    }
    case "schauplatz":
      return { text: s.wo.label, highlight: true };
    case "personen":
      return {
        text: PERSONEN_OPTIONS.find((o) => o.code === s.personenModus)?.label ?? "Kein Mensch",
        highlight: false,
      };
    case "person-gender":
      return s.personGender
        ? { text: PERSON_GENDER_OPTIONS.find((o) => o.code === s.personGender)?.label ?? "", highlight: false }
        : null;
    case "person-alter":
      return s.personAlter
        ? { text: PERSON_ALTER_OPTIONS.find((o) => o.code === s.personAlter)?.label ?? "", highlight: false }
        : null;
    case "person-koerper":
      return s.personKoerper
        ? { text: PERSON_KOERPER_OPTIONS.find((o) => o.code === s.personKoerper)?.label ?? "", highlight: false }
        : null;
    case "person-mood":
      return s.personMood
        ? { text: PERSON_MOOD_OPTIONS.find((o) => o.code === s.personMood)?.label ?? "", highlight: false }
        : null;
    case "gruppe-anzahl":
      return s.gruppenAnzahl
        ? { text: `${GRUPPEN_ANZAHL_OPTIONS.find((o) => o.code === s.gruppenAnzahl)?.label ?? ""} Personen`, highlight: false }
        : null;
    case "gruppe-typ":
      return s.gruppenTyp
        ? { text: GRUPPEN_TYP_OPTIONS.find((o) => o.code === s.gruppenTyp)?.label ?? "", highlight: false }
        : null;
    case "gruppe-dynamik":
      return s.gruppenDynamik
        ? { text: GRUPPEN_DYNAMIK_OPTIONS.find((o) => o.code === s.gruppenDynamik)?.label ?? "", highlight: false }
        : null;
    case "stimmung":
      return {
        text: STIMMUNG_OPTIONS.find((o) => o.code === s.stimmungTrend)?.label ?? "",
        highlight: false,
      };
    case "licht":
      return { text: s.wie.label, highlight: true };
    case "shot":
      return {
        text: SHOT_TYPE_OPTIONS.find((o) => o.code === s.shotType)?.label ?? "",
        highlight: false,
      };
    case "extras":
      return s.extras.length ? { text: s.extras.join(", "), highlight: false } : null;
    default:
      return null;
  }
}

function MarketingChoicePills<T extends { label: string }>({
  options,
  selected,
  onSelect,
  P,
}: {
  options: T[];
  selected: T;
  onSelect: (v: T) => void;
  P: StudioPalette;
}) {
  return (
    <div className="evg-marketing-create__pill-grid">
      {options.map((opt) => {
        const active = opt.label === selected.label;
        return (
          <button
            key={opt.label}
            type="button"
            onClick={() => onSelect(opt)}
            className={active ? "evg-marketing-create__pill evg-marketing-create__pill--active" : "evg-marketing-create__pill"}
            style={{
              borderColor: active ? "rgba(230,106,43,0.55)" : "rgba(245,237,223,0.12)",
              color: active ? STUDIO_TOKENS.amber2 : P.ink2,
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function MarketingCodePills<C extends string, T extends { code: C; label: string; hint?: string }>({
  options,
  value,
  onChange,
  P,
}: {
  options: readonly T[];
  value: C;
  onChange: (code: C) => void;
  P: StudioPalette;
}) {
  return (
    <div className="evg-marketing-create__pill-grid">
      {options.map((opt) => {
        const active = opt.code === value;
        return (
          <button
            key={opt.code}
            type="button"
            onClick={() => onChange(opt.code)}
            className={active ? "evg-marketing-create__pill evg-marketing-create__pill--active" : "evg-marketing-create__pill"}
            style={{
              borderColor: active ? "rgba(230,106,43,0.55)" : "rgba(245,237,223,0.12)",
              color: active ? STUDIO_TOKENS.amber2 : P.ink2,
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function formatDeNumber(n: number) {
  return n.toLocaleString("de-DE");
}

function CoachGauge({ score, P }: { score: number; P: StudioPalette }) {
  const size = 96;
  const stroke = 6;
  const r = (size - stroke * 2) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  const gradId = "coachGaugeGrad";
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)", filter: "drop-shadow(0 0 8px rgba(230,106,43,0.35))" }} aria-hidden="true">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F2A35A" />
            <stop offset="50%" stopColor="#E66A2B" />
            <stop offset="100%" stopColor="#C13B1F" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={P.rule} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset .6s cubic-bezier(.4,0,.2,1)" }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontFamily: STUDIO_TOKENS.accentSerif,
            fontSize: 30,
            fontWeight: 500,
            background: STUDIO_TOKENS.gradientBrand,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            lineHeight: 1,
            letterSpacing: -1,
          }}
        >
          {score}
        </span>
        <span style={{ fontFamily: STUDIO_TOKENS.mono, fontSize: 8, letterSpacing: 0.8, textTransform: "uppercase", color: P.ink3, marginTop: 3 }}>
          von 100
        </span>
      </div>
    </div>
  );
}

function getCalendarWeek(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

function imageSrc(image: ImageResponse) {
  return image.url ?? (image.b64_json ? `data:image/png;base64,${image.b64_json}` : "");
}


function Eyebrow({ children, P, className }: { children: React.ReactNode; P: StudioPalette; className?: string }) {
  return (
    <div
      className={className}
      style={{
        fontFamily: STUDIO_TOKENS.mono,
        fontSize: 11,
        letterSpacing: 1.2,
        textTransform: "uppercase",
        color: P.ink3,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 999, background: P.accent, display: "inline-block" }} />
      {children}
    </div>
  );
}

function PillRow<T extends { label: string }>({
  rowLabel,
  rowHint,
  options,
  selected,
  onSelect,
  P,
}: {
  rowLabel: string;
  rowHint?: string;
  options: T[];
  selected: T;
  onSelect: (v: T) => void;
  P: StudioPalette;
}) {
  return (
    <div
      className="studio-create-form-row"
      style={{
        gap: 20,
        padding: "18px 0",
        borderBottom: `1px solid ${P.rule}`,
      }}
    >
      <div>
        <div style={{ fontFamily: STUDIO_TOKENS.mono, fontSize: 10, letterSpacing: 1.1, textTransform: "uppercase", color: P.ink3, marginBottom: 6 }}>
          {rowLabel}
        </div>
        {rowHint ? (
          <div style={{ fontFamily: STUDIO_TOKENS.sans, fontSize: 12, color: P.ink3, lineHeight: 1.4 }}>{rowHint}</div>
        ) : null}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {options.map((opt) => {
          const active = opt.label === selected.label;
          return (
            <button
              key={opt.label}
              type="button"
              onClick={() => onSelect(opt)}
              className={active ? "evg-pill evg-pill-active" : "evg-pill"}
              style={{
                padding: "10px 16px",
                borderRadius: 999,
                border: `1px solid ${active ? "rgba(230,106,43,0.55)" : "rgba(245,237,223,0.10)"}`,
                background: active
                  ? "linear-gradient(135deg, rgba(242,163,90,0.18) 0%, rgba(230,106,43,0.14) 100%)"
                  : "rgba(245,237,223,0.03)",
                color: active ? STUDIO_TOKENS.ink : P.ink2,
                fontFamily: STUDIO_TOKENS.sans,
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                cursor: "pointer",
                transition: "all .18s ease",
                boxShadow: active ? "0 4px 14px -6px rgba(230,106,43,0.55), inset 0 1px 0 rgba(255,255,255,0.06)" : "none",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Pill-Reihe für Optionen mit `code`-Identität (vermeidet Label-Kollisionen). */
function CodePillRow<C extends string, T extends { code: C; label: string; hint?: string }>({
  rowLabel,
  rowHint,
  options,
  value,
  onChange,
  P,
}: {
  rowLabel: string;
  rowHint?: string;
  options: readonly T[];
  value: C;
  onChange: (code: C) => void;
  P: StudioPalette;
}) {
  const selected = options.find((o) => o.code === value);
  return (
    <div
      className="studio-create-form-row"
      style={{
        gap: 20,
        padding: "18px 0",
        borderBottom: `1px solid ${P.rule}`,
      }}
    >
      <div>
        <div style={{ fontFamily: STUDIO_TOKENS.mono, fontSize: 10, letterSpacing: 1.1, textTransform: "uppercase", color: P.ink3, marginBottom: 6 }}>
          {rowLabel}
        </div>
        {rowHint ? (
          <div style={{ fontFamily: STUDIO_TOKENS.sans, fontSize: 12, color: P.ink3, lineHeight: 1.4 }}>{rowHint}</div>
        ) : null}
        {selected?.hint ? (
          <div style={{ marginTop: 6, fontFamily: STUDIO_TOKENS.sans, fontSize: 12, color: P.ink2, lineHeight: 1.4, fontStyle: "italic" }}>
            {selected.hint}
          </div>
        ) : null}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {options.map((opt) => {
          const active = opt.code === value;
          return (
            <button
              key={opt.code}
              type="button"
              onClick={() => onChange(opt.code)}
              className={active ? "evg-pill evg-pill-active" : "evg-pill"}
              style={{
                padding: "10px 16px",
                borderRadius: 999,
                border: `1px solid ${active ? "rgba(230,106,43,0.55)" : "rgba(245,237,223,0.10)"}`,
                background: active
                  ? "linear-gradient(135deg, rgba(242,163,90,0.18) 0%, rgba(230,106,43,0.14) 100%)"
                  : "rgba(245,237,223,0.03)",
                color: active ? STUDIO_TOKENS.ink : P.ink2,
                fontFamily: STUDIO_TOKENS.sans,
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                cursor: "pointer",
                transition: "all .18s ease",
                boxShadow: active ? "0 4px 14px -6px rgba(230,106,43,0.55), inset 0 1px 0 rgba(255,255,255,0.06)" : "none",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Sub-Reihe (eingerückt, kleiner) für konditionale Folgefragen. */
function SubPillRow<C extends string, T extends { code: C; label: string; hint?: string }>({
  rowLabel,
  options,
  value,
  onChange,
  P,
}: {
  rowLabel: string;
  options: readonly T[];
  value: C | undefined;
  onChange: (code: C) => void;
  P: StudioPalette;
}) {
  return (
    <div
      className="studio-create-form-row"
      style={{
        gap: 20,
        alignItems: "center",
        padding: "10px 0 10px 20px",
        borderLeft: "2px solid transparent",
        borderImage: "linear-gradient(180deg, #F2A35A 0%, #C13B1F 100%) 1",
        marginLeft: 4,
      }}
    >
      <div
        style={{
          fontFamily: STUDIO_TOKENS.mono,
          fontSize: 9,
          letterSpacing: 1,
          textTransform: "uppercase",
          color: P.ink3,
        }}
      >
        <span
          style={{
            background: "linear-gradient(135deg, #F2A35A 0%, #E66A2B 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            marginRight: 4,
          }}
        >
          ↳
        </span>
        {rowLabel}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {options.map((opt) => {
          const active = opt.code === value;
          return (
            <button
              key={opt.code}
              type="button"
              onClick={() => onChange(opt.code)}
              className={active ? "evg-pill evg-pill-active" : "evg-pill"}
              style={{
                padding: "7px 13px",
                borderRadius: 999,
                border: `1px solid ${active ? "rgba(230,106,43,0.55)" : "rgba(245,237,223,0.08)"}`,
                background: active
                  ? "linear-gradient(135deg, rgba(242,163,90,0.16) 0%, rgba(230,106,43,0.10) 100%)"
                  : "transparent",
                color: active ? STUDIO_TOKENS.amber2 : P.ink2,
                fontFamily: STUDIO_TOKENS.sans,
                fontSize: 12,
                fontWeight: active ? 600 : 500,
                cursor: "pointer",
                transition: "all .18s ease",
                boxShadow: active ? "0 3px 10px -4px rgba(230,106,43,0.5)" : "none",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function InhalteErstellenRedesign({
  userEmail,
  initialProfileName,
  initialBreweryName,
  brandProfileComplete = true,
  brandProfileActive = false,
  brandProfileMode = "skip",
}: {
  userEmail?: string;
  initialProfileName?: string;
  initialBreweryName?: string;
  brandProfileComplete?: boolean;
  brandProfileActive?: boolean;
  brandProfileMode?: "undecided" | "guided" | "skip";
}) {
  const P = useStudioPalette();
  const router = useRouter();
  const { setBrandProfileActive, setContentPadding } = useStudioShell();
  const [brandProfileSetupOpen, setBrandProfileSetupOpen] = useState(false);
  const [profileComplete, setProfileComplete] = useState(brandProfileComplete);
  const [profileActive, setProfileActive] = useState(brandProfileActive);
  const [profileMode, setProfileMode] = useState(brandProfileMode);

  useEffect(() => {
    setProfileComplete(brandProfileComplete);
    setProfileActive(brandProfileActive);
    setProfileMode(brandProfileMode);
    if (brandProfileMode === "skip") {
      setEtikettModus("generisch");
    }
  }, [brandProfileComplete, brandProfileActive, brandProfileMode]);

  useEffect(() => {
    setContentPadding(`32px ${STUDIO_PAD_X}px 96px`);
    return () => setContentPadding(undefined);
  }, [setContentPadding]);

  useEffect(() => {
    setBrandProfileActive(brandProfileSetupOpen);
  }, [brandProfileSetupOpen, setBrandProfileActive]);

  const applyBrandScanAndPersist = useCallback(async (suggestion: BrandScanSuggestion) => {
    setProfileComplete(true);
    setProfileActive(true);
    setProfileMode("guided");
    setBreweryName(suggestion.breweryName);
    window.setTimeout(() => router.refresh(), 300);
  }, [router]);

  const [was, setWas] = useState(WAS_OPTIONS[0]);
  const [wo, setWo] = useState(WO_OPTIONS[0]);
  const [wie, setWie] = useState(WIE_OPTIONS[0]);
  const [wofuer, setWofuer] = useState(WOFUER_OPTIONS[0]);
  const [extras, setExtras] = useState<string[]>([]);
  const [breweryName, setBreweryName] = useState(initialBreweryName?.trim() || "");
  const [etikettUrl, setEtikettUrl] = useState("");
  const [referenceImagesStale, setReferenceImagesStale] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [error, setError] = useState("");
  const [images, setImages] = useState<ImageResponse[]>([]);
  const [tokensRemaining, setTokensRemaining] = useState<number | null>(null);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);

  // Skill-Slots — Higgsfield-Style progressive disclosure
  const [behaelter, setBehaelter] = useState<NonNullable<HyperrealisticInput["behaelter"]>>("B");
  const [flaschenTyp, setFlaschenTyp] = useState<HyperrealisticInput["flaschenTyp"]>("nrw_500");
  const [flaschenfarbe, setFlaschenfarbe] = useState<HyperrealisticInput["flaschenfarbe"]>("braun");
  const [personenModus, setPersonenModus] = useState<NonNullable<HyperrealisticInput["personenModus"]>>("A");
  const [personGender, setPersonGender] = useState<HyperrealisticInput["personGender"]>();
  const [personAlter, setPersonAlter] = useState<HyperrealisticInput["personAlter"]>("jung");
  const [personKoerper, setPersonKoerper] = useState<HyperrealisticInput["personKoerper"]>("halbkoerper");
  const [personMood, setPersonMood] = useState<HyperrealisticInput["personMood"]>("entspannt");
  const [gruppenAnzahl, setGruppenAnzahl] = useState<HyperrealisticInput["gruppenAnzahl"]>("3");
  const [gruppenTyp, setGruppenTyp] = useState<HyperrealisticInput["gruppenTyp"]>("gemischt");
  const [gruppenDynamik, setGruppenDynamik] = useState<HyperrealisticInput["gruppenDynamik"]>("E2");
  const [stimmungTrend, setStimmungTrend] = useState<NonNullable<HyperrealisticInput["stimmungTrend"]>>("nachhaltig");
  const [shotType, setShotType] = useState<NonNullable<HyperrealisticInput["shotType"]>>("A");
  const [kiPlattform, setKiPlattform] = useState<NonNullable<HyperrealisticInput["kiPlattform"]>>("gpt_image_2");
  const [etikettModus, setEtikettModus] = useState<NonNullable<HyperrealisticInput["etikettModus"]>>(() =>
    brandProfileMode === "skip" ? "generisch" : "marke",
  );
  const [variantCount, setVariantCount] = useState<VariantCount>(DEFAULT_VARIANT_COUNT);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Neuer Einstieg: Start-Screen (Bier + Anlass) vor dem Wizard.
  const [flowMode, setFlowMode] = useState<"start" | "wizard">("start");
  const [fromTemplate, setFromTemplate] = useState(false);
  const [selectedBeer, setSelectedBeer] = useState<DashboardBeer | null>(null);
  // Anlass-Zusatz der Vorlage bzw. freier Wunsch des Users — fliesst in zusatzWunsch.
  const [occasionNote, setOccasionNote] = useState("");

  // Ad-hoc Referenzbild-Upload (ueberschreibt Markenprofil-Etikett nur fuer diesen Run).
  const [customReferenceDataUrl, setCustomReferenceDataUrl] = useState<string>("");
  const [customReferenceName, setCustomReferenceName] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>("");

  async function handleReferenceUpload(file: File) {
    setUploadError("");
    setUploading(true);
    try {
      if (!file.type.startsWith("image/")) {
        throw new Error("Bitte ein Bild auswaehlen (PNG, JPG, WEBP).");
      }
      if (file.size > 12 * 1024 * 1024) {
        throw new Error("Datei zu gross — bitte unter 12 MB.");
      }
      const dataUrl = await readAndCompressImage(file);
      setCustomReferenceDataUrl(dataUrl);
      setCustomReferenceName(file.name);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload fehlgeschlagen.");
    } finally {
      setUploading(false);
    }
  }

  function clearCustomReference() {
    setCustomReferenceDataUrl("");
    setCustomReferenceName("");
    setUploadError("");
  }

  useEffect(() => {
    let ignore = false;
    (async () => {
      const [settingsRes, summaryRes] = await Promise.all([
        fetch("/api/dashboard/settings", { cache: "no-store" }),
        fetch("/api/dashboard/summary", { cache: "no-store" }),
      ]);
      if (ignore) return;
      if (settingsRes.ok) {
        const json = (await settingsRes.json()) as {
          settings?: {
            breweryName?: string;
            brandProfileMode?: "undecided" | "guided" | "skip";
            brandReferenceImageUrls?: string[];
            brandLabelReferenceUrl?: string;
            brandReferenceImagesStale?: boolean;
          };
        };
        if (json.settings?.breweryName?.trim()) setBreweryName(json.settings.breweryName.trim());
        const settingsMode = json.settings?.brandProfileMode;
        if (settingsMode === "guided" || settingsMode === "skip" || settingsMode === "undecided") {
          setProfileMode(settingsMode);
        }
        if (settingsMode === "skip") {
          setProfileComplete(true);
          setProfileActive(false);
          setEtikettModus("generisch");
          setEtikettUrl("");
          setReferenceImagesStale(false);
        } else if (json.settings?.brandReferenceImagesStale) {
          setEtikettUrl("");
          setReferenceImagesStale(true);
        } else {
          // Etikett-Referenz MUSS der Packshot (Etikett-Traeger) sein — die
          // brandReferenceImageUrls sind seit der Szenen-zuerst-Auswahl
          // Stimmungsbilder und taugen nicht als Etikett-Vorlage.
          const labelRef = json.settings?.brandLabelReferenceUrl?.trim();
          const refs = json.settings?.brandReferenceImageUrls;
          const effectiveLabel = labelRef || (Array.isArray(refs) ? refs[0] : "") || "";
          setEtikettUrl(effectiveLabel);
          setReferenceImagesStale(false);
          if (!effectiveLabel && settingsMode !== "guided") {
            setEtikettModus("generisch");
          }
        }
      }
      if (summaryRes.ok) {
        const json = (await summaryRes.json()) as {
          summary?: {
            tokens?: { remaining?: number };
            plan?: string | null;
            billingStatus?: string;
          };
        };
        const remaining = json.summary?.tokens?.remaining;
        if (typeof remaining === "number") setTokensRemaining(remaining);
        const status = json.summary?.billingStatus ?? "none";
        setHasActiveSubscription(
          Boolean(json.summary?.plan) && status !== "none" && status !== "canceled",
        );
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  const behaelterLabel =
    behaelter === "G" ? "Hero-Glas" : behaelter === "F" ? "Flaschen-Shot" : "Flasche + Glas";
  const personenLabel = PERSONEN_OPTIONS.find((o) => o.code === personenModus)?.label ?? "Kein Mensch";
  const stimmungLabel = STIMMUNG_OPTIONS.find((o) => o.code === stimmungTrend)?.label ?? "Nachhaltig";

  const briefSentence = useMemo(
    () => (
      <>
        Zeig{" "}
        <em style={{ fontStyle: "italic", color: P.accent }}>
          {was.label} als {behaelterLabel.toLowerCase()}
        </em>{" "}
        in <em style={{ fontStyle: "italic", color: P.accent }}>{wo.label}</em>,{" "}
        {personenModus === "A" ? "ohne Personen" : `mit ${personenLabel.toLowerCase()}`} ·{" "}
        <em style={{ fontStyle: "italic", color: P.accent }}>
          {wie.label}, {stimmungLabel.toLowerCase()}
        </em>{" "}
        · für <em style={{ fontStyle: "italic", color: P.accent }}>{wofuer.label}</em>.
      </>
    ),
    [was, wo, wie, wofuer, personenModus, personenLabel, stimmungLabel, behaelterLabel, P.accent],
  );

  const brandLabel = breweryName || initialBreweryName?.trim() || "deiner Brauerei";
  const effectiveEtikettModus = profileMode === "skip" ? "generisch" : etikettModus;
  // Etikett-Prioritaet: Ad-hoc-Upload > Sorten-Etikett aus "Meine Biere" > Markenprofil.
  const beerEtikettUrl = selectedBeer?.etikettUrl?.trim() || "";
  const profileEtikettUrl = beerEtikettUrl || etikettUrl;
  const hasReferenceImage = Boolean(customReferenceDataUrl || profileEtikettUrl);
  const generationTokenCost = useMemo(() => {
    const hasRef = Boolean(customReferenceDataUrl || (effectiveEtikettModus === "marke" && profileEtikettUrl));
    const strictLabel = effectiveEtikettModus === "marke" && hasRef;
    // Server rendert mit gpt-image-2 quality "medium" → Abrechnung als 1K.
    // Die Anzeige muss zur tatsächlichen Server-Abrechnung passen.
    return calculateGenerationTokenCost({
      resolution: "1K",
      hasReferenceImage: hasRef,
      strictLabelMode: strictLabel,
      variantCount,
    });
  }, [customReferenceDataUrl, effectiveEtikettModus, profileEtikettUrl, variantCount]);
  const personenSetUp =
    personenModus === "A" ||
    personenModus === "B" ||
    personenModus === "C" ||
    (personenModus === "D" && Boolean(personGender && personAlter)) ||
    (personenModus === "E" && Boolean(gruppenDynamik && wo));
  const etikettOK = effectiveEtikettModus === "generisch" || hasReferenceImage;
  const hasDetailExtra = extras.length >= 1;
  const hasManyExtras = extras.length >= 3;

  const coachScore = useMemo(() => {
    let score = 55;
    if (etikettOK) score += 12;
    if (was && wo && wie) score += 5;
    if (personenSetUp) score += 8;
    if (stimmungTrend) score += 6;
    if (shotType) score += 4;
    if (hasDetailExtra) score += 4;
    if (hasManyExtras) score += 6;
    return Math.min(100, score);
  }, [etikettOK, was, wo, wie, personenSetUp, stimmungTrend, shotType, hasDetailExtra, hasManyExtras]);

  const coachLabel = coachScore >= 85 ? "Top" : coachScore >= 75 ? "Gut" : "Fast bereit";
  const coachReady = coachScore >= 85;

  const coachChecks = useMemo(
    () => [
      {
        done: etikettOK,
        label:
          effectiveEtikettModus === "marke"
            ? customReferenceDataUrl
              ? "Eigenes Referenzbild für diesen Run hochgeladen"
              : beerEtikettUrl
                ? `Etikett von „${selectedBeer?.name ?? "Sorte"}“ verknüpft`
                : etikettUrl
                  ? `Marken-Etikett ${brandLabel} verknüpft`
                  : "Marken-Etikett fehlt — Referenz hochladen oder „Generisch“ wählen"
            : "Generisches Etikett — kein Markenbezug nötig",
      },
      { done: true, label: `Behälter gewählt: ${behaelterLabel}` },
      {
        done: personenSetUp,
        label:
          personenModus === "D"
            ? `Person mit Gesicht — Details ${personGender && personAlter ? "vollständig" : "fehlen"}`
            : personenModus === "E"
              ? `Gruppe — ${gruppenDynamik && wo ? "Dynamik & Schauplatz gesetzt" : "Dynamik/Schauplatz fehlt"}`
              : `Personen-Modus: ${personenLabel}`,
      },
      { done: Boolean(stimmungTrend), label: `Trend-Stimmung: ${stimmungLabel}` },
      { done: Boolean(shotType), label: `Shot Type: ${SHOT_TYPE_OPTIONS.find((s) => s.code === shotType)?.label}` },
      { done: hasManyExtras, label: "3+ Extras = besonders charakteristische Bilder" },
    ],
    [
      etikettOK,
      effectiveEtikettModus,
      customReferenceDataUrl,
      etikettUrl,
      beerEtikettUrl,
      selectedBeer,
      brandLabel,
      behaelterLabel,
      personenSetUp,
      personenModus,
      personGender,
      personAlter,
      gruppenDynamik,
      personenLabel,
      stimmungTrend,
      stimmungLabel,
      shotType,
      hasManyExtras,
    ],
  );

  const todayLine = new Date().toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  function toggleExtra(label: string) {
    setExtras((prev) => (prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label]));
  }

  const [generationStep, setGenerationStep] = useState<string>("");
  const [variantProgress, setVariantProgress] = useState<number[]>([]);

  const microStepIds = useMemo(
    () => buildMicroStepIds(behaelter, personenModus, flaschenTyp),
    [behaelter, personenModus, flaschenTyp],
  );
  const [microStepIndex, setMicroStepIndex] = useState(0);

  useEffect(() => {
    setMicroStepIndex((i) => Math.min(i, microStepIds.length - 1));
  }, [microStepIds]);

  const currentMicroStepId = microStepIds[microStepIndex] ?? "bierstil";
  const isReviewStep = currentMicroStepId === "review";
  const currentMicroMeta = MICRO_STEP_META[currentMicroStepId] ?? { title: "Motiv" };

  const goMicroNext = useCallback(() => {
    setMicroStepIndex((i) => Math.min(microStepIds.length - 1, i + 1));
  }, [microStepIds.length]);

  const goMicroPrev = useCallback(() => {
    setMicroStepIndex((i) => Math.max(0, i - 1));
  }, []);

  // Bier aus dem Sortiment vorbelegen: Stil, Flasche, Farbe (Etikett via selectedBeer).
  const applyBeer = useCallback((beer: DashboardBeer | null) => {
    setSelectedBeer(beer);
    if (!beer) return;
    const style = findBeerStyle(beer.bierstil);
    setWas(style ?? { label: beerStyleLabel(beer.bierstil), bierstil: beer.bierstil, glasTyp: "willibecher" });
    if (beer.flaschenTyp in FLASCHEN_TYPEN) {
      setFlaschenTyp(beer.flaschenTyp as HyperrealisticInput["flaschenTyp"]);
    }
    setFlaschenfarbe(beer.flaschenfarbe);
    if (beer.etikettUrl && profileMode !== "skip") {
      setEtikettModus("marke");
    }
  }, [profileMode]);

  // Anlass-Vorlage anwenden und direkt zum finalen Check springen.
  const applyTemplate = useCallback((template: OccasionTemplate) => {
    const p = template.preset;
    const nextBehaelter = p.behaelter ?? "B";
    setBehaelter(nextBehaelter);
    const woMatch = WO_OPTIONS.find((o) => o.szene === p.szene);
    if (woMatch) setWo(woMatch);
    const wieMatch = WIE_OPTIONS.find((o) => o.tageszeit === p.tageszeit);
    if (wieMatch) setWie(wieMatch);
    const wofuerMatch = WOFUER_OPTIONS.find((o) => o.aspectRatio === p.aspectRatio);
    if (wofuerMatch) setWofuer(wofuerMatch);
    setStimmungTrend(p.stimmungTrend);
    setPersonenModus(p.personenModus);
    if (p.personenModus === "E") {
      setGruppenAnzahl(p.gruppenAnzahl ?? "3");
      setGruppenTyp(p.gruppenTyp ?? "gemischt");
      setGruppenDynamik(p.gruppenDynamik ?? "E2");
    }
    setShotType(p.shotType);
    setExtras(p.extras);
    setOccasionNote(p.promptNote);
    setFromTemplate(true);
    setFlowMode("wizard");
    // Direkt zum Review — Micro-Step-Liste haengt von Behaelter/Personen ab.
    setMicroStepIndex(buildMicroStepIds(nextBehaelter, p.personenModus, flaschenTyp).length - 1);
  }, [flaschenTyp]);

  const startCustomWizard = useCallback(() => {
    setOccasionNote("");
    setFromTemplate(false);
    setFlowMode("wizard");
    setMicroStepIndex(0);
  }, []);

  const backToStart = useCallback(() => {
    setFlowMode("start");
    setHasGenerated(false);
    setImages([]);
    setError("");
    setGenerationStep("");
    setVariantProgress([]);
  }, []);

  const flaschenTypLabel = FLASCHEN_OPTIONS.find((o) => o.code === flaschenTyp)?.label ?? "Flasche";

  const promptBuildState: PromptBuildState = useMemo(
    () => ({
      was,
      behaelter,
      flaschenTyp,
      flaschenfarbe,
      wo,
      wie,
      wofuer,
      personenModus,
      personGender,
      personAlter,
      personKoerper,
      personMood,
      gruppenAnzahl,
      gruppenTyp,
      gruppenDynamik,
      stimmungTrend,
      shotType,
      extras,
      variantCount,
    }),
    [
      was,
      behaelter,
      flaschenTyp,
      flaschenfarbe,
      wo,
      wie,
      wofuer,
      personenModus,
      personGender,
      personAlter,
      personKoerper,
      personMood,
      gruppenAnzahl,
      gruppenTyp,
      gruppenDynamik,
      stimmungTrend,
      shotType,
      extras,
      variantCount,
    ],
  );

  // Nach der ersten Generierung (oder auf dem Review-Step) alle Schritte als
  // klickbare Segmente freischalten — so muss man sich nicht mehr Schritt für
  // Schritt zurueckklicken, sondern springt direkt zum gewuenschten Punkt.
  const promptNav = useMemo(() => {
    const revealAll = isReviewStep || hasGenerated;
    const segments: PromptSegment[] = [];
    const targets: number[] = [];
    const upper = revealAll ? microStepIds.length - 1 : microStepIndex;
    for (let i = 0; i <= upper && i < microStepIds.length; i += 1) {
      const id = microStepIds[i];
      if (id === "referenz") continue;
      if (id === "review") {
        if (revealAll) {
          segments.push({ text: "Übersicht", highlight: false });
          targets.push(i);
        }
        continue;
      }
      const seg = segmentForMicroStep(id, promptBuildState);
      if (seg) {
        segments.push(seg);
        targets.push(i);
      }
    }
    return { segments, targets };
  }, [microStepIds, microStepIndex, promptBuildState, isReviewStep, hasGenerated]);
  const promptSegments = promptNav.segments;

  const jumpToStep = useCallback(
    (idx: number) => {
      if (loading) return;
      setMicroStepIndex(Math.max(0, Math.min(microStepIds.length - 1, idx)));
    },
    [loading, microStepIds.length],
  );

  const formatTag = useMemo(() => {
    const ar = wofuer.aspectRatio;
    if (ar === "9:16") return "Social · Reels";
    if (ar === "4:5") return "Social · Feed";
    if (ar === "1:1") return "Social · Post";
    return "Landscape · Banner";
  }, [wofuer.aspectRatio]);

  const brandMetaLine = useMemo(() => {
    const brand = breweryName || brandLabel;
    if (selectedBeer) return `Marke: ${brand} · ${selectedBeer.name}`;
    if (behaelter === "G") return `Marke: ${brand}`;
    return `Marke: ${brand} · ${flaschenTypLabel}`;
  }, [breweryName, brandLabel, behaelter, flaschenTypLabel, selectedBeer]);

  const variantCards = useMemo(() => {
    if (images.length === 0) return [];
    return images.map((img, index) => {
      const src = imageSrc(img);
      return {
        index,
        src: src || undefined,
        loading: !src,
        progress: src ? 100 : variantProgress[index] ?? 12,
      };
    });
  }, [images, variantProgress]);

  useEffect(() => {
    if (currentMicroStepId === "person-gender" && !personGender) setPersonGender("maennlich");
  }, [currentMicroStepId, personGender]);

  useEffect(() => {
    if (personenModus === "E" && gruppenDynamik === "E1") {
      setShotType("H");
    }
  }, [personenModus, gruppenDynamik]);

  const canProceedMicro = useMemo(() => {
    switch (currentMicroStepId) {
      case "person-gender":
        return Boolean(personGender);
      default:
        return true;
    }
  }, [currentMicroStepId, personGender]);

  const handleAspectChange = useCallback((value: string) => {
    const match = WOFUER_OPTIONS.find((o) => o.aspectRatio === value);
    if (match) setWofuer(match);
  }, []);

  async function persistMediaItem(item: {
    id: string;
    imageUrl: string;
    title: string;
    prompt: string;
    createdAt: string;
    aspectRatio: string;
    resolution: "1K" | "2K" | "4K";
    outputFormat: "png" | "jpg";
  }): Promise<void> {
    try {
      const res = await fetch("/api/dashboard/media", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...item,
          title: item.title.trim().slice(0, 120),
          prompt: item.prompt.trim().slice(0, 240),
        }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        console.warn("[inhalte-erstellen] media persist failed:", res.status, json?.error);
      }
    } catch (persistError) {
      console.warn("[inhalte-erstellen] media persist failed:", persistError);
    }
  }

  async function generate() {
    setLoading(true);
    setHasGenerated(true);
    setError("");
    // Loading-Kacheln sofort anzeigen (noch bevor der langsame create-task-Call
    // zurueckkommt), damit sichtbar ist: es geht jetzt los.
    setImages(Array.from({ length: variantCount }, () => ({}) as ImageResponse));
    setVariantProgress(Array.from({ length: variantCount }, () => 5));
    setGenerationStep("Brief wird verarbeitet …");
    setMicroStepIndex(buildMicroStepIds(behaelter, personenModus, flaschenTyp).length - 1);
    try {
      // Gewähltes Bier: nur DESSEN Etikett (oder Ad-hoc-Upload). Kein stilles Fallback auf ein anderes Markenbild.
      const effectiveEtikettModus = profileMode === "skip" ? "generisch" : etikettModus;
      const beerLabel = selectedBeer?.etikettUrl?.trim() || "";
      const effectiveEtikett =
        customReferenceDataUrl ||
        (selectedBeer
          ? beerLabel
          : effectiveEtikettModus === "marke"
            ? profileEtikettUrl
            : profileEtikettUrl || "https://example.com/placeholder.png");

      if (
        selectedBeer &&
        effectiveEtikettModus === "marke" &&
        !customReferenceDataUrl &&
        !hasUsableBeerEtikett(beerLabel)
      ) {
        throw new Error(
          `Für „${selectedBeer.name}“ fehlt das Etikett. Bitte unter „Dein Bier“ ein Flaschenfoto mit Etikett hochladen — das wird 1:1 übernommen.`,
        );
      }
      if (!selectedBeer && effectiveEtikettModus === "marke" && !effectiveEtikett) {
        throw new Error(
          "Bitte wähle ein Bier mit Etikett oder lade ein Referenzbild hoch.",
        );
      }

      const zusatzParts = [occasionNote.trim(), ...extras].filter(Boolean);
      const zusatzWunsch = zusatzParts.length ? zusatzParts.join(", ").slice(0, 300) : undefined;
      const payload: HyperrealisticInput = {
        etikettBild: effectiveEtikett,
        flaschenTyp,
        flaschenfarbe,
        bierstil: was.bierstil,
        glasTyp: behaelter === "F" ? undefined : was.glasTyp,
        szene: wo.szene,
        behaelter,
        personImBild: personenModus === "D" || personenModus === "E",
        personenModus,
        personGender: personenModus === "D" ? personGender : undefined,
        personAlter: personenModus === "D" ? personAlter : undefined,
        personKoerper: personenModus === "D" ? personKoerper : undefined,
        personMood: personenModus === "D" ? personMood : undefined,
        gruppenAnzahl: personenModus === "E" ? gruppenAnzahl : undefined,
        gruppenTyp: personenModus === "E" ? gruppenTyp : undefined,
        gruppenDynamik: personenModus === "E" ? gruppenDynamik : undefined,
        tageszeit: wie.tageszeit,
        stimmungTrend,
        stimmung: "gesellig",
        shotType,
        kiPlattform,
        etikettModus: effectiveEtikettModus,
        beerName: selectedBeer?.name?.trim() || undefined,
        zusatzWunsch,
        aspectRatio: wofuer.aspectRatio,
        // Server rendert mit gpt-image-2 quality "medium" (1K) als Standard —
        // wir halten Payload + Abrechnung + gespeicherte Auflösung konsistent.
        quality: "medium",
        variantCount,
      };
      const parsed = hyperrealisticSchema.parse(payload);
      if (
        hasActiveSubscription &&
        tokensRemaining !== null &&
        tokensRemaining < generationTokenCost
      ) {
        throw new Error(
          `Nicht genug Tokens. Benötigt: ${generationTokenCost}, verfügbar: ${tokensRemaining}.`,
        );
      }
      setGenerationStep(`KI generiert ${variantCount} Variante(n) …`);

      // OpenAI rendert synchron (kann je nach Qualitaet ~40-120s/Variante dauern).
      // Wir lassen den Fortschritt asymptotisch weiterkriechen + zeigen die
      // vergangene Zeit, damit nichts „eingefroren" wirkt.
      const startedAt = Date.now();
      const progressTimer = window.setInterval(() => {
        const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
        setVariantProgress((prev) => {
          const base = prev.length ? prev : Array.from({ length: variantCount }, () => 5);
          return base.map((p) => (p >= 96 ? p : p + Math.max(0.4, (96 - p) * 0.05)));
        });
        setGenerationStep(
          elapsedSec < 75
            ? `KI generiert ${variantCount} Variante(n) … (~${elapsedSec}s)`
            : `Hochwertige Bilder brauchen etwas — noch in Arbeit … (~${elapsedSec}s)`,
        );
      }, 1000);

      let data: {
        error?: string;
        images?: { imageUrl: string }[];
        variantCount?: number;
        expectedVariants?: number;
        partial?: boolean;
        partialErrors?: string[];
        prompt?: string;
        outputFormat?: "png" | "jpg";
        billing?: {
          freeTrial?: boolean;
          consumed?: number;
          remainingTokens?: number;
        };
      };
      try {
        const res = await fetch("/api/inhalte-erstellen/create-task", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed),
        });
        data = (await res.json()) as typeof data;
        if (!res.ok) {
          throw new Error(data.error ?? "Bildgenerierung fehlgeschlagen.");
        }
      } finally {
        window.clearInterval(progressTimer);
      }

      const resultImages = Array.isArray(data.images) ? data.images : [];
      if (resultImages.length === 0) {
        throw new Error(data.error ?? "Keine Variante konnte generiert werden.");
      }

      if (typeof data.billing?.remainingTokens === "number") {
        setTokensRemaining(data.billing.remainingTokens);
        window.dispatchEvent(new CustomEvent("evglab-billing-updated"));
      }

      setImages(resultImages.map((img) => ({ url: img.imageUrl })));
      setVariantProgress(resultImages.map(() => 100));

      const mediaPromptLabel = (() => {
        const base = `${was.label} · ${behaelterLabel} · ${wo.label} · ${wie.label}`.slice(0, 120);
        return base.trim().length > 0 ? base : "BrewAI-Motiv";
      })();
      const mediaResolution: "1K" | "2K" = parsed.quality === "high" ? "2K" : "1K";
      const outputFormat = data.outputFormat ?? "png";

      void (async () => {
        for (const [index, img] of resultImages.entries()) {
          await persistMediaItem({
            id: `openai-${Date.now()}-${index}`,
            imageUrl: img.imageUrl,
            title: mediaPromptLabel,
            prompt: mediaPromptLabel,
            createdAt: new Date().toISOString(),
            aspectRatio: parsed.aspectRatio,
            resolution: mediaResolution,
            outputFormat,
          });
        }
      })();

      if (data.partial && data.partialErrors && data.partialErrors.length > 0) {
        setError(
          `${resultImages.length} von ${data.expectedVariants ?? variantCount} Variante(n) erstellt — manche Generierungen wurden abgelehnt.`,
        );
      }
      setGenerationStep("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generierung fehlgeschlagen.");
      setGenerationStep("");
      // Nur leere Platzhalter entfernen — fertige Varianten bleiben erhalten.
      setImages((prev) => prev.filter((img) => Boolean(img.url || img.b64_json)));
    } finally {
      setLoading(false);
    }
  }

  const tokensFreeLabel =
    tokensRemaining !== null ? formatDeNumber(tokensRemaining) : "—";
  const tokensStatusLabel =
    tokensRemaining !== null ? `Tokens ${tokensFreeLabel}/100` : "Tokens —";

  const microStepContent = (() => {
    switch (currentMicroStepId) {
      case "bierstil":
        return <MarketingChoicePills options={WAS_OPTIONS} selected={was} onSelect={setWas} P={P} />;
      case "behaelter":
        return <MarketingCodePills options={BEHAELTER_OPTIONS} value={behaelter} onChange={setBehaelter} P={P} />;
      case "flaschentyp":
        return (
          <MarketingCodePills
            options={FLASCHEN_OPTIONS}
            value={flaschenTyp ?? "nrw_500"}
            onChange={(c) => setFlaschenTyp(c as HyperrealisticInput["flaschenTyp"])}
            P={P}
          />
        );
      case "flaschenfarbe":
        return (
          <MarketingCodePills
            options={[
              { code: "braun" as const, label: "Braun" },
              { code: "gruen" as const, label: "Grün" },
              { code: "klar" as const, label: "Klar" },
            ]}
            value={flaschenfarbe ?? "braun"}
            onChange={(c) => setFlaschenfarbe(c as HyperrealisticInput["flaschenfarbe"])}
            P={P}
          />
        );
      case "schauplatz":
        return <MarketingChoicePills options={WO_OPTIONS} selected={wo} onSelect={setWo} P={P} />;
      case "personen":
        return <MarketingCodePills options={PERSONEN_OPTIONS} value={personenModus} onChange={setPersonenModus} P={P} />;
      case "person-gender":
        return (
          <MarketingCodePills
            options={PERSON_GENDER_OPTIONS}
            value={personGender ?? "maennlich"}
            onChange={setPersonGender}
            P={P}
          />
        );
      case "person-alter":
        return <MarketingCodePills options={PERSON_ALTER_OPTIONS} value={personAlter ?? "jung"} onChange={setPersonAlter} P={P} />;
      case "person-koerper":
        return (
          <MarketingCodePills options={PERSON_KOERPER_OPTIONS} value={personKoerper ?? "halbkoerper"} onChange={setPersonKoerper} P={P} />
        );
      case "person-mood":
        return <MarketingCodePills options={PERSON_MOOD_OPTIONS} value={personMood ?? "entspannt"} onChange={setPersonMood} P={P} />;
      case "gruppe-anzahl":
        return (
          <MarketingCodePills options={GRUPPEN_ANZAHL_OPTIONS} value={gruppenAnzahl ?? "3"} onChange={setGruppenAnzahl} P={P} />
        );
      case "gruppe-typ":
        return <MarketingCodePills options={GRUPPEN_TYP_OPTIONS} value={gruppenTyp ?? "gemischt"} onChange={setGruppenTyp} P={P} />;
      case "gruppe-dynamik":
        return (
          <MarketingCodePills options={GRUPPEN_DYNAMIK_OPTIONS} value={gruppenDynamik ?? "E2"} onChange={setGruppenDynamik} P={P} />
        );
      case "stimmung":
        return <MarketingCodePills options={STIMMUNG_OPTIONS} value={stimmungTrend} onChange={setStimmungTrend} P={P} />;
      case "licht":
        return <MarketingChoicePills options={WIE_OPTIONS} selected={wie} onSelect={setWie} P={P} />;
      case "shot":
        return <MarketingCodePills options={SHOT_TYPE_OPTIONS} value={shotType} onChange={setShotType} P={P} />;
      case "format":
        return <MarketingChoicePills options={WOFUER_OPTIONS} selected={wofuer} onSelect={setWofuer} P={P} />;
      case "referenz":
        return (
          <div className="evg-marketing-create__referenz">
            <span className="studio-field-label" style={{ display: "block", marginBottom: 8 }}>
              Etikett-Modus
            </span>
            <MarketingCodePills
              options={ETIKETT_MODUS_OPTIONS}
              value={profileMode === "skip" ? "generisch" : etikettModus}
              onChange={(next) => {
                if (profileMode === "skip") return;
                setEtikettModus(next);
              }}
              P={P}
            />
            {profileMode === "skip" ? (
              <p style={{ margin: "10px 0 0", fontFamily: STUDIO_TOKENS.sans, fontSize: 12, color: P.ink3, lineHeight: 1.45 }}>
                Du nutzt BrewAI ohne Markenprofil — Etikett-Modus ist automatisch „Generisch“.
              </p>
            ) : null}
            <p style={{ margin: "14px 0 12px", fontFamily: STUDIO_TOKENS.sans, fontSize: 13, color: P.ink2, lineHeight: 1.5 }}>
              {customReferenceDataUrl
                ? `${customReferenceName || "Hochgeladenes Bild"} wird für diesen Run genutzt.`
                : beerEtikettUrl
                  ? `Etikett von „${selectedBeer?.name ?? "deiner Sorte"}“ ist verknüpft. Optional kannst du ein anderes Referenzbild hochladen.`
                  : etikettUrl
                    ? "Markenprofil-Etikett ist verknüpft. Optional kannst du ein anderes Referenzbild hochladen."
                    : "Optional: Etikett oder Stil-Referenz für diesen Run hochladen."}
            </p>
            {uploadError ? (
              <p style={{ margin: "0 0 10px", fontSize: 12, color: "#B83A2A", fontFamily: STUDIO_TOKENS.sans }}>{uploadError}</p>
            ) : null}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <label className="evg-marketing-create__pill" style={{ cursor: uploading ? "wait" : "pointer", color: P.ink2 }}>
                {uploading ? "Komprimiere …" : customReferenceDataUrl ? "Anderes Bild" : "Bild hochladen"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={uploading}
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleReferenceUpload(file);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
              {customReferenceDataUrl ? (
                <button type="button" className="evg-marketing-create__pill" onClick={clearCustomReference} style={{ color: P.ink3 }}>
                  Zurücksetzen
                </button>
              ) : null}
            </div>
            {(customReferenceDataUrl || profileEtikettUrl) && (
              <div
                style={{
                  marginTop: 14,
                  width: 88,
                  height: 88,
                  borderRadius: 12,
                  overflow: "hidden",
                  border: `1px solid ${P.rule}`,
                }}
              >
                <img
                  src={customReferenceDataUrl || profileEtikettUrl}
                  alt="Referenz Vorschau"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
            )}
          </div>
        );
      case "extras":
        return (
          <div className="evg-marketing-create__pill-grid">
            {EXTRA_OPTIONS.map((label) => {
              const on = extras.includes(label);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleExtra(label)}
                  className={on ? "evg-marketing-create__pill evg-marketing-create__pill--active" : "evg-marketing-create__pill"}
                  style={{
                    borderColor: on ? "rgba(230,106,43,0.55)" : "rgba(245,237,223,0.12)",
                    color: on ? STUDIO_TOKENS.amber2 : P.ink2,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        );
      case "review":
        return (
          <div className="evg-marketing-create__review">
            <CoachGauge score={coachScore} P={P} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: STUDIO_TOKENS.sans, fontSize: 18, fontWeight: 700, color: P.ink }}>{coachLabel}</div>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: P.ink2, lineHeight: 1.5 }}>
                {coachReady ? "Bereit zu generieren — alles Wesentliche da." : "Fast fertig — prüfe die offenen Punkte."}
              </p>
              <div style={{ marginTop: 14 }}>
                <span className="studio-field-label" style={{ display: "block", marginBottom: 8 }}>
                  Anzahl Varianten
                </span>
                <MarketingCodePills
                  options={VARIANT_COUNT_OPTIONS}
                  value={String(variantCount) as `${VariantCount}`}
                  onChange={(code) => {
                    if (loading) return;
                    setVariantCount(Number(code) as VariantCount);
                  }}
                  P={P}
                />
              </div>
              <div style={{ marginTop: 14 }}>
                <span className="studio-field-label" style={{ display: "block", marginBottom: 8 }}>
                  Dein Wunsch (optional)
                </span>
                <textarea
                  className="studio-create-wish"
                  value={occasionNote}
                  maxLength={280}
                  rows={2}
                  disabled={loading}
                  placeholder="z. B. „mit Blick auf unseren Kirchturm“ oder „Etikett zur Kamera gedreht“"
                  onChange={(e) => setOccasionNote(e.target.value)}
                />
              </div>
              {effectiveEtikettModus === "marke" && (customReferenceDataUrl || profileEtikettUrl) ? (
                <div className="studio-create-label-lock">
                  <img src={customReferenceDataUrl || profileEtikettUrl} alt="" />
                  <div>
                    <strong>Etikett 1:1</strong>
                    <span>
                      {selectedBeer
                        ? `„${selectedBeer.name}“ — dieses Etikett wird unverändert ins Bild übernommen.`
                        : "Dieses Referenz-Etikett wird unverändert ins Bild übernommen."}
                    </span>
                  </div>
                </div>
              ) : null}
              <ul style={{ margin: "12px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                {coachChecks.map((item) => (
                  <li key={item.label} style={{ display: "flex", gap: 8, fontSize: 12.5, color: item.done ? P.ink2 : P.ink3 }}>
                    <span style={{ color: item.done ? STUDIO_TOKENS.amber2 : P.ink3 }}>{item.done ? "✓" : "○"}</span>
                    {item.label}
                  </li>
                ))}
              </ul>
              <p style={{ margin: "14px 0 0", fontFamily: STUDIO_TOKENS.mono, fontSize: 11, color: P.ink3 }}>
                {formatDeNumber(generationTokenCost)} Tokens · {tokensFreeLabel} frei
              </p>
              {error ? (
                <p style={{ margin: "10px 0 0", fontSize: 12, color: "#F5A8A8" }} role="alert">
                  {error}
                </p>
              ) : null}
              {loading && generationStep ? (
                <p style={{ margin: "10px 0 0", fontSize: 12, color: P.ink2 }}>{generationStep}</p>
              ) : null}
            </div>
          </div>
        );
      default:
        return null;
    }
  })();

  return (
    <>
      {!profileComplete && profileMode !== "skip" ? (
        <div
          style={{
            marginBottom: 16,
            padding: "14px 16px",
            borderRadius: 12,
            border: "1px solid rgba(199,105,30,0.25)",
            background: "rgba(244,216,180,0.45)",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontFamily: STUDIO_TOKENS.sans, fontWeight: 650, fontSize: 14, color: P.ink }}>Markenprofil empfohlen</div>
            <div style={{ marginTop: 4, fontFamily: STUDIO_TOKENS.sans, fontSize: 13, color: P.ink2 }}>
              Gib die Website deiner Brauerei ein — die KI erstellt Tonality, Farben und Bildregeln für konsistente Motive.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setBrandProfileSetupOpen(true)}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: "linear-gradient(135deg, #F2A35A 0%, #E66A2B 38%, #C13B1F 100%)",
              color: "#0A0807",
              fontFamily: STUDIO_TOKENS.sans,
              fontWeight: 650,
              fontSize: 13,
              border: "none",
              cursor: "pointer",
            }}
          >
            Markenprofil anlegen
          </button>
        </div>
      ) : null}

      {referenceImagesStale ? (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 16px",
            borderRadius: 12,
            border: "1px solid rgba(199,105,30,0.35)",
            background: "rgba(255,238,210,0.7)",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontFamily: STUDIO_TOKENS.sans, fontWeight: 650, fontSize: 13, color: P.ink }}>Referenzbilder veraltet</div>
            <div style={{ marginTop: 4, fontFamily: STUDIO_TOKENS.sans, fontSize: 12, color: P.ink2 }}>
              Lade neue Bilder im Markenprofil hoch oder nutze den manuellen Upload im Prompt-Flow.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setBrandProfileSetupOpen(true)}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              background: "transparent",
              color: P.ink,
              fontFamily: STUDIO_TOKENS.sans,
              fontWeight: 650,
              fontSize: 12,
              border: `1px solid ${P.ruleStrong}`,
              cursor: "pointer",
            }}
          >
            Referenzen aktualisieren
          </button>
        </div>
      ) : null}

      {flowMode === "start" ? (
        <InhalteErstellenStart
          P={P}
          breweryName={breweryName || initialBreweryName?.trim() || ""}
          selectedBeerId={selectedBeer?.id ?? null}
          onSelectBeer={applyBeer}
          onPickTemplate={applyTemplate}
          onPickCustom={startCustomWizard}
        />
      ) : (
      <MarketingPromptCreateShell
        P={P}
        brandMeta={brandMetaLine}
        promptStepLabel={String(microStepIndex + 1).padStart(2, "0")}
        promptSegments={promptSegments}
        segmentTargets={promptNav.targets}
        onSegmentClick={jumpToStep}
        showCursor={!isReviewStep || loading}
        questionTitle={
          currentMicroStepId === "schauplatz" && personenModus === "E"
            ? "Wo findet die Gruppenszene statt?"
            : currentMicroMeta.title
        }
        questionSubtitle={
          currentMicroStepId === "schauplatz" && personenModus === "E"
            ? "Ein Schauplatz — Kamerawinkel kommt aus der Gruppen-Dynamik."
            : currentMicroMeta.subtitle
        }
        aspectOptions={ASPECT_CHIP_OPTIONS}
        aspectValue={wofuer.aspectRatio}
        onAspectChange={handleAspectChange}
        estimatedLabel={`~${ESTIMATED_SECONDS}s`}
        primaryLabel={isReviewStep ? (loading ? "Generiere …" : "Generieren") : "Weiter"}
        primaryMode={isReviewStep ? "generate" : "next"}
        onPrimary={() => {
          if (isReviewStep) void generate();
          else goMicroNext();
        }}
        onBack={() => {
          if (hasGenerated || (isReviewStep && fromTemplate) || microStepIndex === 0) backToStart();
          else goMicroPrev();
        }}
        backLabel={hasGenerated || (isReviewStep && fromTemplate) ? "Zurück zur Auswahl" : "Zurück"}
        canBack={!loading}
        primaryDisabled={!canProceedMicro || (isReviewStep && loading)}
        loading={loading && isReviewStep}
        brandStyleActive={profileActive}
        brandName={breweryName || brandLabel}
        formatTag={formatTag}
        tokensLabel={tokensStatusLabel}
        variants={variantCards}
        onSelectVariant={(index) => {
          const src = variantCards[index]?.src;
          if (src) window.open(src, "_blank", "noopener,noreferrer");
        }}
      >
        {microStepContent}
      </MarketingPromptCreateShell>
      )}

      {flowMode === "wizard" && error && !isReviewStep ? (
        <p style={{ marginTop: 12, fontSize: 13, color: "#F5A8A8" }} role="alert">
          {error}
        </p>
      ) : null}

    <BrandProfileSetupModal
      open={brandProfileSetupOpen}
      onOpenChange={setBrandProfileSetupOpen}
      title="Marke einlesen"
      onSaved={applyBrandScanAndPersist}
    />
    </>
  );
}
