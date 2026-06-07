"use client";

/* eslint-disable @next/next/no-img-element */
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BrandProfileSetupModal, type BrandScanSuggestion } from "@/components/dashboard/BrandProfileSetupModal";
import { useStudioShell } from "@/components/studio/studio-workspace-shell";
import { StudioViewTransition } from "@/components/studio/studio-view-transition";
import {
  STUDIO_PAD_X,
  STUDIO_TOKENS,
  useStudioPalette,
  type StudioPalette,
} from "@/components/ui/dashboard-studio-shell";
import type { HyperrealisticInput } from "@/app/(dashboard)/inhalte-erstellen/lib/schemas";
import { calculateGenerationTokenCost } from "@/lib/billing/generationTokenCost";
import { hyperrealisticSchema } from "@/app/(dashboard)/inhalte-erstellen/lib/schemas";

type ImageResponse = { b64_json?: string; url?: string };

type WasOption = { label: string; bierstil: string; glasTyp: HyperrealisticInput["glasTyp"] };
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

const WAS_OPTIONS: WasOption[] = [
  { label: "Helles", bierstil: "helles", glasTyp: "willibecher" },
  { label: "Pils", bierstil: "pils", glasTyp: "pils_tulpe" },
  { label: "Hefeweizen", bierstil: "hefeweizen", glasTyp: "weizen" },
  { label: "Kristallweizen", bierstil: "kristallweizen", glasTyp: "weizen" },
  { label: "Märzen", bierstil: "maerzen", glasTyp: "masskrug" },
  { label: "Kellerbier", bierstil: "kellerbier", glasTyp: "willibecher" },
  { label: "Bock", bierstil: "bock", glasTyp: "masskrug" },
  { label: "Kölsch", bierstil: "koelsch", glasTyp: "stange" },
  { label: "Altbier", bierstil: "altbier", glasTyp: "stange" },
  { label: "IPA", bierstil: "ipa", glasTyp: "ipa_teku" },
  { label: "NEIPA / Hazy IPA", bierstil: "neipa", glasTyp: "ipa_teku" },
  { label: "Stout", bierstil: "stout", glasTyp: "schwenker" },
  { label: "Porter", bierstil: "porter", glasTyp: "schwenker" },
  { label: "Saison", bierstil: "saison", glasTyp: "ipa_teku" },
  { label: "Radler", bierstil: "radler", glasTyp: "willibecher" },
  { label: "Alkoholfrei", bierstil: "alkoholfrei_pilsner", glasTyp: "pils_tulpe" },
];

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

const FLASCHEN_OPTIONS: FlaschenOption[] = [
  { code: "euro_longneck_330", label: "Longneck 0,33 l" },
  { code: "euro_steinie_330", label: "Steinie 0,33 l" },
  { code: "nrw_500", label: "NRW 0,5 l" },
  { code: "vichy_500", label: "Euroflasche 0,5 l" },
  { code: "buegel_330", label: "Bügel 0,33 l" },
  { code: "buegel_500", label: "Bügel 0,5 l" },
];

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

const GRUPPEN_SETTING_OPTIONS: { code: NonNullable<HyperrealisticInput["gruppenSetting"]>; label: string }[] = [
  { code: "alpine_huette", label: "Alpine Hütte" },
  { code: "biergarten", label: "Biergarten" },
  { code: "berge_outdoor", label: "Berge Outdoor" },
  { code: "rooftop_urban", label: "Urban Rooftop" },
  { code: "strand", label: "Strand" },
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
  { code: "generisch", label: "Generisch", hint: "Unbranded — kein spezifisches Etikett" },
];

const EXTRA_OPTIONS = [
  "Kondens­tropfen",
  "Bokeh-Hintergrund",
  "Hopfen im Bild",
  "Wiesenblumen dezent",
  "Brezel · Snack-Beilage",
  "Wassertropfen am Glas",
];

const GENERATION_VARIANT_COUNT = 3;
// Realistische User-Erwartung: Kie/Banana liefert in der Praxis zwischen
// ~45s (gute Auslastung) und 2–3 min (Peak-Zeiten). Wir kommunizieren einen
// Bereich, damit die UI nicht früh wirkt, als sei etwas hängen geblieben.
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

