import OpenAI from "openai";
import { toFile } from "openai/uploads";
import sharp from "sharp";

const MODEL = "gpt-image-2-2026-04-21";

let openAiClient: OpenAI | null = null;

function getOpenAiClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY fehlt.");
  }
  if (!openAiClient) {
    openAiClient = new OpenAI({ apiKey });
  }
  return openAiClient;
}

export type ImageSize = "1024x1024" | "1024x1280" | "1024x1536" | "1024x1792" | "1792x1024" | "1280x1024";
export type Quality = "low" | "medium" | "high";
type ImageApiData = Array<{ b64_json?: string; url?: string; revised_prompt?: string }>;

import {
  isLegacyKieTempUrl,
  LEGACY_REFERENCE_IMAGE_ERROR,
} from "@/lib/brand/reference-image-store";

export type ReferenceUrlResolver = (url: string, index?: number) => Promise<Buffer | null | undefined>;

interface GenerateParams {
  prompt: string;
  referenceImageUrls?: string[];
  size: ImageSize;
  quality: Quality;
  n?: number;
  resolveReferenceUrl?: ReferenceUrlResolver;
}

export function aspectRatioToImageSize(aspectRatio: "1:1" | "2:3" | "4:5" | "9:16" | "16:9"): ImageSize {
  const sizes = {
    "1:1": "1024x1024",
    "2:3": "1024x1536",
    "4:5": "1024x1280",
    "9:16": "1024x1792",
    "16:9": "1792x1024",
  } as const;
  return sizes[aspectRatio];
}

async function fetchReferenceBuffer(
  url: string,
  index: number,
  resolveReferenceUrl?: ReferenceUrlResolver,
): Promise<Buffer> {
  const resolved = resolveReferenceUrl ? await resolveReferenceUrl(url, index) : null;
  if (resolved && resolved.byteLength > 0) return resolved;

  if (isLegacyKieTempUrl(url)) {
    throw new Error(LEGACY_REFERENCE_IMAGE_ERROR);
  }

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(
      `Reference image fetch failed: ${url}. Bitte Markenprofil neu scannen, falls das Bild aelter ist.`,
    );
  }
  return Buffer.from(await res.arrayBuffer());
}

async function urlsToFiles(urls: string[], resolveReferenceUrl?: ReferenceUrlResolver) {
  return Promise.all(
    urls.map(async (url, index) => {
      const original = await fetchReferenceBuffer(url, index, resolveReferenceUrl);
      const normalized = await sharp(original)
        .rotate()
        .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
        .png()
        .toBuffer();
      return toFile(normalized, `ref_${index}.png`, { type: "image/png" });
    }),
  );
}

export async function generateImage(params: GenerateParams) {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error("OPENAI_API_KEY fehlt.");
  }

  const hasRefs = Boolean(params.referenceImageUrls?.length);
  const baseParams = {
    model: MODEL,
    prompt: params.prompt,
    size: params.size,
    quality: params.quality,
    n: params.n ?? 2,
  };

  if (hasRefs) {
    const files = await urlsToFiles(params.referenceImageUrls ?? [], params.resolveReferenceUrl);
    const client = getOpenAiClient();
    const editParams = {
      ...baseParams,
      image: files.length === 1 ? files[0] : files,
    } as unknown as Parameters<typeof client.images.edit>[0];
    const result = (await client.images.edit(editParams)) as { data: ImageApiData };
    return result.data;
  }

  const client = getOpenAiClient();
  const generateParams = baseParams as unknown as Parameters<typeof client.images.generate>[0];
  const result = (await client.images.generate(generateParams)) as { data: ImageApiData };
  return result.data;
}

export const generateHyperrealistic = (p: {
  prompt: string;
  etikettUrl: string;
  size: ImageSize;
  quality?: Quality;
  resolveReferenceUrl?: ReferenceUrlResolver;
}) =>
  generateImage({
    prompt: p.prompt,
    referenceImageUrls: [p.etikettUrl],
    size: p.size,
    quality: p.quality ?? "high",
    n: 2,
    resolveReferenceUrl: p.resolveReferenceUrl,
  });

export const generateProductStudio = (p: {
  prompt: string;
  referenzBildUrl: string;
  size: ImageSize;
  quality?: Quality;
  resolveReferenceUrl?: ReferenceUrlResolver;
}) =>
  generateImage({
    prompt: p.prompt,
    referenceImageUrls: [p.referenzBildUrl],
    size: p.size,
    quality: p.quality ?? "high",
    n: 2,
    resolveReferenceUrl: p.resolveReferenceUrl,
  });

export const generateCampaignImage = (p: {
  prompt: string;
  feedReferenzen: string[];
  size: ImageSize;
  quality?: Quality;
  resolveReferenceUrl?: ReferenceUrlResolver;
}) =>
  generateImage({
    prompt: p.prompt,
    referenceImageUrls: p.feedReferenzen,
    size: p.size,
    quality: p.quality ?? "high",
    n: 2,
    resolveReferenceUrl: p.resolveReferenceUrl,
  });
