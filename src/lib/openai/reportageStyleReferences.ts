import type { HyperrealisticInput } from "@/app/(dashboard)/inhalte-erstellen/lib/schemas";
import type { OpenAiReferenceImage } from "@/lib/openai/generateImage";
import { blurLookReference } from "@/lib/openai/blurLookReference";
import { readFile } from "node:fs/promises";
import path from "node:path";

const REPORTAGE_REFERENCE_FILES = ["01-night-street-flash.jpg"] as const;

const cache = new Map<string, OpenAiReferenceImage | null>();

async function loadFile(fileName: string): Promise<OpenAiReferenceImage | null> {
  if (cache.has(fileName)) return cache.get(fileName) ?? null;
  try {
    const file = path.join(process.cwd(), "assets", "reportage-references", fileName);
    const buffer = await blurLookReference(await readFile(file));
    const reference = buffer?.byteLength
      ? { base64: buffer.toString("base64"), mime: "image/jpeg" }
      : null;
    cache.set(fileName, reference);
    return reference;
  } catch (error) {
    console.warn(`[reportageStyleReferences] could not load ${fileName}:`, error);
    cache.set(fileName, null);
    return null;
  }
}

/** Candid flash look refs — faces intentionally unreadable so the model invents new people. */
export async function loadReportageStyleReferences(
  input: HyperrealisticInput,
  limit = 2,
): Promise<OpenAiReferenceImage[]> {
  if (input.photoStyle !== "reportage" || limit <= 0) return [];
  const files = REPORTAGE_REFERENCE_FILES.slice(0, Math.min(limit, REPORTAGE_REFERENCE_FILES.length));
  const loaded = await Promise.all(files.map(loadFile));
  return loaded.filter((reference): reference is OpenAiReferenceImage => Boolean(reference));
}
