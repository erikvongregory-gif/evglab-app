import { randomUUID } from "node:crypto";
import sharp from "sharp";

const MAX_STORED_IMAGES = 5;
const MAX_BINARY_BYTES = 180 * 1024;
const MAX_TRANSPORT_BINARY_BYTES = 90 * 1024;
const MAX_USER_METADATA_BYTES = 380_000;

export type BrandReferenceImagePayload = {
  base64: string;
  mime: string;
};

export type StoredBrandReferenceImage = {
  mime: string;
  base64: string;
  createdAt: string;
};

function asObj(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

export function parseBrandReferenceIdFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/api\/brand\/reference-image\/([a-zA-Z0-9_-]+)$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function buildBrandReferenceImageUrl(origin: string, id: string): string {
  return new URL(`/api/brand/reference-image/${id}`, origin).toString();
}

export function getBrandReferenceStore(userMetadata: unknown): Record<string, StoredBrandReferenceImage> {
  const base = asObj(userMetadata);
  const dashboard = asObj(base.dashboard);
  const raw = dashboard.brandReferenceImages;
  if (!raw || typeof raw !== "object") return {};

  const store: Record<string, StoredBrandReferenceImage> = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const record = value as Record<string, unknown>;
    const base64 = typeof record.base64 === "string" ? record.base64 : "";
    const mime = typeof record.mime === "string" ? record.mime : "image/jpeg";
    const createdAt = typeof record.createdAt === "string" ? record.createdAt : "";
    if (!base64) continue;
    store[id] = { mime, base64, createdAt };
  }
  return store;
}

function estimateJsonBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

async function compressImage(
  base64: string,
  mime: string,
  options: { maxWidth: number; maxHeight: number; jpegQuality: number; maxBytes: number },
): Promise<{ base64: string; mime: string }> {
  const input = Buffer.from(base64, "base64");
  let pipeline = sharp(input)
    .rotate()
    .resize({ width: options.maxWidth, height: options.maxHeight, fit: "inside", withoutEnlargement: true });

  let output: Buffer;
  if (mime === "image/png") {
    output = await pipeline.png({ compressionLevel: 9 }).toBuffer();
    if (output.byteLength > options.maxBytes) {
      output = await sharp(input)
        .rotate()
        .resize({ width: options.maxWidth, height: options.maxHeight, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: options.jpegQuality })
        .toBuffer();
      return { base64: output.toString("base64"), mime: "image/jpeg" };
    }
    return { base64: output.toString("base64"), mime: "image/png" };
  }

  output = await pipeline.jpeg({ quality: options.jpegQuality }).toBuffer();
  if (output.byteLength > options.maxBytes) {
    const smaller = Math.max(480, Math.round(options.maxWidth * 0.75));
    output = await sharp(input)
      .rotate()
      .resize({ width: smaller, height: smaller, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: Math.max(60, options.jpegQuality - 8) })
      .toBuffer();
  }
  return { base64: output.toString("base64"), mime: "image/jpeg" };
}

export async function compressForBrandReferenceTransport(
  base64: string,
  mime: string,
): Promise<BrandReferenceImagePayload> {
  return compressImage(base64, mime, {
    maxWidth: 640,
    maxHeight: 640,
    jpegQuality: 70,
    maxBytes: MAX_TRANSPORT_BINARY_BYTES,
  });
}

export async function prepareReferenceImagePayloads(
  images: Array<{ base64: string; mime: string }>,
): Promise<BrandReferenceImagePayload[]> {
  const payloads: BrandReferenceImagePayload[] = [];
  for (const image of images.slice(0, MAX_STORED_IMAGES)) {
    payloads.push(await compressForBrandReferenceTransport(image.base64, image.mime));
  }
  return payloads;
}

export async function compressForBrandReferenceStorage(base64: string, mime: string): Promise<{ base64: string; mime: string }> {
  return compressImage(base64, mime, {
    maxWidth: 960,
    maxHeight: 960,
    jpegQuality: 76,
    maxBytes: MAX_BINARY_BYTES,
  });
}

