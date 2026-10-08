import type { GlasTyp } from "@/app/(dashboard)/inhalte-erstellen/lib/brewing-knowledge";
import type { OpenAiReferenceImage } from "@/lib/openai/generateImage";
import { createAdminClient } from "@/lib/supabase/admin";
import { readFile } from "node:fs/promises";
import path from "node:path";

const BUCKET = process.env.SUPABASE_GENERATED_IMAGES_BUCKET?.trim() || "generated-images";
const PREFIX = "glass-references";
const cache = new Map<GlasTyp, OpenAiReferenceImage | null>();

/**
 * Loads an optional neutral glass-shape reference. The versioned silhouettes in
 * `assets/glass-references/` (scripts/generate-glass-references.mjs) win — an old copy in
 * Storage must never override a corrected drawing. Storage `glass-references/<glasTyp>.png`
 * is only a fallback for glass types without a bundled file.
 */
export async function loadGlassShapeReference(
  glasTyp: GlasTyp | undefined,
): Promise<OpenAiReferenceImage | null> {
  if (!glasTyp) return null;
  if (cache.has(glasTyp)) return cache.get(glasTyp) ?? null;

  try {
    const file = path.join(process.cwd(), "assets", "glass-references", `${glasTyp}.png`);
    const buffer = await readFile(file);
    if (buffer.byteLength > 0) {
      const reference = { base64: buffer.toString("base64"), mime: "image/png" };
      cache.set(glasTyp, reference);
      return reference;
    }
  } catch {
    /* kein gebündeltes Bild — Storage versuchen */
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.storage.from(BUCKET).download(`${PREFIX}/${glasTyp}.png`);
    if (!error && data) {
      const buffer = Buffer.from(await data.arrayBuffer());
      if (buffer.byteLength > 0) {
        const reference = { base64: buffer.toString("base64"), mime: "image/png" };
        cache.set(glasTyp, reference);
        return reference;
      }
    }
    if (error) console.warn(`[glassShapeReference] storage miss for ${glasTyp}:`, error.message);
  } catch (error) {
    console.warn(`[glassShapeReference] storage error for ${glasTyp}:`, error);
  }

  cache.set(glasTyp, null);
  return null;
}
