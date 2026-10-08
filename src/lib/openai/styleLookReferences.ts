import type { HyperrealisticInput } from "@/app/(dashboard)/inhalte-erstellen/lib/schemas";
import { isDoseTyp } from "@/app/(dashboard)/inhalte-erstellen/lib/brewing-knowledge";
import type { OpenAiReferenceImage } from "@/lib/openai/generateImage";
import { blurLookReference, LIGHT_LOOK_BLUR, STRONG_LOOK_BLUR, type FaceBox } from "@/lib/openai/blurLookReference";
import { readFile } from "node:fs/promises";
import path from "node:path";

type PhotoStyle = NonNullable<HyperrealisticInput["photoStyle"]>;

/** Gebinde, das auf dem Look-Bild zu sehen ist — Dosenbilder ziehen Flaschenmarken sonst Richtung Dose. */
type LookContainer = "bottle" | "can" | "any";
/** Lichtsituation — passende Bilder werden bevorzugt, fehlt eins, greift trotzdem ein anderes. */
type LookLight = "day" | "night" | "any";

export type LookReference = {
  file: string;
  container: LookContainer;
  light: LookLight;
  /** Weichzeichner-Stärke. Fremde Fotos: STRONG_LOOK_BLUR (Standard). Eigene KI-Referenzen: LIGHT_LOOK_BLUR. */
  blur?: number;
  /** Gesichter in Prozent [links, oben, rechts, unten] — werden stark verwischt, damit keine Person ins Kundenbild wandert. */
  faces?: readonly FaceBox[];
};

/**
 * Gebündelte Look-Bibliothek. Neue Bilder: Datei in `assets/<style>-references/` legen und hier
 * mit Gebinde + Licht eintragen. Nur eigene oder lizenzierte Fotos ohne erkennbare Prominente.
 */
export const LOOK_LIBRARY: Record<PhotoStyle, { dir: string; refs: LookReference[] }> = {
  reportage: {
    dir: "reportage-references",
    // Eigene KI-Referenzen (erfundene Personen, leere Etiketten) — leichter Weichzeichner hält den Blitz-Look lesbar,
    // die Gesichter werden einzeln stark verwischt (sonst tauchte derselbe Lockenkopf in jedem Kundenbild auf).
    refs: [
      { file: "03-biergarten-day.webp", container: "bottle", light: "day", blur: LIGHT_LOOK_BLUR, faces: [[0, 34, 23, 58], [19, 32, 43, 51], [40, 31, 63, 45], [54, 30, 77, 49], [74, 24, 100, 47]] },
      { file: "10-brewhouse-after-work.webp", container: "bottle", light: "any", blur: LIGHT_LOOK_BLUR, faces: [[22, 24, 43, 41], [53, 29, 78, 45]] },
      { file: "06-stammtisch-wirtshaus.webp", container: "bottle", light: "night", blur: LIGHT_LOOK_BLUR, faces: [[7, 28, 26, 45], [43, 28, 66, 45], [77, 31, 96, 48], [87, 40, 100, 56], [0, 38, 15, 63]] },
      { file: "05-fest-tent-night.webp", container: "bottle", light: "night", blur: LIGHT_LOOK_BLUR, faces: [[14, 36, 35, 53], [37, 34, 67, 56], [67, 32, 83, 46], [82, 34, 100, 53], [24, 24, 43, 37]] },
      { file: "08-keg-tapping-night.webp", container: "bottle", light: "night", blur: LIGHT_LOOK_BLUR, faces: [[0, 11, 13, 46], [12, 39, 28, 53], [18, 31, 34, 43], [38, 28, 56, 43], [55, 34, 71, 43], [76, 25, 93, 38], [84, 16, 100, 34]] },
      { file: "04-brewery-courtyard-night.webp", container: "bottle", light: "night", blur: LIGHT_LOOK_BLUR, faces: [[0, 23, 18, 39], [21, 27, 41, 41], [59, 24, 76, 39], [18, 40, 46, 61], [54, 38, 78, 57], [81, 38, 100, 63], [74, 27, 100, 38]] },
      { file: "09-garage-crate-night.webp", container: "bottle", light: "night", blur: LIGHT_LOOK_BLUR, faces: [[8, 39, 28, 55], [53, 37, 72, 54], [83, 43, 100, 63], [28, 24, 39, 34], [54, 25, 65, 36]] },
      { file: "07-street-walk-night.webp", container: "bottle", light: "night", blur: LIGHT_LOOK_BLUR, faces: [[0, 30, 23, 56], [38, 22, 61, 41], [79, 20, 100, 43], [13, 24, 31, 39]] },
      { file: "02-street-bar-night.webp", container: "bottle", light: "night", blur: LIGHT_LOOK_BLUR, faces: [[0, 4, 9, 36], [7, 27, 28, 47], [26, 36, 57, 57], [54, 37, 73, 54], [84, 29, 100, 49], [67, 29, 88, 43]] },
    ],
  },
  premium: {
    dir: "premium-references",
    // Eigene KI-Referenzen statt fremder Werbefotos — nur so sieht das Modell, wie die Flasche
    // im selben weichen Licht wie die Menschen aussieht (sonst wirkt sie eingefotoshoppt).
    refs: [
      { file: "04-garden-pour-day.webp", container: "bottle", light: "day", blur: LIGHT_LOOK_BLUR, faces: [[52, 10, 82, 66]] },
      // Shooting-Look (Nutzer-Vorgabe 2026-10-02): posierte Tracht-/Biergarten-Porträts, 85mm, echte Sonne.
      { file: "05-beergarden-portrait-day.webp", container: "any", light: "day", blur: LIGHT_LOOK_BLUR, faces: [[36, 9, 62, 43]] },
      { file: "06-tracht-trio-backdrop.webp", container: "any", light: "any", blur: LIGHT_LOOK_BLUR, faces: [[18, 9, 33, 33], [44, 7, 57, 30], [63, 9, 79, 32]] },
      { file: "07-alm-couple-day.webp", container: "any", light: "day", blur: LIGHT_LOOK_BLUR, faces: [[36, 16, 54, 32], [54, 12, 71, 27]] },
      { file: "08-lake-couple-golden.webp", container: "any", light: "day", blur: LIGHT_LOOK_BLUR, faces: [[21, 30, 56, 53], [47, 12, 78, 37]] },
    ],
  },
  campaign: {
    dir: "campaign-references",
    refs: [
      { file: "10-picnic-handoff.png", container: "bottle", light: "day" },
      { file: "09-low-angle-outdoor.png", container: "any", light: "day" },
      { file: "02-handoff-shadow.png", container: "any", light: "day" },
      { file: "11-lawn-can-toast.jpg", container: "can", light: "day" },
      { file: "12-sky-can-toast.jpg", container: "can", light: "day" },
      { file: "13-low-angle-urban.jpg", container: "can", light: "day" },
    ],
  },
};