export async function persistBrandReferenceImages(params: {
  userMetadata: unknown;
  origin: string;
  images: Array<{ base64: string; mime: string }>;
}): Promise<{ urls: string[]; mergedMetadata: Record<string, unknown> }> {
  const store: Record<string, StoredBrandReferenceImage> = {};
  const urls: string[] = [];
  const now = new Date().toISOString();

  for (const image of params.images.slice(0, MAX_STORED_IMAGES)) {
    const compressed = await compressForBrandReferenceStorage(image.base64, image.mime);
    const id = `br_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    store[id] = {
      mime: compressed.mime,
      base64: compressed.base64,
      createdAt: now,
    };
    urls.push(buildBrandReferenceImageUrl(params.origin, id));
  }

  const base = asObj(params.userMetadata);
  const dashboard = asObj(base.dashboard);
  let trimmedStore = store;
  let trimmedUrls = urls;

  while (Object.keys(trimmedStore).length > 0) {
    const mergedMetadata = {
      ...base,
      dashboard: {
        ...dashboard,
        brandReferenceImages: trimmedStore,
      },
    };
    if (estimateJsonBytes(mergedMetadata) <= MAX_USER_METADATA_BYTES) {
      return { urls: trimmedUrls, mergedMetadata };
    }
    const lastId = Object.keys(trimmedStore).at(-1);
    if (!lastId) break;
    delete trimmedStore[lastId];
    trimmedUrls = trimmedUrls.slice(0, -1);
  }

  const mergedMetadata = {
    ...base,
    dashboard: {
      ...dashboard,
      brandReferenceImages: {},
    },
  };
  return { urls: [], mergedMetadata };
}

/** Speichert Referenzbilder in User-Metadata (serverseitig, ohne grosses Client-Payload). */
export async function persistBrandReferencesForUser(params: {
  supabase: { auth: { updateUser: (args: { data: Record<string, unknown> }) => Promise<{ error: Error | null }> } };
  userMetadata: unknown;
  origin: string;
  images: Array<{ base64: string; mime: string }>;
}): Promise<string[]> {
  if (params.images.length === 0) return [];

  const persisted = await persistBrandReferenceImages({
    userMetadata: params.userMetadata,
    origin: params.origin,
    images: params.images,
  });

  const { error } = await params.supabase.auth.updateUser({ data: persisted.mergedMetadata });
  if (error) {
    throw new Error("Referenzbilder konnten nicht gespeichert werden.");
  }

  return persisted.urls;
}

export function getSortedBrandReferenceStoreEntries(
  userMetadata: unknown,
): Array<{ id: string; entry: StoredBrandReferenceImage }> {
  const store = getBrandReferenceStore(userMetadata);
  return Object.entries(store)
    .sort((a, b) => a[1].createdAt.localeCompare(b[1].createdAt))
    .map(([id, entry]) => ({ id, entry }));
}

export function listBrandReferenceUrlsFromStore(userMetadata: unknown, origin: string): string[] {
  return getSortedBrandReferenceStoreEntries(userMetadata).map(({ id }) => buildBrandReferenceImageUrl(origin, id));
}

export function coalesceBrandReferenceUrls(userMetadata: unknown, origin: string, urls: string[]): string[] {
  const stored = listBrandReferenceUrlsFromStore(userMetadata, origin);
  const hasLegacy = urls.some(isLegacyKieTempUrl);
  if (!hasLegacy) return urls.filter(Boolean);

  if (stored.length > 0) {
    const wanted = Math.max(urls.length, 1);
    return stored.slice(0, Math.min(wanted, 10));
  }

  return urls.filter((url) => !isLegacyKieTempUrl(url));
}

export function repairBrandReferenceImageUrls(
  userMetadata: unknown,
  origin: string,
  urls: string[],
): { urls: string[]; changed: boolean } {
  const next = coalesceBrandReferenceUrls(userMetadata, origin, urls);
  const changed = next.length !== urls.length || next.some((url, index) => url !== urls[index]);
  return { urls: next, changed };
}

export const LEGACY_REFERENCE_IMAGE_ERROR =
  "Deine Marken-Referenzbilder sind abgelaufen. Bitte oeffne „Markenprofil“ in der Sidebar und scanne deine Website erneut.";

export function readBrandReferenceImageBuffer(
  userMetadata: unknown,
  id: string,
): { buffer: Buffer; mime: string } | null {
  const entry = getBrandReferenceStore(userMetadata)[id];
  if (!entry) return null;
  return { buffer: Buffer.from(entry.base64, "base64"), mime: entry.mime };
}

export function createBrandReferenceUrlResolver(userMetadata: unknown): (url: string, index?: number) => Promise<Buffer | null> {
  const sortedEntries = getSortedBrandReferenceStoreEntries(userMetadata);

  return async (url: string, index = 0) => {
    const id = parseBrandReferenceIdFromUrl(url);
    if (id) {
      const entry = readBrandReferenceImageBuffer(userMetadata, id);
      return entry?.buffer ?? null;
    }

    if (isLegacyKieTempUrl(url)) {
      const fallback = sortedEntries[index]?.entry ?? sortedEntries[0]?.entry;
      if (fallback) return Buffer.from(fallback.base64, "base64");
      return null;
    }

    return null;
  };
}

export function isLegacyKieTempUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.includes("redpandaai.co") || host.includes("tempfile.");
  } catch {
    return false;
  }
}
