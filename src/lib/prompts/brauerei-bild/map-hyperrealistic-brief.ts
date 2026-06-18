import { FLASCHEN_TYPEN, GLAS_TYPEN, isDoseTyp } from "@/app/(dashboard)/inhalte-erstellen/lib/brewing-knowledge";
import type { HyperrealisticInput } from "@/app/(dashboard)/inhalte-erstellen/lib/schemas";

const SZENE_LABELS: Record<HyperrealisticInput["szene"], string> = {
  biergarten_sommer: "Biergarten im Sommer",
  wirtshaus_innen: "Wirtshaus innen",
  kueche_zuhause: "Kueche zuhause",
  wiese_picknick: "Wiese / Picknick",
  strand_sonnenuntergang: "Strand Sonnenuntergang",
  alpenpanorama: "Alpenpanorama",
  stadtbalkon_abend: "Stadtbalkon abends",
  brauereihof: "Brauereihof",
  fussball_public_viewing: "Public Viewing",
};

const TAGESZEIT_LABELS: Record<HyperrealisticInput["tageszeit"], string> = {
  goldene_stunde: "Goldene Stunde",
  mittag: "Mittagslicht",
  abend_warm: "Warmes Abendlicht",
  blaue_stunde: "Blaue Stunde",
};

const STIMMUNG_TREND_LABELS: Record<NonNullable<HyperrealisticInput["stimmungTrend"]>, string> = {
  nachhaltig: "Nachhaltig/Rustikal",
  modern: "Modern/Minimalistisch",
  nostalgie: "Nostalgisch/Vintage",
  aktiv: "Aktiv/Frisch",
  premium: "Premium/Luxus",
};

const SHOT_TYPE_LABELS: Record<NonNullable<HyperrealisticInput["shotType"]>, string> = {
  A: "45° Hero Shot",
  B: "Eye-Level frontal",
  C: "Low Angle (von unten, imposant)",
  D: "Flat Lay / Top-Down",
  E: "Close-Up / Detail",
  F: "Wide Environmental",
  G: "Drone / Aerial",
  H: "POV / Over-Shoulder",
};

const KI_PLATTFORM_LABELS: Record<NonNullable<HyperrealisticInput["kiPlattform"]>, string> = {
  gpt_image_2: "GPT Image 2",
  nano_banana_pro: "Nano Banana Pro",
  nano_banana_2: "Nano Banana 2",
  midjourney: "Midjourney",
};

const BEHAELTER_LABELS: Record<NonNullable<HyperrealisticInput["behaelter"]>, string> = {
  G: "Nur Glas – kein Flaschenprodukt sichtbar",
  F: "Nur Flasche / Dose – kein eingeschenktes Glas",
  B: "Beides – Flasche UND Glas (Proportions-Check PFLICHT)",
};

const ZIELGRUPPE_LABELS: Record<NonNullable<HyperrealisticInput["zielgruppe"]>, string> = {
  entdecker: "Der Entdecker – Craft-Beer-Fans, neugierig, experimentierfreudig",
  traditionsbewusst: "Der Traditionsbewusste – regionale Treue, Reinheitsgebot",
  gesundheitsbewusst: "Der Gesundheitsbewusste – aktiver Lebensstil",
  geniesser: "Der Geniesser – Premium-Erlebnis, gehobener Anspruch",
};

const GRUPPEN_DYNAMIK_LABELS: Record<NonNullable<HyperrealisticInput["gruppenDynamik"]>, string> = {
  E1: "E1 — Selfie-POV (Kamera-nah, Gläser gestreckt, lachend in Kamera)",
  E2: "E2 — Anstoßen / Prost",
  E3: "E3 — Zusammensitzen am Holztisch",
  E4: "E4 — Walking / Outdoor mit Flaschen in Hand",
};

const GRUPPEN_TYP_LABELS: Record<NonNullable<HyperrealisticInput["gruppenTyp"]>, string> = {
  gemischt: "gemischte Gruppe",
  frauen: "nur Frauen",
  maenner: "nur Männer",
  paerchen: "Pärchen",
};

const GRUPPEN_ANZAHL_LABELS: Record<NonNullable<HyperrealisticInput["gruppenAnzahl"]>, string> = {
  "2": "2 Personen",
  "3": "3 Personen",
  "4_5": "4–5 Personen",
};

const PERSON_GENDER_LABELS: Record<NonNullable<HyperrealisticInput["personGender"]>, string> = {
  maennlich: "männlich",
  weiblich: "weiblich",
  divers: "divers/androgyn",
};