const NIGHT_TIMES = new Set<HyperrealisticInput["tageszeit"]>(["nacht", "blaue_stunde", "abend_warm"]);

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function rotate<T>(items: T[], by: number): T[] {
  if (!items.length) return items;
  const start = by % items.length;
  return [...items.slice(start), ...items.slice(0, start)];
}

/**
 * Passende Look-Dateien in Rangfolge: passendes Licht vor anderem Licht, gleiches Gebinde vor neutralem.
 * Dosen-Looks gehen nie an Flaschenmarken (und umgekehrt). Fehlt ein passendes Licht, greift ein anderes —
 * lieber eine Referenz mit anderem Licht als gar keine Bildsprache.
 * `variant` rotiert innerhalb jeder Stufe, damit die Varianten eines Auftrags nicht gleich aussehen.
 */
export function selectLookReferences(input: HyperrealisticInput, limit: number, variant = 0): LookReference[] {
  const style = input.photoStyle;
  if (!style || limit <= 0) return [];
  const container: LookContainer = isDoseTyp(input.flaschenTyp) ? "can" : "bottle";
  const light: LookLight = NIGHT_TIMES.has(input.tageszeit) ? "night" : "day";
  const usable = LOOK_LIBRARY[style].refs.filter((ref) => ref.container === container || ref.container === "any");
  const lightFits = (ref: LookReference) => ref.light === light || ref.light === "any";
  const seed = stableHash(`${input.zusatzWunsch ?? ""}|${input.szene}|${input.shotType ?? "A"}`);
  const ranked = (refs: LookReference[]) => [
    ...rotate(refs.filter((ref) => ref.container === container), seed),
    ...rotate(refs.filter((ref) => ref.container === "any"), seed),
  ];
  // Variante 0 bekommt die beste Auswahl; weitere Varianten rotieren durch alle Bilder mit passendem Licht.
  const fitting = rotate(ranked(usable.filter(lightFits)), variant);
  const fallback = rotate(ranked(usable.filter((ref) => !lightFits(ref))), variant);
  return [...fitting, ...fallback].slice(0, limit);
}

const cache = new Map<string, OpenAiReferenceImage | null>();

async function loadFile(dir: string, ref: LookReference): Promise<OpenAiReferenceImage | null> {
  const blur = ref.blur ?? STRONG_LOOK_BLUR;
  const key = `${dir}/${ref.file}@${blur}/${ref.faces?.length ?? 0}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  try {
    const buffer = await blurLookReference(await readFile(path.join(process.cwd(), "assets", dir, ref.file)), blur, ref.faces);
    const reference = buffer?.byteLength ? { base64: buffer.toString("base64"), mime: "image/jpeg" } : null;
    cache.set(key, reference);
    return reference;
  } catch (error) {
    console.warn(`[styleLookReferences] could not load ${key}:`, error);
    cache.set(key, null);
    return null;
  }
}

/** Weichgezeichnete Look-Referenzen für den gewählten Fotostil (nur Licht, Ausschnitt und Bildsprache). */
export async function loadStyleLookReferences(
  input: HyperrealisticInput,
  limit = 2,
  variant = 0,
): Promise<OpenAiReferenceImage[]> {
  const style = input.photoStyle;
  if (!style) return [];
  const dir = LOOK_LIBRARY[style].dir;
  const loaded = await Promise.all(selectLookReferences(input, limit, variant).map((ref) => loadFile(dir, ref)));
  return loaded.filter((reference): reference is OpenAiReferenceImage => Boolean(reference));
}
