import Anthropic from "@anthropic-ai/sdk";

/**
 * Anthropic deprecates `-latest` aliases; use dated / major-version IDs and fall back on 404.
 * Order: env override first, then newer Sonnet, then pinned 3.5, then Haiku.
 */
const ANTHROPIC_MODEL_FALLBACKS = [
  "claude-sonnet-4-20250514",
  "claude-3-5-sonnet-20241022",
  "claude-3-5-haiku-20241022",
] as const;

export function getAnthropicModelCandidates(): string[] {
  const env = process.env.ANTHROPIC_MODEL?.trim();
  return Array.from(new Set([...(env ? [env] : []), ...ANTHROPIC_MODEL_FALLBACKS]));
}

function isModelNotFoundError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("not_found") || m.includes("not found") || (m.includes("404") && m.includes("model"));
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
      const msg = error instanceof Error ? error.message : String(error);
      if (isModelNotFoundError(msg)) continue;
      throw error;
    }
  }
  if (lastError instanceof Error) throw lastError;
  throw new Error("Kein Claude-Modell verfuegbar.");
}