const PERSON_ALTER_LABELS: Record<NonNullable<HyperrealisticInput["personAlter"]>, string> = {
  jung: "20–30 Jahre",
  mittel: "30–50 Jahre",
  aelter: "50+",
};

const PERSON_KOERPER_LABELS: Record<NonNullable<HyperrealisticInput["personKoerper"]>, string> = {
  kopf_schultern: "Kopf + Schultern",
  halbkoerper: "halber Körper",
  ganzkoerper: "ganze Person",
};

const PERSON_MOOD_LABELS: Record<NonNullable<HyperrealisticInput["personMood"]>, string> = {
  entspannt: "entspannt",
  lachend: "lachend",
  nachdenklich: "nachdenklich",
  aktiv: "aktiv",
};

function describePersonenModus(input: HyperrealisticInput): {
  modus: string;
  detail: string | null;
} {
  const modus = input.personenModus ?? (input.personImBild ? "D" : "A");
  switch (modus) {
    case "A":
      return { modus: "A – Kein Mensch (reines Produktbild)", detail: null };
    case "B":
      return { modus: "B – Hände/Arme halten Glas oder Flasche, kein Gesicht", detail: null };
    case "C":
      return {
        modus: "C – Person OHNE Gesicht (Silhouette, abgewandt)",
        detail: null,
      };
    case "D": {
      const parts = [
        input.personGender ? PERSON_GENDER_LABELS[input.personGender] : null,
        input.personAlter ? PERSON_ALTER_LABELS[input.personAlter] : null,
        input.personKoerper ? `Bildanteil: ${PERSON_KOERPER_LABELS[input.personKoerper]}` : null,
        input.personMood ? `Stimmung: ${PERSON_MOOD_LABELS[input.personMood]}` : null,
        input.personBeschreibung ? `Freitext: ${input.personBeschreibung}` : null,
      ].filter(Boolean);
      return {
        modus: "D – Anonyme Lifestyle-Figur MIT Gesicht (KI-generiert, keine reale Person)",
        detail: parts.length ? parts.join(" · ") : null,
      };
    }
    case "E": {
      const parts = [
        input.gruppenAnzahl ? GRUPPEN_ANZAHL_LABELS[input.gruppenAnzahl] : null,
        input.gruppenTyp ? GRUPPEN_TYP_LABELS[input.gruppenTyp] : null,
        input.gruppenDynamik ? GRUPPEN_DYNAMIK_LABELS[input.gruppenDynamik] : null,
        `Schauplatz: ${SZENE_LABELS[input.szene]}`,
      ].filter(Boolean);
      return {
        modus: "E – GRUPPE (2–5 anonyme Figuren, Lifestyle-Szene)",
        detail: parts.length ? parts.join(" · ") : null,
      };
    }
    default:
      return { modus: "A – Kein Mensch (reines Produktbild)", detail: null };
  }
}

function aspectRatioToPlattform(aspectRatio: HyperrealisticInput["aspectRatio"]): string {
  if (aspectRatio === "9:16") return "Instagram Story (9:16)";
  if (aspectRatio === "16:9") return "Website Hero (16:9)";
  if (aspectRatio === "1:1") return "Instagram Post (1:1)";
  return "Instagram Post (4:5)";
}

function deriveStimmung(input: HyperrealisticInput): string {
  if (input.stimmungTrend) return STIMMUNG_TREND_LABELS[input.stimmungTrend];
  switch (input.stimmung) {
    case "entspannt":
      return "Nachhaltig/Rustikal";
    case "feierlich":
      return "Premium/Luxus";
    case "gesellig":
      return "Aktiv/Frisch";
    case "kontemplativ":
      return "Modern/Minimalistisch";
    default:
      return "Nachhaltig/Rustikal";
  }
}

function fallbackShotType(input: HyperrealisticInput) {
  if (input.shotType) return SHOT_TYPE_LABELS[input.shotType];
  if (input.szene === "alpenpanorama" || input.szene === "brauereihof") {
    return SHOT_TYPE_LABELS.F;
  }
  return SHOT_TYPE_LABELS.A;
}

