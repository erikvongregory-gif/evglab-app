import Anthropic from "@anthropic-ai/sdk";
import { isProviderError, withProviderRetry } from "@/lib/ai/providerRequest";

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
  let status: number | undefined;
  let message: string;

  if (isProviderError(error)) {
    status = error.classified.providerStatus ?? undefined;
    message = error.classified.rawMessage;
  } else {
    if (error && typeof error === "object") {
      status = (error as { status?: number }).status;
      const nestedType = (error as { error?: { type?: string } }).error?.type;
      if (nestedType === "not_found_error") return true;
    }
    message = error instanceof Error ? error.message : String(error);
  }

  if (status === 404) return true;
  const m = message.toLowerCase();
  return (
    m.includes("not_found") ||
    m.includes("not found") ||
    m.includes("not_found_error") ||
    (m.includes("404") && m.includes("model"))
  );
}

/**
 * Tries `messages.create` with each candidate until one succeeds. Unknown models
 * (404) fall through to the next candidate; transient failures (429, 5xx,
 * timeouts) are retried with backoff before the candidate is given up on.
 */
export async function createAnthropicMessageWithModelFallback(
  client: Anthropic,
  paramsWithoutModel: Omit<Anthropic.Messages.MessageCreateParams, "model">,
): Promise<Anthropic.Messages.Message> {
  let lastError: unknown;
  for (const model of getAnthropicModelCandidates()) {
    try {
      return await withProviderRetry(
        "anthropic",
        () =>
          client.messages.create({
            ...paramsWithoutModel,
            model,
            stream: false,
          }),
        { label: `messages:${model}` },
      );
    } catch (error) {
      lastError = error;
      if (isModelNotFoundError(error)) continue;
      throw error;
    }
  }
  if (lastError instanceof Error) throw lastError;
  throw new Error("Kein Claude-Modell verfuegbar.");
}
