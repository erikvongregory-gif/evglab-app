import type { HyperrealisticInput } from "@/app/(dashboard)/inhalte-erstellen/lib/schemas";
import type { OpenAiReferenceImage } from "@/lib/openai/generateImage";
import { readFile } from "node:fs/promises";
import path from "node:path";

const PREMIUM_REFERENCE_FILES = [
  "01-group-toast-bokeh.png",
  "02-portrait-soft-bokeh.png",
  "03-pour-hospitality.png",
] as const;

const cache = new Map<string, OpenAiReferenceImage | null>();

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function selectFiles(input: HyperrealisticInput, limit: number): string[] {
  const seed = stableHash(`${input.zusatzWunsch ?? ""}|${input.szene}|${input.shotType ?? "A"}`);
  const count = Math.min(Math.max(0, limit), PREMIUM_REFERENCE_FILES.length);
  return Array.from({ length: count }, (_, offset) => PREMIUM_REFERENCE_FILES[(seed + offset) % PREMIUM_REFERENCE_FILES.length]);
}

async function loadFile(fileName: string): Promise<OpenAiReferenceImage | null> {
  if (cache.has(fileName)) return cache.get(fileName) ?? null;
  try {
    const file = path.join(process.cwd(), "assets", "premium-references", fileName);
    const buffer = await readFile(file);
    const reference = buffer.byteLength
      ? { base64: buffer.toString("base64"), mime: "image/png" }
      : null;
    cache.set(fileName, reference);
    return reference;
  } catch (error) {
    console.warn(`[premiumStyleReferences] could not load ${fileName}:`, error);
    cache.set(fileName, null);
    return null;
  }
}

/** Hospitality lifestyle stills as look-only references for premium mode. */
export async function loadPremiumStyleReferences(
  input: HyperrealisticInput,
  limit = 2,
): Promise<OpenAiReferenceImage[]> {
  if (input.photoStyle !== "premium" || limit <= 0) return [];
  const loaded = await Promise.all(selectFiles(input, limit).map(loadFile));
  return loaded.filter((reference): reference is OpenAiReferenceImage => Boolean(reference));
}
