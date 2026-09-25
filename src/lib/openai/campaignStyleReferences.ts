import type { HyperrealisticInput } from "@/app/(dashboard)/inhalte-erstellen/lib/schemas";
import type { OpenAiReferenceImage } from "@/lib/openai/generateImage";
import { readFile } from "node:fs/promises";
import path from "node:path";

/** Active campaign look pool — product-forward / toast / low-angle grammar. */
const CAMPAIGN_REFERENCE_FILES = [
  "10-picnic-handoff.png",
  "11-lawn-can-toast.jpg",
  "12-sky-can-toast.jpg",
  "13-low-angle-urban.jpg",
] as const;

const cache = new Map<string, OpenAiReferenceImage | null>();

function mimeFor(fileName: string): string {
  return fileName.toLowerCase().endsWith(".jpg") || fileName.toLowerCase().endsWith(".jpeg")
    ? "image/jpeg"
    : "image/png";
}

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
  const count = Math.min(Math.max(0, limit), CAMPAIGN_REFERENCE_FILES.length);
  return Array.from(
    { length: count },
    (_, offset) => CAMPAIGN_REFERENCE_FILES[(seed + offset) % CAMPAIGN_REFERENCE_FILES.length],
  );
}

async function loadFile(fileName: string): Promise<OpenAiReferenceImage | null> {
  if (cache.has(fileName)) return cache.get(fileName) ?? null;
  try {
    const file = path.join(process.cwd(), "assets", "campaign-references", fileName);
    const buffer = await readFile(file);
    const reference = buffer.byteLength
      ? { base64: buffer.toString("base64"), mime: mimeFor(fileName) }
      : null;
    cache.set(fileName, reference);
    return reference;
  } catch (error) {
    console.warn(`[campaignStyleReferences] could not load ${fileName}:`, error);
    cache.set(fileName, null);
    return null;
  }
}

/**
 * Campaign stills as look-only references. The prompt forbids copying
 * their products, people, logos, or lettering.
 */
export async function loadCampaignStyleReferences(
  input: HyperrealisticInput,
  limit = 2,
): Promise<OpenAiReferenceImage[]> {
  if (input.photoStyle !== "campaign" || limit <= 0) return [];
  const loaded = await Promise.all(selectFiles(input, limit).map(loadFile));
  return loaded.filter((reference): reference is OpenAiReferenceImage => Boolean(reference));
}
