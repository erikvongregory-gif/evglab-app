import { readFile } from "node:fs/promises";
import path from "node:path";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FlaschenTyp } from "@/app/(dashboard)/inhalte-erstellen/lib/brewing-knowledge";
import type { OpenAiReferenceImage } from "@/lib/openai/generateImage";

const BUCKET = process.env.SUPABASE_GENERATED_IMAGES_BUCKET?.trim() || "generated-images";
const PREFIX = "bottle-references";

/**
 * Flaschentypen, fuer die ein kanonisches Form-Referenzfoto (sauberer Studioshot
 * auf Weiss) in Supabase Storage unter `bottle-references/<typ>.png` liegt.
 * Wird genutzt, um gpt-image-2 per image-to-image die EXAKTE Flaschen-Silhouette
 * vorzugeben (Form, nicht Etikett). Liste erweitern, sobald weitere Referenzfotos
 * hochgeladen sind.
 */
export const BOTTLE_SHAPE_REFERENCE_TYPES: ReadonlySet<FlaschenTyp> = new Set<FlaschenTyp>([
  "nrw_500",
]);

export function hasBottleShapeReference(flaschenTyp: FlaschenTyp): boolean {
  return BOTTLE_SHAPE_REFERENCE_TYPES.has(flaschenTyp);
}

// Referenzfotos sind statisch — pro Prozess einmal laden und cachen.
const cache = new Map<FlaschenTyp, OpenAiReferenceImage | null>();

/**
 * Laedt das Form-Referenzfoto fuer den Flaschentyp aus Supabase Storage und gibt
 * es als base64+mime zurueck. Gibt null zurueck, wenn kein Referenzfoto existiert
 * oder der Download fehlschlaegt (Generierung faellt dann auf Text-only zurueck).
 */
export async function loadBottleShapeReference(
  flaschenTyp: FlaschenTyp,
): Promise<OpenAiReferenceImage | null> {
  if (!hasBottleShapeReference(flaschenTyp)) return null;
  if (cache.has(flaschenTyp)) return cache.get(flaschenTyp) ?? null;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.storage.from(BUCKET).download(`${PREFIX}/${flaschenTyp}.png`);
    if (!error && data) {
      const buffer = Buffer.from(await data.arrayBuffer());
      if (buffer.byteLength > 0) {
        const ref: OpenAiReferenceImage = { base64: buffer.toString("base64"), mime: "image/png" };
        cache.set(flaschenTyp, ref);
        return ref;
      }
    }
    if (error) console.warn(`[bottleShapeReference] storage miss for ${flaschenTyp}:`, error.message);
  } catch (err) {
    console.warn(`[bottleShapeReference] storage error for ${flaschenTyp}:`, err);
  }

  // ponytail: lokale Datei, falls Storage leer ist — sonst faellt die Form auf Text zurueck
  const fromDisk = await loadBottleShapeReferenceFromDisk(flaschenTyp);
  cache.set(flaschenTyp, fromDisk);
  return fromDisk;
}

async function loadBottleShapeReferenceFromDisk(
  flaschenTyp: FlaschenTyp,
): Promise<OpenAiReferenceImage | null> {
  try {
    const file = path.join(process.cwd(), "assets", "bottle-references", `${flaschenTyp}.png`);
    const buffer = await readFile(file);
    if (buffer.byteLength === 0) return null;
    return { base64: buffer.toString("base64"), mime: "image/png" };
  } catch {
    return null;
  }
}
