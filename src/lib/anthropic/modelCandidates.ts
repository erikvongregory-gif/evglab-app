import Anthropic from "@anthropic-ai/sdk";

/**
 * Anthropic retires dated snapshots — keep fallbacks on active models (see model deprecations docs).
 * Order: env override first, then Sonnet 4.6, Sonnet 4.5 snapshot, then Haiku 4.5.
 */
const ANTHROPIC_MODEL_FALLBACKS = [
  "claude-sonnet-4-6",
  "claude-sonnet-4-5-20250929",
  "claude-haiku-4-5-20251001",
] as const;

export function getAnthropicModelCandidates(): string[] {
  const env = process.env.ANTHROPIC_MODEL?.trim();
  return Array.from(new Set([...(env ? [env] : []), ...ANTHROPIC_MODEL_FALLBACKS]));
}

function isModelNotFoundError(error: unknown): boolean {
  if (error && typeof error === "object") {
    const status = (error as { status?: number }).status;
    if (status === 404) return true;
    const nestedType = (error as { error?: { type?: string } }).error?.type;
    if (nestedType === "not_found_error") return true;
  }
  const msg = error instanceof Error ? error.message : String(error);
  const m = msg.toLowerCase();
  return (
    m.includes("not_found") ||
    m.includes("not found") ||
    m.includes("not_found_error") ||
    (m.includes("404") && m.includes("model"))
  );
}

/**
 * Tries `messages.create` with each candidate until one succeeds.
 * On unknown model (404), continues with the next candidate; other errors are rethrown.
 */
export async function createAnthropicMessageWithModelFallback(
  client: Anthropic,
  paramsWithoutModel: Omit<Anthropic.Messages.MessageCreateParams, "model">,
): Promise<Anthropic.Messages.Message> {
  let lastError: unknown;
  for (const model of getAnthropicModelCandidates()) {
    try {
      return await client.messages.create({
        ...paramsWithoutModel,
        model,
        stream: false,
      });
    } catch (error) {
      lastError = error;
      if (isModelNotFoundError(error)) continue;
      throw error;
    }
  }
  if (lastError instanceof Error) throw lastError;
  throw new Error("Kein Claude-Modell verfuegbar.");
}