export function hyperrealisticInputToBrauereiBrief(
  input: HyperrealisticInput,
  options?: { breweryName?: string },
): Record<string, unknown> {
  const flasche = FLASCHEN_TYPEN[input.flaschenTyp];
  const glas = input.glasTyp ? GLAS_TYPEN[input.glasTyp] : null;
  const behaelter = input.behaelter ?? (glas ? "B" : "F");
  const personen = describePersonenModus(input);
  const kiPlattform = input.kiPlattform ?? "gpt_image_2";
  const etikettModus = input.etikettModus ?? "marke";

  return {
    modus: "hyperrealistic_dashboard",
    biertyp: input.bierstil,
    behaelter: BEHAELTER_LABELS[behaelter],
    behaelterCode: behaelter,
    flaschenTyp: behaelter === "G" ? null : flasche.label,
    flaschenForm: behaelter === "G" ? null : flasche.promptDescription,
    flaschenFormVerbot: behaelter === "G" ? null : flasche.forbidden,
    gebindeMaterial: behaelter === "G" ? null : isDoseTyp(input.flaschenTyp) ? "Aluminium-Dose" : "Glasflasche",
    flaschenfarbe: behaelter === "G" || isDoseTyp(input.flaschenTyp) ? null : input.flaschenfarbe,
    glasTyp: glas?.label ?? null,
    markenname: options?.breweryName?.trim() || "generisch",
    zielgruppe: input.zielgruppe ? ZIELGRUPPE_LABELS[input.zielgruppe] : null,
    plattform: aspectRatioToPlattform(input.aspectRatio),
    seitenverhaeltnis: input.aspectRatio,
    stimmung: deriveStimmung(input),
    szene: SZENE_LABELS[input.szene],
    tageszeit: TAGESZEIT_LABELS[input.tageszeit],
    personenModus: personen.modus,
    personenDetail: personen.detail,
    shotType: fallbackShotType(input),
    shotTypeCode: input.shotType ?? "A",
    kiPlattform: KI_PLATTFORM_LABELS[kiPlattform],
    etikettModus:
      etikettModus === "marke"
        ? "Ja, Marken-Etikett 1:1 (Referenzbild wird mitgesendet)"
        : "Generisch / unbranded",
    referenzStaerke: etikettModus === "marke" ? "Strikt 85%" : "Frei",
    referenzHinweis:
      etikettModus === "marke"
        ? "Separates Referenzbild der Flasche/Etikett wird an die Bild-KI uebergeben."
        : "Keine Etikett-Referenz, Flasche bleibt unbranded.",
    zusatzWunsch: input.zusatzWunsch ?? null,
    qualitaet: input.quality,
  };
}

