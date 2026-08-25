import { NextResponse } from "next/server";
import {
  type AiProvider,
  type ClassifiedProviderError,
  classifyThrownProviderError,
} from "@/lib/ai/providerErrors";

/** Fehler mit fertiger Klassifikation — Routen koennen daraus direkt antworten. */
export class ProviderError extends Error {
  readonly classified: ClassifiedProviderError;

  constructor(classified: ClassifiedProviderError) {
    super(classified.rawMessage || classified.userMessage);
    this.name = "ProviderError";
    this.classified = classified;
  }
}

export function isProviderError(error: unknown): error is ProviderError {
  return error instanceof ProviderError;
}

/** Einheitliche API-Antwort fuer Provider-Fehler. */
export function providerErrorResponse(error: ClassifiedProviderError): NextResponse {
  return NextResponse.json(
    {
      error: error.userMessage,
      code: error.code,
      provider: error.provider,
      retryable: error.retryable,
      ...(error.retryAfterMs ? { retryAfterMs: error.retryAfterMs } : {}),
    },
    {
      status: error.httpStatus,
      headers: error.retryAfterMs
        ? { "Retry-After": String(Math.ceil(error.retryAfterMs / 1000)) }
        : undefined,
    },
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fuehrt einen Provider-Call aus und wiederholt ihn bei vorübergehenden
 * Fehlern (429, 5xx, Timeout) mit exponentiellem Backoff plus Jitter.
 * Quota-, Auth- und Eingabefehler werden nicht wiederholt — das kostet nur Zeit.
 * Am Ende wird immer ein `ProviderError` geworfen.
 */
export async function withProviderRetry<T>(
  provider: AiProvider,
  operation: () => Promise<T>,
  options?: { attempts?: number; label?: string },
): Promise<T> {
  const attempts = Math.max(options?.attempts ?? 3, 1);
  let lastClassified: ClassifiedProviderError | null = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const classified = isProviderError(error)
        ? error.classified
        : classifyThrownProviderError(provider, error);
      lastClassified = classified;

      const isLastAttempt = attempt === attempts;
      if (!classified.retryable || isLastAttempt) {
        logProviderFailure(classified, { attempt, attempts, label: options?.label });
        throw new ProviderError(classified);
      }

      const backoff = (classified.retryAfterMs ?? 2_000) * 2 ** (attempt - 1);
      const jitter = Math.random() * 400;
      await sleep(Math.min(backoff + jitter, 15_000));
    }
  }

  throw new ProviderError(
    lastClassified ?? classifyThrownProviderError(provider, new Error("Unbekannter Provider-Fehler")),
  );
}

export function logProviderFailure(
  classified: ClassifiedProviderError,
  context?: { attempt?: number; attempts?: number; label?: string; userId?: string },
) {
  const record = {
    ts: new Date().toISOString(),
    domain: "ai-provider",
    provider: classified.provider,
    code: classified.code,
    httpStatus: classified.httpStatus,
    retryable: classified.retryable,
    providerFault: classified.providerFault,
    label: context?.label,
    attempt: context?.attempt,
    attempts: context?.attempts,
    userId: context?.userId,
    message: classified.rawMessage.slice(0, 400),
  };
  // Quota- und Auth-Fehler blockieren das Produkt fuer alle Nutzer — als error
  // loggen, damit sie in Vercel-Alerts auffallen.
  const line = JSON.stringify(record);
  if (classified.code === "provider_quota_exhausted" || classified.code === "provider_auth_failed") {
    console.error(line);
    return;
  }
  console.warn(line);
}