/** Liest eine Datei, komprimiert auf max 1024×1024 und liefert eine JPEG-DataURL fuer den Upload. */
async function readAndCompressImage(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden."));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Bild konnte nicht dekodiert werden."));
    image.src = dataUrl;
  });

  const maxDim = 1024;
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const targetW = Math.max(1, Math.round(img.width * scale));
  const targetH = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas-Kontext fehlt.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, targetW, targetH);
  ctx.drawImage(img, 0, 0, targetW, targetH);
  return canvas.toDataURL("image/jpeg", 0.85);
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
  brandProfileMode = "skip",
}: {
  userEmail?: string;
  initialProfileName?: string;
  initialBreweryName?: string;
  brandProfileComplete?: boolean;
  brandProfileMode?: "undecided" | "guided" | "skip";
}) {
  const P = useStudioPalette();
  const router = useRouter();
  const { setBrandProfileActive, setContentPadding } = useStudioShell();
  const [brandProfileSetupOpen, setBrandProfileSetupOpen] = useState(false);
  const [profileComplete, setProfileComplete] = useState(brandProfileComplete);
  const [profileMode, setProfileMode] = useState(brandProfileMode);

  useEffect(() => {
    setProfileComplete(brandProfileComplete);
    setProfileMode(brandProfileMode);
  }, [brandProfileComplete, brandProfileMode]);

  useEffect(() => {
    setContentPadding(`32px ${STUDIO_PAD_X}px 96px`);
    return () => setContentPadding(undefined);
  }, [setContentPadding]);

  useEffect(() => {
    setBrandProfileActive(brandProfileSetupOpen);
  }, [brandProfileSetupOpen, setBrandProfileActive]);

  const applyBrandScanAndPersist = useCallback(async (suggestion: BrandScanSuggestion) => {
    setProfileComplete(true);
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
  const [gruppenSetting, setGruppenSetting] = useState<HyperrealisticInput["gruppenSetting"]>("biergarten");
  const [stimmungTrend, setStimmungTrend] = useState<NonNullable<HyperrealisticInput["stimmungTrend"]>>("nachhaltig");
  const [shotType, setShotType] = useState<NonNullable<HyperrealisticInput["shotType"]>>("A");
  const [kiPlattform, setKiPlattform] = useState<NonNullable<HyperrealisticInput["kiPlattform"]>>("gpt_image_2");
  const [etikettModus, setEtikettModus] = useState<NonNullable<HyperrealisticInput["etikettModus"]>>("marke");
  const [advancedOpen, setAdvancedOpen] = useState(false);

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
            brandReferenceImageUrls?: string[];
            brandReferenceImagesStale?: boolean;
          };
        };
        if (json.settings?.breweryName?.trim()) setBreweryName(json.settings.breweryName.trim());
        if (json.settings?.brandReferenceImagesStale) {
          setEtikettUrl("");
          setReferenceImagesStale(true);
        } else {
          const refs = json.settings?.brandReferenceImageUrls;
          if (Array.isArray(refs) && refs[0]) setEtikettUrl(refs[0]);
          setReferenceImagesStale(false);
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
  const hasReferenceImage = Boolean(customReferenceDataUrl || etikettUrl);
  const generationTokenCost = useMemo(() => {
    const hasRef = Boolean(customReferenceDataUrl || (etikettModus === "marke" && etikettUrl));
    const strictLabel = etikettModus === "marke" && hasRef;
    return calculateGenerationTokenCost({
      resolution: "2K",
      hasReferenceImage: hasRef,
      strictLabelMode: strictLabel,
      variantCount: GENERATION_VARIANT_COUNT,
    });
  }, [customReferenceDataUrl, etikettModus, etikettUrl]);
  const brandLinked = Boolean((breweryName || initialBreweryName?.trim()) && hasReferenceImage);
  const personenSetUp =
    personenModus === "A" ||
    personenModus === "B" ||
    personenModus === "C" ||
    (personenModus === "D" && Boolean(personGender && personAlter)) ||
    (personenModus === "E" && Boolean(gruppenDynamik && gruppenSetting));
  const etikettOK = etikettModus === "generisch" || hasReferenceImage;
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
          etikettModus === "marke"
            ? customReferenceDataUrl
              ? "Eigenes Referenzbild für diesen Run hochgeladen"
              : `Marken-Etikett ${brandLabel} verknüpft`
            : "Generisches Etikett — kein Markenbezug nötig",
      },
      { done: true, label: `Behälter gewählt: ${behaelterLabel}` },
      {
        done: personenSetUp,
        label:
          personenModus === "D"
            ? `Person mit Gesicht — Details ${personGender && personAlter ? "vollständig" : "fehlen"}`
            : personenModus === "E"
              ? `Gruppe — ${gruppenDynamik && gruppenSetting ? "Dynamik & Setting gesetzt" : "Dynamik/Setting fehlt"}`
              : `Personen-Modus: ${personenLabel}`,
      },
      { done: Boolean(stimmungTrend), label: `Trend-Stimmung: ${stimmungLabel}` },
      { done: Boolean(shotType), label: `Shot Type: ${SHOT_TYPE_OPTIONS.find((s) => s.code === shotType)?.label}` },
      { done: hasManyExtras, label: "3+ Extras = besonders charakteristische Bilder" },
    ],
    [
      etikettOK,
      etikettModus,
      brandLabel,
      behaelterLabel,
      personenSetUp,
      personenModus,
      personGender,
      personAlter,
      gruppenDynamik,
      gruppenSetting,
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

  // Wizard: Step-by-Step Flow durch alle Optionen.
  const [stepIndex, setStepIndex] = useState(0);
  const currentStepDef = WIZARD_STEPS[stepIndex] ?? WIZARD_STEPS[0];
  const isLastStep = stepIndex === WIZARD_STEPS.length - 1;
  const goToStep = useCallback((next: number) => {
    setStepIndex(Math.max(0, Math.min(WIZARD_STEPS.length - 1, next)));
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        document.getElementById("wizard-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, []);
  const goNext = useCallback(() => goToStep(stepIndex + 1), [goToStep, stepIndex]);
  const goPrev = useCallback(() => goToStep(stepIndex - 1), [goToStep, stepIndex]);

  async function persistMediaItem(item: {
    id: string;
    imageUrl: string;
    prompt: string;
    createdAt: string;
    aspectRatio: string;
    resolution: "1K" | "2K" | "4K";
    outputFormat: "png" | "jpg";
  }): Promise<void> {
    try {
      await fetch("/api/dashboard/media", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
    } catch (persistError) {
      console.warn("[inhalte-erstellen] media persist failed:", persistError);
    }
  }

  async function pollKieTask(taskId: string, signal: AbortSignal): Promise<string> {
    // Gesamt-Deadline: 6 Minuten (Kie kann je nach Modell/Auslastung deutlich länger
    // als die UI-Schätzung brauchen). Wir geben hier eher mehr Spielraum, statt
    // gut laufende Generierungen abzubrechen.
    const deadlineMs = Date.now() + 6 * 60 * 1000;

    // Adaptiver Delay: erste 30s schnell (2s), danach gemächlicher (3.5s),
    // um Rate-Limit-Druck zu reduzieren und trotzdem responsive zu wirken.
    const delayFor = (elapsedSec: number) => {
      if (elapsedSec < 30) return 2000;
      if (elapsedSec < 120) return 3500;
      return 5000;
    };

    // Bei transienten Fehlern (429/5xx/Netzwerk) nicht abbrechen, sondern
    // mit progressivem Backoff erneut versuchen. Erst nach mehreren Fehlern
    // in Folge oder Deadline aufgeben.
    let consecutiveTransientErrors = 0;
    const maxTransientInARow = 6;
    const startedAt = Date.now();

    while (Date.now() < deadlineMs) {
      if (signal.aborted) throw new Error("Generierung abgebrochen.");

      const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
      const waitMs = delayFor(elapsedSec) * (1 + consecutiveTransientErrors * 0.5);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      if (signal.aborted) throw new Error("Generierung abgebrochen.");

      let res: Response;
      try {
        res = await fetch(`/api/kie/nano-banana/task-status?taskId=${encodeURIComponent(taskId)}`, {
          cache: "no-store",
          signal,
        });
      } catch (networkError) {
        // Netzwerkfehler (z.B. Offline/Aborted) → transient behandeln,
        // ausser explizit vom User abgebrochen.
        if (signal.aborted) throw new Error("Generierung abgebrochen.");
        consecutiveTransientErrors += 1;
        if (consecutiveTransientErrors >= maxTransientInARow) {
          throw networkError instanceof Error
            ? networkError
            : new Error("Statusabfrage fehlgeschlagen (Netzwerk).");
        }
        continue;
      }

      // Rate-Limit oder Upstream-5xx → kurz warten und erneut versuchen.
      // Niemals hart abbrechen wegen transienten Fehlern.
      if (res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504) {
        consecutiveTransientErrors += 1;
        const retryAfterHeader = res.headers.get("Retry-After");
        const retryAfterMs = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) * 1000 : 0;
        if (Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, Math.min(retryAfterMs, 15_000)));
        }
        if (consecutiveTransientErrors >= maxTransientInARow) {
          throw new Error(`Statusabfrage wiederholt fehlgeschlagen (HTTP ${res.status}).`);
        }
        continue;
      }

      let data: { state?: string; imageUrl?: string | null; error?: string };
      try {
        data = (await res.json()) as typeof data;
      } catch {
        consecutiveTransientErrors += 1;
        if (consecutiveTransientErrors >= maxTransientInARow) {
          throw new Error("Statusabfrage unverständlich.");
        }
        continue;
      }

      if (!res.ok) {
        // Andere Client-Fehler (z.B. 400/401/403) sind echte Fehler — sofort abbrechen.
        throw new Error(data.error ?? "Statusabfrage fehlgeschlagen.");
      }

      // Erfolgreicher Status-Call → Zähler resetten.
      consecutiveTransientErrors = 0;

      const state = (data.state ?? "").toLowerCase();
      if (["success", "succeeded", "completed", "done"].includes(state) && data.imageUrl) {
        return data.imageUrl;
      }
      if (["failed", "error", "cancelled", "canceled"].includes(state)) {
        throw new Error("Kie hat die Generierung abgebrochen.");
      }

      // Noch laufend (oder unknown) — UI-Status aktualisieren.
      if (elapsedSec > 90) {
        setGenerationStep(`Noch in Arbeit (~${elapsedSec}s) — Kie braucht heute etwas länger …`);
      } else if (elapsedSec > 50) {
        setGenerationStep(`Generiert (~${elapsedSec}s) — bitte noch einen Moment …`);
      } else {
        setGenerationStep(`Generiert (~${elapsedSec}s) …`);
      }
    }
    throw new Error("Generierung dauert ungewoehnlich lange — bitte spaeter erneut versuchen.");
  }

  async function generate() {
    setLoading(true);
    setError("");
    setImages([]);
    setGenerationStep("Brief wird verarbeitet …");
    // Sicherstellen, dass der User auf dem Review-Step ist (wo das Resultat-Grid sichtbar ist).
    setStepIndex(WIZARD_STEPS.length - 1);
    const controller = new AbortController();
    try {
      // Vorrang: Ad-hoc-Upload > Markenprofil-Etikett.
      const effectiveEtikett =
        customReferenceDataUrl ||
        (etikettModus === "marke"
          ? etikettUrl
          : etikettUrl || "https://example.com/placeholder.png");

      if (etikettModus === "marke" && !effectiveEtikett) {
        throw new Error(
          "Bitte lade ein Referenzbild hoch (Slot oben) oder verknuepfe ein Markenprofil — oder wechsle auf „Generisch“ in Advanced.",
        );
      }

      const zusatzWunsch = extras.length ? extras.join(", ") : undefined;
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
        gruppenSetting: personenModus === "E" ? gruppenSetting : undefined,
        tageszeit: wie.tageszeit,
        stimmungTrend,
        stimmung: "gesellig",
        shotType,
        kiPlattform,
        etikettModus,
        zusatzWunsch,
        aspectRatio: wofuer.aspectRatio,
        quality: "high",
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
      setGenerationStep("Sende Brief an Kie.ai …");
      const res = await fetch("/api/inhalte-erstellen/create-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const data = (await res.json()) as {
        error?: string;
        taskId?: string;
        taskIds?: string[];
        variantCount?: number;
        partial?: boolean;
        partialErrors?: string[];
        prompt?: string;
        billing?: {
          freeTrial?: boolean;
          consumed?: number;
          remainingTokens?: number;
        };
      };
      const taskIds: string[] = Array.isArray(data.taskIds) && data.taskIds.length > 0
        ? data.taskIds
        : data.taskId
          ? [data.taskId]
          : [];
      if (!res.ok || taskIds.length === 0) {
        throw new Error(data.error ?? "Task-Erstellung fehlgeschlagen.");
      }

      if (typeof data.billing?.remainingTokens === "number") {
        setTokensRemaining(data.billing.remainingTokens);
        window.dispatchEvent(new CustomEvent("evglab-billing-updated"));
      } else if (data.billing?.freeTrial) {
        setTokensRemaining(0);
        window.dispatchEvent(new CustomEvent("evglab-billing-updated"));
      }

      // Progressives Befuellen: jede Variante erscheint, sobald sie fertig ist.
      // Reihenfolge stabil via Index → wir reservieren erst Slots mit Placeholders.
      const initialSlots: ImageResponse[] = taskIds.map(() => ({}));
      setImages(initialSlots);
      const totalVariants = taskIds.length;
      let completedCount = 0;
      setGenerationStep(`Generiere ${totalVariants} Varianten …`);

      const mediaPromptLabel = (() => {
        const base = `${was.label} · ${behaelterLabel} · ${wo.label} · ${wie.label}`.slice(0, 200);
        return base.trim().length > 0 ? base : "EvGlab-Motiv";
      })();
      const mediaResolution: "1K" | "2K" =
        parsed.quality === "high" ? "2K" : "1K";

      const polls = taskIds.map(async (taskId, index) => {
        try {
          const imageUrl = await pollKieTask(taskId, controller.signal);
          setImages((prev) => {
            const next = [...prev];
            next[index] = { url: imageUrl };
            return next;
          });
          completedCount += 1;
          setGenerationStep(`${completedCount} von ${totalVariants} Varianten fertig …`);
          void persistMediaItem({
            id: `${taskId}-${index}`,
            imageUrl,
            prompt: mediaPromptLabel,
            createdAt: new Date().toISOString(),
            aspectRatio: parsed.aspectRatio,
            resolution: mediaResolution,
            outputFormat: imageUrl.toLowerCase().endsWith(".jpg") || imageUrl.toLowerCase().endsWith(".jpeg") ? "jpg" : "png",
          });
          return { ok: true as const, index };
        } catch (e) {
          completedCount += 1;
          setGenerationStep(`${completedCount} von ${totalVariants} Varianten fertig …`);
          return { ok: false as const, index, error: e instanceof Error ? e.message : "Unbekannter Fehler." };
        }
      });
      const results = await Promise.all(polls);
      const successCount = results.filter((r) => r.ok).length;
      const failures = results.filter((r) => !r.ok);

      // Leere Slots (Failures) am Ende entfernen, damit das Grid sauber bleibt.
      setImages((prev) => prev.filter((img) => Boolean(img.url || img.b64_json)));

      if (successCount === 0) {
        throw new Error(
          failures[0] && !failures[0].ok ? failures[0].error : "Keine Variante konnte generiert werden.",
        );
      }
      if (failures.length > 0) {
        setError(
          `${successCount} von ${totalVariants} Varianten erfolgreich. Restliche fehlgeschlagen — bitte ggf. erneut versuchen.`,
        );
      } else if (data.partial && data.partialErrors && data.partialErrors.length > 0) {
        setError(
          `Nur ${totalVariants} Variante(n) erstellt — manche Tasks bei Kie wurden abgelehnt.`,
        );
      }
      setGenerationStep("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generierung fehlgeschlagen.");
      setGenerationStep("");
    } finally {
      setLoading(false);
    }
  }

  const pad = STUDIO_PAD_X;
  const tokensFreeLabel =
    tokensRemaining !== null ? formatDeNumber(tokensRemaining) : "—";

  return (
    <>
      <div style={{ width: "100%", maxWidth: "none" }}>
        <Eyebrow P={P} className="studio-create-eyebrow">
          EvGlab · Studio · Brief-Modus · Kalenderwoche {getCalendarWeek()} · {todayLine} · Modell v2.4 · GPU-Pool DE-Süd
        </Eyebrow>

        {!profileComplete && profileMode !== "skip" ? (
          <div
            style={{
              marginTop: 20,
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
              <div style={{ fontFamily: STUDIO_TOKENS.sans, fontWeight: 650, fontSize: 14, color: P.ink }}>
                Markenprofil empfohlen
              </div>
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
                boxShadow: "0 10px 24px -10px rgba(230,106,43,0.55), inset 0 1px 0 rgba(255,255,255,0.18)",
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
              marginTop: 12,
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
              <div style={{ fontFamily: STUDIO_TOKENS.sans, fontWeight: 650, fontSize: 13, color: P.ink }}>
                Referenzbilder veraltet
              </div>
              <div style={{ marginTop: 4, fontFamily: STUDIO_TOKENS.sans, fontSize: 12, color: P.ink2 }}>
                Deine alten Referenzbilder sind nicht mehr verfügbar. Lade neue Bilder im Markenprofil hoch oder nutze
                einmalig den manuellen Upload weiter unten.
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

        <header style={{ marginTop: 32, marginBottom: 22, maxWidth: 780 }}>
          <div
            style={{
              fontFamily: STUDIO_TOKENS.mono,
              fontSize: 11,
              letterSpacing: 1.4,
              textTransform: "uppercase",
              color: P.ink3,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 14,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 999, background: STUDIO_TOKENS.amber, display: "inline-block", boxShadow: `0 0 12px ${STUDIO_TOKENS.amber}` }} />
            Inhalte erstellen · {brandLabel}
          </div>
          <h1
            style={{
              fontFamily: STUDIO_TOKENS.sans,
              fontSize: "clamp(2.4rem, 4.2vw, 3.6rem)",
              fontWeight: 700,
              letterSpacing: -2,
              lineHeight: 1.02,
              margin: 0,
            }}
          >
            Was zeigen wir{" "}
            <em
              style={{
                fontFamily: STUDIO_TOKENS.accentSerif,
                fontStyle: "italic",
                fontWeight: 500,
                background: STUDIO_TOKENS.gradientBrand,
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              heute
            </em>
            ?
          </h1>
          <p style={{ marginTop: 16, fontSize: 15.5, lineHeight: 1.6, color: P.ink2, maxWidth: 660 }}>
            Wähle Motiv, Schauplatz und Format — wir bauen daraus einen präzisen Brief für {brandLabel} und generieren drei
            Varianten im Markenstil.
          </p>
        </header>

        {/* Step-Indikator als Progress-Track */}
        <div style={{ marginTop: 8, marginBottom: 22 }}>
          <div
            className="studio-create-wizard"
            style={{
              gridTemplateColumns: `repeat(${WIZARD_STEPS.length}, minmax(0, 1fr))`,
            }}
          >
            {/* Verbindungslinie hinten */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                top: 18,
                left: `calc(100% / ${WIZARD_STEPS.length * 2})`,
                right: `calc(100% / ${WIZARD_STEPS.length * 2})`,
                height: 2,
                background: "rgba(245,237,223,0.08)",
                borderRadius: 999,
              }}
            />
            {/* Progress-Linie */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                top: 18,
                left: `calc(100% / ${WIZARD_STEPS.length * 2})`,
                width:
                  stepIndex > 0
                    ? `calc((100% - (200% / ${WIZARD_STEPS.length})) * ${stepIndex} / ${WIZARD_STEPS.length - 1})`
                    : 0,
                height: 2,
                background: STUDIO_TOKENS.gradientBrand,
                borderRadius: 999,
                boxShadow: "0 0 10px rgba(230,106,43,0.45)",
                transition: "width .35s cubic-bezier(.4,0,.2,1)",
              }}
            />
            {WIZARD_STEPS.map((s, i) => {
              const done = i < stepIndex;
              const active = i === stepIndex;
              const label = s.title.split(" ")[0].replace("?", "").replace(",", "");
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => goToStep(i)}
                  aria-current={active ? "step" : undefined}
                  style={{
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                    padding: "0 4px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: STUDIO_TOKENS.sans,
                  }}
                >
                  <span
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 999,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: STUDIO_TOKENS.mono,
                      fontSize: 12,
                      fontWeight: 600,
                      letterSpacing: 0.5,
                      background: active
                        ? STUDIO_TOKENS.gradientBrand
                        : done
                          ? "rgba(230,106,43,0.18)"
                          : "rgba(245,237,223,0.04)",
                      color: active ? "#0A0807" : done ? STUDIO_TOKENS.amber2 : P.ink3,
                      border: `1px solid ${active ? "transparent" : done ? "rgba(230,106,43,0.35)" : "rgba(245,237,223,0.10)"}`,
                      boxShadow: active
                        ? "0 8px 22px -8px rgba(230,106,43,0.65), inset 0 1px 0 rgba(255,255,255,0.2)"
                        : "none",
                      transition: "all .25s ease",
                      transform: active ? "scale(1.05)" : "scale(1)",
                    }}
                  >
                    {done ? (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                        <path d="M3 7 L6 10 L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      s.index
                    )}
                  </span>
                  <span
                    className="studio-create-wizard-label"
                    style={{
                      fontSize: 11.5,
                      fontWeight: active ? 650 : 500,
                      color: active ? P.ink : done ? P.ink2 : P.ink3,
                      letterSpacing: 0.1,
                      whiteSpace: "nowrap",
                      transition: "color .2s ease",
                    }}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Wizard-Karte */}
        <div
          id="wizard-card"
          style={{
            background:
              currentStepDef.id === "review"
                ? "linear-gradient(180deg, #1B1714 0%, #13100D 100%)"
                : "linear-gradient(180deg, rgba(245,237,223,0.04) 0%, rgba(245,237,223,0.01) 100%)",
            color: P.ink,
            borderRadius: 18,
            border: `1px solid ${P.rule}`,
            padding: "30px 30px 24px",
            boxShadow: "0 1px 0 rgba(245,237,223,0.04), 0 24px 60px -30px rgba(0,0,0,0.7)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Gradient-Top-Strip */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 1,
              background: STUDIO_TOKENS.gradientBrand,
              opacity: 0.55,
            }}
          />
          {/* Subtle background glow */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: -80,
              right: -60,
              width: 320,
              height: 320,
              background: "radial-gradient(circle, rgba(230,106,43,0.10) 0%, transparent 60%)",
              pointerEvents: "none",
            }}
          />
          <StudioViewTransition viewKey={currentStepDef.id} variant="tab">
          {/* Step-Header (PROMPT · 0X) */}
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 16,
              marginBottom: 22,
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: STUDIO_TOKENS.mono,
                  fontSize: 10,
                  letterSpacing: 1.4,
                  textTransform: "uppercase",
                  color: P.ink3,
                  marginBottom: 8,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontFamily: STUDIO_TOKENS.accentSerif,
                    background: STUDIO_TOKENS.gradientBrand,
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                    fontWeight: 700,
                  }}
                >
                  Prompt · {currentStepDef.index}
                </span>
              </div>
              <div
                style={{
                  fontFamily: STUDIO_TOKENS.sans,
                  fontSize: "clamp(1.5rem, 2.6vw, 2.1rem)",
                  fontWeight: 700,
                  letterSpacing: -0.6,
                  lineHeight: 1.15,
                  color: P.ink,
                }}
              >
                {currentStepDef.title}
              </div>
              <p
                style={{
                  margin: "10px 0 0",
                  fontFamily: STUDIO_TOKENS.sans,
                  fontSize: 13.5,
                  lineHeight: 1.55,
                  color: P.ink2,
                }}
              >
                {currentStepDef.subtitle}
              </p>
            </div>
            <div
              style={{
                fontFamily: STUDIO_TOKENS.mono,
                fontSize: 10,
                letterSpacing: 1,
                color: P.ink3,
                whiteSpace: "nowrap",
                padding: "6px 10px",
                borderRadius: 999,
                border: `1px solid ${P.rule}`,
                background: "rgba(245,237,223,0.03)",
              }}
            >
              {stepIndex + 1} / {WIZARD_STEPS.length}
            </div>
          </div>

          {/* === STEP 01 · MOTIV === */}
          {currentStepDef.id === "motiv" ? (
            <div>
              <PillRow rowLabel="Bierstil" options={WAS_OPTIONS} selected={was} onSelect={setWas} P={P} />
              <CodePillRow
                rowLabel="Behälter"
                rowHint="Was soll im Bild sein?"
                options={BEHAELTER_OPTIONS}
                value={behaelter}
                onChange={setBehaelter}
                P={P}
              />
              {behaelter !== "G" ? (
                <>
                  <SubPillRow
                    rowLabel="Flaschentyp"
                    options={FLASCHEN_OPTIONS}
                    value={flaschenTyp}
                    onChange={(c) => setFlaschenTyp(c as HyperrealisticInput["flaschenTyp"])}
                    P={P}
                  />
                  <SubPillRow
                    rowLabel="Flaschenfarbe"
                    options={[
                      { code: "braun" as const, label: "Braun" },
                      { code: "gruen" as const, label: "Grün" },
                      { code: "klar" as const, label: "Klar" },
                    ]}
                    value={flaschenfarbe}
                    onChange={(c) => setFlaschenfarbe(c as HyperrealisticInput["flaschenfarbe"])}
                    P={P}
                  />
                </>
              ) : null}
            </div>
          ) : null}

          {/* === STEP 02 · SCHAUPLATZ === */}
          {currentStepDef.id === "schauplatz" ? (
            <PillRow rowLabel="Schauplatz" options={WO_OPTIONS} selected={wo} onSelect={setWo} P={P} />
          ) : null}

          {/* === STEP 03 · PERSONEN === */}
          {currentStepDef.id === "personen" ? (
            <div>
              <CodePillRow
                rowLabel="Modus"
                rowHint="Mit Mensch, ohne, oder Solo-Produktbild?"
                options={PERSONEN_OPTIONS}
                value={personenModus}
                onChange={setPersonenModus}
                P={P}
              />
              {personenModus === "D" ? (
                <>
                  <SubPillRow
                    rowLabel="Geschlecht"
                    options={PERSON_GENDER_OPTIONS}
                    value={personGender}
                    onChange={(c) => setPersonGender(c)}
                    P={P}
                  />
                  <SubPillRow
                    rowLabel="Alter"
                    options={PERSON_ALTER_OPTIONS}
                    value={personAlter}
                    onChange={(c) => setPersonAlter(c)}
                    P={P}
                  />
                  <SubPillRow
                    rowLabel="Körperanteil"
                    options={PERSON_KOERPER_OPTIONS}
                    value={personKoerper}
                    onChange={(c) => setPersonKoerper(c)}
                    P={P}
                  />
                  <SubPillRow
                    rowLabel="Stimmung"
                    options={PERSON_MOOD_OPTIONS}
                    value={personMood}
                    onChange={(c) => setPersonMood(c)}
                    P={P}
                  />
                </>
              ) : null}
              {personenModus === "E" ? (
                <>
                  <SubPillRow
                    rowLabel="Gruppengröße"
                    options={GRUPPEN_ANZAHL_OPTIONS}
                    value={gruppenAnzahl}
                    onChange={(c) => setGruppenAnzahl(c)}
                    P={P}
                  />
                  <SubPillRow
                    rowLabel="Gruppentyp"
                    options={GRUPPEN_TYP_OPTIONS}
                    value={gruppenTyp}
                    onChange={(c) => setGruppenTyp(c)}
                    P={P}
                  />
                  <SubPillRow
                    rowLabel="Dynamik"
                    options={GRUPPEN_DYNAMIK_OPTIONS}
                    value={gruppenDynamik}
                    onChange={(c) => setGruppenDynamik(c)}
                    P={P}
                  />
                  <SubPillRow
                    rowLabel="Setting"
                    options={GRUPPEN_SETTING_OPTIONS}
                    value={gruppenSetting}
                    onChange={(c) => setGruppenSetting(c)}
                    P={P}
                  />
                </>
              ) : null}
            </div>
          ) : null}

          {/* === STEP 04 · STIMMUNG & LICHT === */}
          {currentStepDef.id === "stimmung" ? (
            <div>
              <CodePillRow
                rowLabel="Stimmung"
                rowHint="Trend-Profil aus dem Skill"
                options={STIMMUNG_OPTIONS}
                value={stimmungTrend}
                onChange={setStimmungTrend}
                P={P}
              />
              <PillRow rowLabel="Tageslicht" options={WIE_OPTIONS} selected={wie} onSelect={setWie} P={P} />
              <CodePillRow
                rowLabel="Shot Type"
                rowHint="Bildausschnitt & Kamerawinkel"
                options={SHOT_TYPE_OPTIONS}
                value={shotType}
                onChange={setShotType}
                P={P}
              />
            </div>
          ) : null}

          {/* === STEP 05 · FORMAT, MARKE, EXTRAS === */}
          {currentStepDef.id === "format" ? (
            <div>
              <PillRow rowLabel="Format" options={WOFUER_OPTIONS} selected={wofuer} onSelect={setWofuer} P={P} />

              {/* Referenzbild-Slot */}
              <div
                className="studio-create-preview-grid"
                style={{
                  marginTop: 22,
                  padding: "18px 20px",
                  border: customReferenceDataUrl
                    ? "1px solid rgba(230,106,43,0.45)"
                    : `1px dashed ${P.ruleStrong}`,
                  borderRadius: 16,
                  background: customReferenceDataUrl
                    ? "linear-gradient(135deg, rgba(242,163,90,0.10) 0%, rgba(230,106,43,0.04) 100%)"
                    : "rgba(245,237,223,0.02)",
                  boxShadow: customReferenceDataUrl
                    ? "0 0 0 3px rgba(230,106,43,0.06), 0 12px 30px -16px rgba(230,106,43,0.4)"
                    : "none",
                  transition: "all .25s ease",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {customReferenceDataUrl ? (
                  <div
                    aria-hidden
                    style={{
                      position: "absolute",
                      top: -40,
                      right: -40,
                      width: 160,
                      height: 160,
                      background: "radial-gradient(circle, rgba(230,106,43,0.18) 0%, transparent 65%)",
                      pointerEvents: "none",
                    }}
                  />
                ) : null}
                <div>
                  <div
                    style={{
                      fontFamily: STUDIO_TOKENS.mono,
                      fontSize: 10,
                      letterSpacing: 1.1,
                      textTransform: "uppercase",
                      color: P.ink3,
                      marginBottom: 6,
                    }}
                  >
                    Referenzbild · optional
                  </div>
                  <div style={{ fontFamily: STUDIO_TOKENS.sans, fontSize: 13, color: P.ink2, lineHeight: 1.5 }}>
                    {customReferenceDataUrl ? (
                      <>
                        <strong style={{ color: P.ink }}>{customReferenceName || "Hochgeladenes Bild"}</strong> wird fuer diesen Run als
                        Etikett-/Stil-Referenz genutzt (ueberschreibt das Markenprofil-Etikett).
                      </>
                    ) : etikettUrl ? (
                      <>
                        Markenprofil-Etikett ist verknuepft. Optional kannst du hier eine{" "}
                        <em>spezifische</em> Flasche, ein anderes Etikett oder ein Stil-Referenzbild
                        hochladen — nur fuer diesen Run.
                      </>
                    ) : (
                      <>
                        Kein Markenprofil-Etikett gefunden. Lade hier ein Referenzbild hoch oder wechsle auf{" "}
                        <em>Generisch</em> in Advanced.
                      </>
                    )}
                  </div>
                  {uploadError ? (
                    <div style={{ marginTop: 8, fontSize: 12, color: "#B83A2A", fontFamily: STUDIO_TOKENS.sans }}>{uploadError}</div>
                  ) : null}
                  <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <label
                      className={uploading ? undefined : "evg-pill"}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "9px 14px",
                        borderRadius: 999,
                        border: customReferenceDataUrl
                          ? "1px solid rgba(230,106,43,0.55)"
                          : `1px solid ${P.ruleStrong}`,
                        background: customReferenceDataUrl
                          ? "linear-gradient(135deg, rgba(242,163,90,0.18) 0%, rgba(230,106,43,0.14) 100%)"
                          : "rgba(245,237,223,0.04)",
                        color: customReferenceDataUrl ? P.ink : P.ink2,
                        fontFamily: STUDIO_TOKENS.sans,
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: uploading ? "wait" : "pointer",
                        opacity: uploading ? 0.6 : 1,
                        transition: "all .18s ease",
                      }}
                    >
                      {uploading ? (
                        <>
                          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true" style={{ animation: "spin 1.1s linear infinite" }}>
                            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.8" strokeOpacity="0.25" />
                            <path d="M12 7 A5 5 0 0 0 7 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          </svg>
                          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                          Komprimiere …
                        </>
                      ) : (
                        <>
                          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M7 3 V11 M3 7 H11" />
                          </svg>
                          {customReferenceDataUrl ? "Anderes Bild wählen" : "Bild hochladen"}
                        </>
                      )}
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
                      <button
                        type="button"
                        onClick={clearCustomReference}
                        className="evg-pill"
                        style={{
                          padding: "9px 14px",
                          borderRadius: 999,
                          border: `1px solid ${P.rule}`,
                          background: "rgba(245,237,223,0.03)",
                          color: P.ink3,
                          fontFamily: STUDIO_TOKENS.sans,
                          fontSize: 12.5,
                          fontWeight: 500,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                          <path d="M3 3 L9 9 M9 3 L3 9" />
                        </svg>
                        Zurücksetzen
                      </button>
                    ) : null}
                  </div>
                </div>
                <div
                  style={{
                    width: 108,
                    height: 108,
                    borderRadius: 14,
                    padding: customReferenceDataUrl ? 2 : 0,
                    background: customReferenceDataUrl ? STUDIO_TOKENS.gradientBrand : "transparent",
                    boxShadow: customReferenceDataUrl
                      ? "0 12px 28px -12px rgba(230,106,43,0.55)"
                      : "none",
                    transition: "all .25s ease",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      borderRadius: customReferenceDataUrl ? 12 : 14,
                      border: customReferenceDataUrl ? "none" : `1px solid ${P.rule}`,
                      background: P.surface2,
                      overflow: "hidden",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: STUDIO_TOKENS.mono,
                      fontSize: 9,
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      color: P.ink3,
                    }}
                  >
                    {customReferenceDataUrl ? (
                      <img
                        src={customReferenceDataUrl}
                        alt="Referenzbild Vorschau"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : etikettUrl ? (
                      <img
                        src={etikettUrl}
                        alt="Markenprofil Vorschau"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ opacity: 0.4 }}>
                          <rect x="3" y="4" width="16" height="14" rx="2" />
                          <path d="M3 14 L7 10 L11 14 L14 11 L19 16" />
                          <circle cx="14" cy="8" r="1.5" />
                        </svg>
                        <span>Kein Bild</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Extras */}
              <div style={{ paddingTop: 20 }}>
                <div
                  style={{
                    fontFamily: STUDIO_TOKENS.mono,
                    fontSize: 10,
                    letterSpacing: 1.1,
                    textTransform: "uppercase",
                    color: P.ink3,
                    marginBottom: 10,
                  }}
                >
                  Extras · optional
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {EXTRA_OPTIONS.map((label) => {
                    const on = extras.includes(label);
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => toggleExtra(label)}
                        className={on ? "evg-pill evg-pill-active" : "evg-pill"}
                        style={{
                          padding: "9px 14px",
                          borderRadius: 999,
                          border: on
                            ? "1px solid rgba(230,106,43,0.55)"
                            : "1px dashed rgba(245,237,223,0.16)",
                          background: on
                            ? "linear-gradient(135deg, rgba(242,163,90,0.16) 0%, rgba(230,106,43,0.10) 100%)"
                            : "transparent",
                          color: on ? STUDIO_TOKENS.amber2 : P.ink2,
                          fontFamily: STUDIO_TOKENS.sans,
                          fontSize: 13,
                          fontWeight: on ? 600 : 500,
                          cursor: "pointer",
                          transition: "all .18s ease",
                          boxShadow: on ? "0 3px 12px -4px rgba(230,106,43,0.45)" : "none",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        {on ? (
                          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M2.5 6 L5 8.5 L9.5 3.5" />
                          </svg>
                        ) : (
                          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                            <path d="M6 2.5 V9.5 M2.5 6 H9.5" />
                          </svg>
                        )}
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Advanced */}
              <div style={{ paddingTop: 16 }}>
                <button
                  type="button"
                  onClick={() => setAdvancedOpen((v) => !v)}
                  style={{
                    padding: "6px 0",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: P.ink3,
                    fontFamily: STUDIO_TOKENS.mono,
                    fontSize: 10,
                    letterSpacing: 1.1,
                    textTransform: "uppercase",
                  }}
                >
                  {advancedOpen ? "− Advanced ausblenden" : "+ Advanced: Etikett-Modus, KI-Plattform"}
                </button>
                {advancedOpen ? (
                  <div style={{ marginTop: 4 }}>
                    <CodePillRow
                      rowLabel="Etikett-Modus"
                      rowHint="Mit Markenbezug oder generisch?"
                      options={ETIKETT_MODUS_OPTIONS}
                      value={etikettModus}
                      onChange={setEtikettModus}
                      P={P}
                    />
                    <CodePillRow
                      rowLabel="KI-Plattform"
                      rowHint="Ziel-Bildmodell für den Prompt"
                      options={KI_PLATTFORM_OPTIONS}
                      value={kiPlattform}
                      onChange={setKiPlattform}
                      P={P}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* === STEP 06 · REVIEW + GENERIEREN (Mockup-Look, dark) === */}
          {currentStepDef.id === "review" ? (
            <div>
              {/* Prompt-Block im Chat-Style */}
              <div
                style={{
                  position: "relative",
                  padding: "22px 24px",
                  borderRadius: 14,
                  border: "1px solid rgba(245,237,223,0.08)",
                  background: "linear-gradient(180deg, rgba(245,237,223,0.04) 0%, rgba(245,237,223,0.01) 100%)",
                  overflow: "hidden",
                }}
              >
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 1,
                    background: STUDIO_TOKENS.gradientBrand,
                    opacity: 0.5,
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    marginBottom: 14,
                  }}
                >
                  <div
                    style={{
                      fontFamily: STUDIO_TOKENS.mono,
                      fontSize: 10,
                      letterSpacing: 1.4,
                      textTransform: "uppercase",
                      color: P.ink3,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        background: STUDIO_TOKENS.gradientBrand,
                        WebkitBackgroundClip: "text",
                        backgroundClip: "text",
                        color: "transparent",
                        fontWeight: 700,
                      }}
                    >
                      Brief
                    </span>
                    <span style={{ opacity: 0.5 }}>·</span>
                    {breweryName || brandLabel}
                  </div>
                  <div
                    style={{
                      fontFamily: STUDIO_TOKENS.mono,
                      fontSize: 10,
                      letterSpacing: 0.8,
                      color: P.ink3,
                      padding: "4px 9px",
                      borderRadius: 999,
                      border: `1px solid ${P.rule}`,
                      background: "rgba(245,237,223,0.02)",
                    }}
                  >
                    {ESTIMATED_SECONDS}–{ESTIMATED_SECONDS_MAX}s
                  </div>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontFamily: STUDIO_TOKENS.sans,
                    fontSize: 20.5,
                    lineHeight: 1.5,
                    color: P.ink,
                    letterSpacing: -0.3,
                  }}
                >
                  {briefSentence}
                </p>
                {/* Aspect-Ratio-Tabs */}
                <div style={{ marginTop: 18, display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {WOFUER_OPTIONS.map((opt) => {
                    const active = wofuer.label === opt.label;
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => setWofuer(opt)}
                        className={active ? "evg-pill evg-pill-active" : "evg-pill"}
                        style={{
                          padding: "7px 13px",
                          borderRadius: 8,
                          border: `1px solid ${active ? "rgba(230,106,43,0.55)" : "rgba(245,237,223,0.10)"}`,
                          background: active
                            ? "linear-gradient(135deg, rgba(242,163,90,0.18) 0%, rgba(230,106,43,0.12) 100%)"
                            : "rgba(245,237,223,0.03)",
                          color: active ? P.ink : P.ink2,
                          fontFamily: STUDIO_TOKENS.mono,
                          fontSize: 12,
                          fontWeight: 600,
                          letterSpacing: 0.4,
                          cursor: "pointer",
                          transition: "all .18s ease",
                          boxShadow: active ? "0 3px 12px -4px rgba(230,106,43,0.45)" : "none",
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Coach + Generate-Row */}
              <div className="studio-create-coach-grid">
                {/* Coach (auf dark) */}
                <div
                  className="studio-create-coach-panel"
                  style={{
                    padding: "22px 24px",
                    borderRadius: 14,
                    border: `1px solid ${P.rule}`,
                    background: "linear-gradient(180deg, rgba(245,237,223,0.03) 0%, rgba(245,237,223,0.01) 100%)",
                  }}
                >
                  <CoachGauge score={coachScore} P={P} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: STUDIO_TOKENS.mono,
                        fontSize: 10,
                        letterSpacing: 1.1,
                        textTransform: "uppercase",
                        color: "rgba(244,239,230,0.55)",
                      }}
                    >
                      Coach
                    </div>
                    <div
                      style={{
                        fontFamily: STUDIO_TOKENS.sans,
                        fontSize: 24,
                        fontWeight: 700,
                        letterSpacing: -0.3,
                        marginTop: 4,
                        lineHeight: 1.15,
                      }}
                    >
                      {coachLabel}
                    </div>
                    <p
                      style={{
                        margin: "8px 0 0",
                        fontSize: 13,
                        lineHeight: 1.5,
                        color: "rgba(244,239,230,0.7)",
                      }}
                    >
                      {coachReady
                        ? "Bereit zu generieren — alles Wesentliche da."
                        : "Fast fertig — prüfe die offenen Punkte unten."}
                    </p>
                    <ul
                      style={{
                        margin: "12px 0 0",
                        padding: 0,
                        listStyle: "none",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      {coachChecks.map((item) => (
                        <li
                          key={item.label}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            fontSize: 12.5,
                            color: item.done ? P.ink2 : P.ink3,
                            lineHeight: 1.4,
                          }}
                        >
                          <span
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: 999,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              background: item.done
                                ? "linear-gradient(135deg, rgba(242,163,90,0.25) 0%, rgba(230,106,43,0.18) 100%)"
                                : "rgba(245,237,223,0.04)",
                              border: item.done ? "1px solid rgba(230,106,43,0.45)" : `1px solid ${P.rule}`,
                              flex: "0 0 auto",
                              boxShadow: item.done ? "0 0 8px rgba(230,106,43,0.30)" : "none",
                            }}
                          >
                            {item.done ? (
                              <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke={STUDIO_TOKENS.amber2} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M2.5 6 L5 8.5 L9.5 3.5" />
                              </svg>
                            ) : null}
                          </span>
                          <span>{item.label}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Generate-Karte */}
                <div
                  style={{
                    position: "relative",
                    padding: "24px 24px 22px",
                    borderRadius: 14,
                    background:
                      "linear-gradient(180deg, rgba(242,163,90,0.06) 0%, rgba(245,237,223,0.02) 100%)",
                    border: "1px solid rgba(230,106,43,0.18)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    minHeight: 240,
                    overflow: "hidden",
                    boxShadow: "0 24px 60px -30px rgba(230,106,43,0.4)",
                  }}
                >
                  <div
                    aria-hidden
                    style={{
                      position: "absolute",
                      top: -60,
                      right: -60,
                      width: 200,
                      height: 200,
                      background: "radial-gradient(circle, rgba(230,106,43,0.20) 0%, transparent 60%)",
                      pointerEvents: "none",
                    }}
                  />
                  <div style={{ position: "relative" }}>
                    <div
                      style={{
                        fontFamily: STUDIO_TOKENS.mono,
                        fontSize: 10,
                        letterSpacing: 1.4,
                        textTransform: "uppercase",
                        color: P.ink3,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 999,
                          background: STUDIO_TOKENS.amber,
                          boxShadow: `0 0 10px ${STUDIO_TOKENS.amber}`,
                        }}
                      />
                      Bereit
                    </div>
                    <div
                      style={{
                        fontFamily: STUDIO_TOKENS.sans,
                        fontSize: 22,
                        fontWeight: 700,
                        marginTop: 10,
                        lineHeight: 1.2,
                        letterSpacing: -0.5,
                        color: P.ink,
                      }}
                    >
                      Drei Varianten in{" "}
                      <em
                        style={{
                          fontFamily: STUDIO_TOKENS.accentSerif,
                          fontStyle: "italic",
                          fontWeight: 500,
                          background: STUDIO_TOKENS.gradientBrand,
                          WebkitBackgroundClip: "text",
                          backgroundClip: "text",
                          color: "transparent",
                        }}
                      >
                        {ESTIMATED_SECONDS}–{ESTIMATED_SECONDS_MAX}s
                      </em>
                    </div>
                    <p
                      style={{
                        margin: "8px 0 0",
                        fontFamily: STUDIO_TOKENS.sans,
                        fontSize: 12,
                        color: P.ink3,
                        lineHeight: 1.45,
                      }}
                    >
                      Bei Peak-Auslastung kann Kie etwas länger brauchen — wir warten geduldig.
                    </p>
                    <p
                      style={{
                        margin: "14px 0 0",
                        fontFamily: STUDIO_TOKENS.mono,
                        fontSize: 11,
                        letterSpacing: 0.4,
                        color: P.ink3,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span style={{ color: STUDIO_TOKENS.amber2, fontWeight: 700 }}>
                        {formatDeNumber(generationTokenCost)}
                      </span>
                      Tokens
                      <span style={{ opacity: 0.4 }}>·</span>
                      {tokensFreeLabel} frei
                    </p>
                  </div>

                  {error ? (
                    <p style={{ margin: "12px 0 0", fontSize: 12, color: "#F5A8A8" }} role="alert">
                      {error}
                    </p>
                  ) : null}

                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void generate()}
                    className={loading ? "studio-create-generate-btn" : "evg-cta studio-create-generate-btn"}
                    style={{
                      marginTop: 20,
                      width: "100%",
                      padding: "16px 24px",
                      borderRadius: 12,
                      border: "none",
                      background: "linear-gradient(135deg, #F2A35A 0%, #E66A2B 38%, #C13B1F 100%)",
                      color: "#0A0807",
                      boxShadow: loading
                        ? "0 14px 30px -10px rgba(230,106,43,0.55), inset 0 1px 0 rgba(255,255,255,0.18)"
                        : "0 14px 30px -10px rgba(230,106,43,0.55), inset 0 1px 0 rgba(255,255,255,0.18)",
                      fontFamily: STUDIO_TOKENS.sans,
                      fontSize: 15.5,
                      fontWeight: 650,
                      letterSpacing: 0.2,
                      cursor: loading ? "wait" : "pointer",
                      opacity: loading ? 0.92 : 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                      position: "relative",
                      overflow: "hidden",
                      animation: loading ? "evg-pulse-glow 1.6s ease-in-out infinite" : undefined,
                    }}
                  >
                    {loading ? (
                      <>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ animation: "spin 1.2s linear infinite" }}>
                          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
                          <path d="M14 8 A6 6 0 0 0 8 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        <span>{generationStep || "Generiere …"}</span>
                        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                          <path d="M6 1 L7.5 4.5 L11 6 L7.5 7.5 L6 11 L4.5 7.5 L1 6 L4.5 4.5 Z" />
                        </svg>
                        <span>Jetzt generieren</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Markenstil-Footer-Badge (im Mockup links unten) */}
              <div
                style={{
                  marginTop: 18,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  paddingTop: 16,
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: profileComplete && profileMode !== "skip" ? P.accent : "rgba(255,255,255,0.08)",
                      flexShrink: 0,
                    }}
                  />
                  <div>
                    <div
                      style={{
                        fontFamily: STUDIO_TOKENS.mono,
                        fontSize: 9,
                        letterSpacing: 1.2,
                        textTransform: "uppercase",
                        color: "rgba(244,239,230,0.55)",
                      }}
                    >
                      {profileComplete && profileMode !== "skip" ? "Markenstil aktiv" : "Ohne Markenprofil"}
                    </div>
                    <div
                      style={{
                        fontFamily: STUDIO_TOKENS.sans,
                        fontSize: 16,
                        fontWeight: 600,
                        marginTop: 2,
                        color: "#F4EFE6",
                      }}
                    >
                      {breweryName || brandLabel}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    fontFamily: STUDIO_TOKENS.mono,
                    fontSize: 10,
                    letterSpacing: 0.4,
                    color: "rgba(244,239,230,0.5)",
                  }}
                >
                  Tokens {tokensFreeLabel}
                </div>
              </div>
            </div>
          ) : null}

          </StudioViewTransition>

          {/* Navigation: Zurück / Weiter */}
          <div
            style={{
              position: "relative",
              marginTop: 28,
              paddingTop: 20,
              borderTop: `1px solid ${P.rule}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={goPrev}
              disabled={stepIndex === 0}
              className={stepIndex === 0 ? undefined : "evg-pill"}
              style={{
                padding: "10px 18px",
                borderRadius: 10,
                border: `1px solid ${P.rule}`,
                background: "rgba(245,237,223,0.03)",
                color: P.ink2,
                fontFamily: STUDIO_TOKENS.sans,
                fontSize: 13,
                fontWeight: 600,
                cursor: stepIndex === 0 ? "not-allowed" : "pointer",
                opacity: stepIndex === 0 ? 0.4 : 1,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M8 2 L4 6 L8 10" />
              </svg>
              Zurück
            </button>

            <div
              style={{
                fontFamily: STUDIO_TOKENS.sans,
                fontSize: 13,
                color: P.ink2,
                lineHeight: 1.4,
                flex: "1 1 auto",
                textAlign: "center",
                minWidth: 0,
              }}
            >
              {currentStepDef.id !== "review" ? (
                <em
                  style={{
                    fontStyle: "normal",
                    fontFamily: STUDIO_TOKENS.sans,
                    fontSize: 14.5,
                    color: P.ink,
                  }}
                >
                  {briefSentence}
                </em>
              ) : null}
            </div>

            {!isLastStep ? (
              <button
                type="button"
                onClick={goNext}
                className="evg-cta"
                style={{
                  padding: "11px 20px",
                  borderRadius: 10,
                  border: "none",
                  background: "linear-gradient(135deg, #F2A35A 0%, #E66A2B 38%, #C13B1F 100%)",
                  color: "#0A0807",
                  boxShadow: "0 10px 24px -10px rgba(230,106,43,0.55), inset 0 1px 0 rgba(255,255,255,0.18)",
                  fontFamily: STUDIO_TOKENS.sans,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                Weiter
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 2 L8 6 L4 10" />
                </svg>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => goToStep(0)}
                className="evg-pill"
                style={{
                  padding: "10px 18px",
                  borderRadius: 10,
                  border: `1px solid ${P.rule}`,
                  background: "rgba(245,237,223,0.03)",
                  color: P.ink2,
                  fontFamily: STUDIO_TOKENS.sans,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M2 5 A5 5 0 1 1 4 11" />
                  <path d="M2 2 V5 H5" />
                </svg>
                Neu beginnen
              </button>
            )}
          </div>
        </div>

        {images.length > 0 ? (
          <div style={{ marginTop: 32 }}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  fontFamily: STUDIO_TOKENS.mono,
                  fontSize: 10,
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                  color: P.ink3,
                }}
              >
                Ergebnis · {images.filter((m) => Boolean(imageSrc(m))).length} / {images.length} fertig
              </div>
              <div
                style={{
                  fontFamily: STUDIO_TOKENS.mono,
                  fontSize: 10,
                  letterSpacing: 0.4,
                  color: P.ink3,
                }}
              >
                {wofuer.label} · {generationStep || (loading ? "Generiere …" : "")}
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${Math.min(images.length, 3)}, minmax(220px, 1fr))`,
                gap: 14,
              }}
            >
              {images.map((img, i) => {
                const src = imageSrc(img);
                return (
                  <div
                    key={i}
                    className={src ? "evg-result-card" : undefined}
                    style={{
                      borderRadius: 14,
                      overflow: "hidden",
                      border: src ? `1px solid ${P.rule}` : "1px dashed rgba(245,237,223,0.16)",
                      background: src ? P.surface2 : "rgba(245,237,223,0.04)",
                      aspectRatio: "1 / 1",
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: src ? "zoom-in" : "default",
                    }}
                  >
                    {src ? (
                      <>
                        <img
                          src={src}
                          alt={`Variante ${i + 1}`}
                          className="evg-result-img"
                          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transition: "transform .5s ease" }}
                        />
                        <div
                          aria-hidden
                          className="evg-result-overlay"
                          style={{
                            position: "absolute",
                            inset: 0,
                            background: "linear-gradient(180deg, rgba(10,8,7,0.0) 50%, rgba(10,8,7,0.7) 100%)",
                            opacity: 0,
                            transition: "opacity .25s ease",
                            pointerEvents: "none",
                          }}
                        />
                        <div
                          style={{
                            position: "absolute",
                            top: 12,
                            left: 12,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "5px 10px",
                            borderRadius: 999,
                            background: "rgba(10,8,7,0.72)",
                            color: P.ink,
                            fontFamily: STUDIO_TOKENS.sans,
                            fontSize: 11,
                            fontWeight: 600,
                            letterSpacing: 0.2,
                            backdropFilter: "blur(8px)",
                            WebkitBackdropFilter: "blur(8px)",
                            border: "1px solid rgba(245,237,223,0.10)",
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: 999,
                              background: STUDIO_TOKENS.amber,
                              boxShadow: `0 0 8px ${STUDIO_TOKENS.amber}`,
                            }}
                          />
                          Variante {i + 1}
                        </div>
                        <div
                          className="evg-result-actions"
                          style={{
                            position: "absolute",
                            bottom: 12,
                            left: 12,
                            right: 12,
                            display: "flex",
                            gap: 8,
                            opacity: 0,
                            transform: "translateY(4px)",
                            transition: "opacity .25s ease, transform .25s ease",
                          }}
                        >
                          <a
                            href={src}
                            download={`variante-${i + 1}.png`}
                            onClick={(e) => e.stopPropagation()}
                            className="evg-cta"
                            style={{
                              flex: 1,
                              padding: "9px 12px",
                              borderRadius: 9,
                              background: STUDIO_TOKENS.gradientBrand,
                              color: "#0A0807",
                              fontFamily: STUDIO_TOKENS.sans,
                              fontSize: 12,
                              fontWeight: 650,
                              textDecoration: "none",
                              textAlign: "center",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 6,
                              boxShadow: "0 8px 22px -8px rgba(230,106,43,0.6), inset 0 1px 0 rgba(255,255,255,0.18)",
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M7 2 V9 M4 6 L7 9 L10 6 M3 12 H11" />
                            </svg>
                            Download
                          </a>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(src, "_blank", "noopener,noreferrer");
                            }}
                            style={{
                              padding: "9px 12px",
                              borderRadius: 9,
                              background: "rgba(10,8,7,0.72)",
                              color: P.ink,
                              fontFamily: STUDIO_TOKENS.sans,
                              fontSize: 12,
                              fontWeight: 600,
                              border: "1px solid rgba(245,237,223,0.16)",
                              cursor: "pointer",
                              backdropFilter: "blur(8px)",
                              WebkitBackdropFilter: "blur(8px)",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M8 2 H12 V6" />
                              <path d="M12 2 L7 7" />
                              <path d="M12 8 V11 A1 1 0 0 1 11 12 H3 A1 1 0 0 1 2 11 V3 A1 1 0 0 1 3 2 H6" />
                            </svg>
                            Öffnen
                          </button>
                        </div>
                      </>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 10,
                          fontFamily: STUDIO_TOKENS.sans,
                          color: P.ink2,
                          fontSize: 12,
                        }}
                      >
                        <svg width="40" height="40" viewBox="0 0 50 50" aria-hidden="true">
                          <circle cx="25" cy="25" r="20" fill="none" stroke={P.ruleStrong} strokeWidth="4" opacity="0.35" />
                          <circle
                            cx="25"
                            cy="25"
                            r="20"
                            fill="none"
                            stroke={P.accent}
                            strokeWidth="4"
                            strokeDasharray="80 60"
                            strokeLinecap="round"
                          >
                            <animateTransform
                              attributeName="transform"
                              type="rotate"
                              from="0 25 25"
                              to="360 25 25"
                              dur="1.1s"
                              repeatCount="indefinite"
                            />
                          </circle>
                        </svg>
                        <div
                          style={{
                            fontFamily: STUDIO_TOKENS.mono,
                            fontSize: 10,
                            letterSpacing: 1.2,
                            textTransform: "uppercase",
                            color: P.ink3,
                          }}
                        >
                          Rendering
                        </div>
                        <div
                          style={{
                            fontFamily: STUDIO_TOKENS.sans,
                            fontWeight: 700,
                            fontSize: 24,
                            color: P.ink,
                            lineHeight: 1,
                          }}
                        >
                          Variante {i + 1}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

    <BrandProfileSetupModal
      open={brandProfileSetupOpen}
      onOpenChange={setBrandProfileSetupOpen}
      title="Marke einlesen"
      onSaved={applyBrandScanAndPersist}
    />
    </>
  );
}