export function buildHyperrealisticClaudeUserMessage(
  input: HyperrealisticInput,
  options?: { breweryName?: string; hasReferenceImage?: boolean },
): string {
  const brief = hyperrealisticInputToBrauereiBrief(input, options);
  const kiPlattform = input.kiPlattform ?? "gpt_image_2";
  const targetModel =
    kiPlattform === "midjourney"
      ? "Midjourney v6.1"
      : kiPlattform === "nano_banana_pro"
        ? "Nano Banana Pro"
        : kiPlattform === "nano_banana_2"
          ? "Nano Banana 2"
          : "GPT Image 2";

  const lines: string[] = [
    "Erstelle einen kopierfertigen englischen Bildgenerierungs-Prompt fuer den EvGlab Dashboard-Modus „Hyperrealistisch“.",
    `Zielmodell: ${targetModel} — nutze die plattform-spezifische Prompt-Struktur aus dem Skill und SRM-Farbtabelle.`,
  ];

  const hasReferenceImage = Boolean(options?.hasReferenceImage) && input.etikettModus === "marke";
  const behaelter = input.behaelter ?? (input.glasTyp ? "B" : "F");
  if (behaelter === "G") {
    lines.push(
      "KRITISCH Behaelter = G (Nur Glas): Der Prompt darf KEINE Flasche und KEINE Dose enthalten — nur Glas/Gläser.",
      "Das Referenzbild dient NUR zum Lesen von Logo/Typografie fuer das GLAS (EXACT TEXT auf Glas), NICHT zum Kopieren der Flasche in die Szene.",
    );
  } else if (hasReferenceImage) {
    lines.push(
      "WICHTIG: Im ersten Content-Block dieser Nachricht ist das Referenzbild der Flasche/des Etiketts der Brauerei eingebettet.",
      "Fuehre den REFERENZBILD-WORKFLOW (Schritt A–D) aus dem Skill aus, BEVOR du den Prompt schreibst:",
      "  A) Lies aus dem Bild NUR die ETIKETT-/MARKEN-Elemente aus: Logo (Form, Farbe, Inhalt), Primaertext (Markenname), Sekundaertext (Produktname/Bierstil), Mikrotext (Slogans, Jahreszahlen, Adressen), Etikett-Hintergrundfarbe, Dekorelemente (Rahmen, Illustrationen), dominante Farbpalette.",
      "  A-WICHTIG: Die FLASCHENFORM, das VOLUMEN und der VERSCHLUSS werden NICHT aus dem Referenzbild uebernommen — sie sind im Briefing (`flaschenForm`) verbindlich vorgegeben. Selbst wenn das Referenzbild eine andere Flasche zeigt: ignoriere deren Form/Groesse komplett und nutze ausschliesslich die Briefing-Vorgabe. Das Referenzbild dient AUSSCHLIESSLICH dem Etikett/Logo/Text.",
      "  B) Integriere ALLE klar lesbaren Textelemente als `EXACT TEXT '...'` Bausteine in den finalen englischen Prompt (GPT-Image-2-Syntax).",
      "  C) Beschreibe Logo und Dekorelemente praezise in Englisch und fordere 1:1-Treue zur Referenz: `preserve the exact label design from the reference image, no text modifications, no logo alterations`.",
      "  D) Wenn Behaelter = B (Flasche + Glas) und das Glas im Referenzbild ebenfalls ein Logo zeigt: explizit fordern, dass auch das Glas-Logo 1:1 uebernommen wird.",
      "  Falls Text/Logo im Bild nicht klar erkennbar ist, ERFINDE NICHTS — beschreibe nur, was sichtbar ist, und nutze `PRESERVE LABEL DESIGN FROM REFERENCE IMAGE EXACTLY` als Fallback.",
    );
  } else if (input.etikettModus === "marke") {
    lines.push(
      "Das Etikett/die Flasche kommt als separates Referenzbild zur Bild-KI — beschreibe 1:1-Etikett-Treue mit EXACT TEXT Syntax.",
    );
  } else {
    lines.push("Generischer Look ohne Marken-Etikett — keine EXACT-TEXT-Syntax verwenden.");
  }

  if (behaelter !== "G") {
    const flasche = FLASCHEN_TYPEN[input.flaschenTyp];
    const istDose = isDoseTyp(input.flaschenTyp);
    const gebinde = istDose ? "Dose" : "Flasche";
    lines.push(
      `KRITISCH GEBINDE-FORM (PFLICHT, woertlich uebernehmen): Die ${gebinde} MUSS sein: ${flasche.promptDescription}.`,
      `VERBOTEN: ${flasche.forbidden}.`,
      `Baue diese exakte ${gebinde}-Form + Volumen explizit in den englischen Prompt ein und ergaenze am Promptende einen 'BOTTLE SHAPE LOCK (MANDATORY)'-Satz, der genau diese Form/Groesse erzwingt und Verwechslungen (z. B. 0,5-l-NRW-Longneck vs. 0,33-l-Stubbi, oder Glasflasche vs. Aluminium-Dose) ausschliesst.`,
      "Die Gebindegroesse muss in real-world Massstab erkennbar sein (0,33 l vs 0,5 l klar unterscheidbar).",
      istDose
        ? "Es ist eine ALUMINIUM-DOSE: KEIN Glas, KEINE Flaschenfarbe, KEIN Flaschenhals, KEIN Kronkorken. Das Referenzbild liefert das Wrap-around-Dosen-Artwork (rund um den Dosenkoerper), nicht die Form."
        : "Es ist eine GLASFLASCHE in der angegebenen Glasfarbe.",
    );
  }

  if (input.szene === "fussball_public_viewing") {
    lines.push(
      "KRITISCH Schauplatz = Public Viewing: Die Szene MUSS ein oeffentliches Fussball-Public-Viewing / Fanmeile mit sichtbarer Grossleinwand oder Stadion-Atmosphaere zeigen.",
      "VERBOTEN als Haupsetting: klassischer Biergarten, Wirtshaus-Innenraum, Alpenhuette, gemuetlicher Holztisch unter Kastanien.",
    );
  }

  lines.push(
    "HYPERREALISM (PFLICHT): Das Bild muss wie eine echte Kamera-Aufnahme wirken — keine CGI-, Illustrations- oder AI-Art-Optik.",
    "Nutze SRM-Farbe + Hex aus der Farbtabelle, Schaumcharakteristik, Kondenswasser-Realismus und mindestens 3 konkrete Umgebungs-Mikrodetails.",
    "Menschen: natuerliche Hauttextur (Poren, keine waxy plastic skin), korrekte Haende/Finger, keine Stock-Photo-Posen.",
    "Kamera: explizites Objektiv (35/50/85/100mm), Blende, Bildausschnitt und Tiefenschaerfe.",
    "Negative am Ende: CGI, cartoon, plastic foam, sticker condensation, waxy skin, generic stock look.",
    "Pruefe intern alle Qualitaetspunkte; gib aber NUR den englischen Prompt aus (inkl. Negative am Ende). Kein deutscher Text, kein Markdown, keine Erklaerung.",
    "",
    "Strukturiertes Briefing (JSON):",
    JSON.stringify(brief, null, 2),
  );

  return lines.join("\n");
}
