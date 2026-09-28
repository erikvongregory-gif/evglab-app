import type { OpenAiReferenceImage } from "@/lib/openai/generateImage";
import { readFile } from "node:fs/promises";
import path from "node:path";

export type LiquidClarityRef = "trueb" | "klar";

const cache = new Map<LiquidClarityRef, OpenAiReferenceImage | null>();

/**
 * Optional local liquid-clarity reference for poured beer.
 * `assets/liquid-references/trueb.png` — cloudy naturtrüb body (no branding).
 * Missing assets fall back to text locks only.
 */
export async function loadLiquidClarityReference(
  clarity: LiquidClarityRef | undefined,
): Promise<OpenAiReferenceImage | null> {
  if (clarity !== "trueb") return null;
  if (cache.has(clarity)) return cache.get(clarity) ?? null;

  try {
    const file = path.join(process.cwd(), "assets", "liquid-references", `${clarity}.png`);
    const buffer = await readFile(file);
    const reference = buffer.byteLength
      ? { base64: buffer.toString("base64"), mime: "image/png" as const }
      : null;
    cache.set(clarity, reference);
    return reference;
  } catch {
    cache.set(clarity, null);
    return null;
  }
}
