const STORAGE_KEY = "brewai-create-active-job";
const MAX_AGE_MS = 12 * 60_000;

export type ActiveGeneration = {
  requestKey: string;
  hash: string;
  jobId?: string;
  startedAt: number;
  aspectRatio?: string;
  variantCount?: number;
};

export function payloadHash(payload: unknown): string {
  return JSON.stringify(payload);
}

export function readActiveGeneration(): ActiveGeneration | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveGeneration;
    if (!parsed?.requestKey || !parsed.hash || typeof parsed.startedAt !== "number") return null;
    if (Date.now() - parsed.startedAt > MAX_AGE_MS) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeActiveGeneration(job: ActiveGeneration): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(job));
}

export function clearActiveGeneration(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}

/** Gleicher Entwurf → gleicher Schlüssel. Geänderter Entwurf → neuer Auftrag. */
export function requestKeyForPayload(hash: string): string {
  const existing = readActiveGeneration();
  if (existing && existing.hash === hash) return existing.requestKey;
  const requestKey = crypto.randomUUID();
  writeActiveGeneration({ requestKey, hash, startedAt: Date.now() });
  return requestKey;
}

export function rememberJobId(
  jobId: string,
  meta?: { aspectRatio?: string; variantCount?: number },
): void {
  const existing = readActiveGeneration();
  if (!existing) {
    writeActiveGeneration({
      requestKey: jobId,
      hash: jobId,
      jobId,
      startedAt: Date.now(),
      ...meta,
    });
    return;
  }
  writeActiveGeneration({ ...existing, jobId, ...meta });
}
