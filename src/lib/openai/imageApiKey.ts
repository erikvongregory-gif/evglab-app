/** Aktiver Bildgenerierungs-Key (scoped Project/Service-Account-Key). */
export const OPENAI_IMAGE_KEY_ENV = "OPENAI_IMAGE_API_KEY";

/** Legacy-Fallback bis Vercel vollständig umgestellt ist. */
export const LEGACY_OPENAI_KEY_ENV = "OPENAI_API_KEY";

export function getOpenAiImageApiKey(): string | null {
  const primary = process.env[OPENAI_IMAGE_KEY_ENV]?.trim();
  if (primary) return primary;
  return process.env[LEGACY_OPENAI_KEY_ENV]?.trim() || null;
}

export function requireOpenAiImageApiKey(): string {
  const key = getOpenAiImageApiKey();
  if (!key) {
    throw new Error(`${OPENAI_IMAGE_KEY_ENV} fehlt.`);
  }
  return key;
}
