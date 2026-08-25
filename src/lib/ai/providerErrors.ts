/**
 * Einheitliche Klassifikation von KI-Provider-Fehlern.
 *
 * Ziel: der Endnutzer sieht nie eine rohe englische Provider-Meldung, und der
 * Aufrufer weiss, ob ein erneuter Versuch sinnvoll ist. Wichtig fuer das
 * Billing: `retryable` heisst "Provider-Problem", nicht "Nutzerfehler" — in
 * diesen Faellen duerfen keine Tokens abgebucht werden.
 */

export type AiProvider = "openai" | "anthropic" | "kie" | "photoroom" | "removebg";

export type ProviderErrorCode =
  | "provider_quota_exhausted"
  | "provider_rate_limited"
  | "provider_auth_failed"
  | "provider_content_rejected"
  | "provider_bad_request"
  | "provider_timeout"
  | "provider_unavailable"
  | "provider_unknown";

export type ClassifiedProviderError = {
  provider: AiProvider;
  code: ProviderErrorCode;
  /** Deutsche Meldung fuer die UI. */
  userMessage: string;
  /** HTTP-Status, den unsere API zurueckgeben soll. */
  httpStatus: number;
  /** Erneuter Versuch derselben Anfrage kann helfen. */
  retryable: boolean;
  /** Ursache liegt beim Provider/Konto, nicht bei der Nutzereingabe. */
  providerFault: boolean;
  retryAfterMs?: number;
  /** HTTP-Status des Providers, falls bekannt — fuer Logs und Sonderfaelle. */
  providerStatus: number | null;
  /** Originalmeldung — nur fuer Logs, nicht fuer die UI. */
  rawMessage: string;
};

const PROVIDER_LABEL: Record<AiProvider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  kie: "Kie.ai",
  photoroom: "Photoroom",
  removebg: "remove.bg",
};

function quotaMessage(provider: AiProvider): string {
  return `Das ${PROVIDER_LABEL[provider]}-Guthaben von BrewAI ist erschöpft. Deine Tokens wurden nicht belastet. Wir sind schon dran — bitte versuch es in wenigen Minuten erneut.`;
}

function matches(haystack: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(haystack));
}

function parseRetryAfterMs(retryAfter: string | null | undefined): number | undefined {
  if (!retryAfter) return undefined;
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 60_000);
  const asDate = Date.parse(retryAfter);
  if (Number.isFinite(asDate)) {
    return Math.min(Math.max(asDate - Date.now(), 0), 60_000);
  }
  return undefined;
}

/**
 * Klassifiziert anhand von HTTP-Status und Fehlertext. Beides ist optional,
 * weil manche SDKs nur eine Message werfen.
 */
export function classifyProviderError(input: {
  provider: AiProvider;
  status?: number | null;
  message?: string | null;
  code?: string | null;
  retryAfter?: string | null;
}): ClassifiedProviderError {
  const { provider } = input;
  const rawMessage = (input.message ?? "").trim();
  const haystack = `${input.code ?? ""} ${rawMessage}`.toLowerCase();
  const status = input.status ?? null;
  const retryAfterMs = parseRetryAfterMs(input.retryAfter);
  const base = { provider, rawMessage, providerStatus: status } as const;

  // Achtung: OpenAI meldet erschoepfte Spend-Limits als HTTP 429. Diese Muster
  // muessen VOR der Rate-Limit-Pruefung greifen, sonst wiederholen wir
  // Anfragen, die ohnehin nicht durchgehen koennen.
  const quotaPatterns = [
    /insufficient_quota/,
    /insufficient[_\s]balance/,
    /exceeded your current quota/,
    /billing_hard_limit_reached/,
    /billing hard limit/,
    /credit_balance_exhausted/,
    /credit balance is too low/,
    /organization_spend_limit_exceeded/,
    /project_spend_limit_exceeded/,
    /organization_usage_limit_exceeded/,
    /quota exceeded/,
    /out of credits?/,
    /no credits?\b/,
    /payment required/,
    /add funds/,
    /insufficient funds/,
  ];
  if (matches(haystack, quotaPatterns) || status === 402) {
    return {
      ...base,
      code: "provider_quota_exhausted",
      userMessage: quotaMessage(provider),
      httpStatus: 503,
      retryable: false,
      providerFault: true,
    };
  }

  if (status === 429 || matches(haystack, [/rate limit/, /too many requests/, /overloaded/])) {
    return {
      ...base,
      code: "provider_rate_limited",
      userMessage: `${PROVIDER_LABEL[provider]} ist gerade überlastet. Wir versuchen es automatisch erneut — bitte einen Moment Geduld.`,
      httpStatus: 429,
      retryable: true,
      providerFault: true,
      retryAfterMs: retryAfterMs ?? 4_000,
    };
  }

  if (status === 401 || status === 403 || matches(haystack, [/invalid api key/, /incorrect api key/, /unauthorized/, /authentication/])) {
    return {
      ...base,
      code: "provider_auth_failed",
      userMessage: `Die Verbindung zu ${PROVIDER_LABEL[provider]} ist nicht autorisiert. Das ist ein Konfigurationsfehler auf unserer Seite — wir kümmern uns darum.`,
      httpStatus: 503,
      retryable: false,
      providerFault: true,
    };
  }

  if (matches(haystack, [/content[_\s]policy/, /safety system/, /moderation/, /flagged/, /rejected as a result of/])) {
    return {
      ...base,
      code: "provider_content_rejected",
      userMessage:
        "Der Inhaltsfilter des Bildmodells hat diese Anfrage blockiert. Formuliere den Prompt etwas neutraler oder wähle ein anderes Motiv.",
      httpStatus: 422,
      retryable: false,
      providerFault: false,
    };
  }

  if (matches(haystack, [/timed? ?out/, /timeout/, /etimedout/, /aborted/]) || status === 408 || status === 504) {
    return {
      ...base,
      code: "provider_timeout",
      userMessage: `${PROVIDER_LABEL[provider]} hat zu lange gebraucht. Bitte versuch es noch einmal.`,
      httpStatus: 504,
      retryable: true,
      providerFault: true,
      retryAfterMs: retryAfterMs ?? 2_000,
    };
  }

  if (status !== null && status >= 500) {
    return {
      ...base,
      code: "provider_unavailable",
      userMessage: `${PROVIDER_LABEL[provider]} ist vorübergehend nicht erreichbar. Wir versuchen es automatisch erneut.`,
      httpStatus: 503,
      retryable: true,
      providerFault: true,
      retryAfterMs: retryAfterMs ?? 3_000,
    };
  }

  if (status !== null && status >= 400) {
    return {
      ...base,
      code: "provider_bad_request",
      userMessage: "Die Anfrage wurde vom Bildmodell abgelehnt. Bitte prüf deine Eingaben und versuch es erneut.",
      httpStatus: 400,
      retryable: false,
      providerFault: false,
    };
  }

  return {
    ...base,
    code: "provider_unknown",
    userMessage: `Die Generierung ist an einem Fehler bei ${PROVIDER_LABEL[provider]} gescheitert. Bitte versuch es erneut.`,
    httpStatus: 502,
    retryable: true,
    providerFault: true,
    retryAfterMs: 2_000,
  };
}

type MaybeSdkError = {
  status?: unknown;
  statusCode?: unknown;
  code?: unknown;
  message?: unknown;
  error?: { message?: unknown; code?: unknown; type?: unknown };
  headers?: { get?: (name: string) => string | null };
};

/** Klassifiziert einen geworfenen Fehler (fetch-Reject, SDK-Error, Error). */
export function classifyThrownProviderError(provider: AiProvider, error: unknown): ClassifiedProviderError {
  const candidate = (error ?? {}) as MaybeSdkError;
  const statusRaw = candidate.status ?? candidate.statusCode;
  const status = typeof statusRaw === "number" ? statusRaw : null;
  const nestedMessage = typeof candidate.error?.message === "string" ? candidate.error.message : null;
  const message =
    nestedMessage ?? (typeof candidate.message === "string" ? candidate.message : String(error ?? ""));
  const code =
    (typeof candidate.error?.code === "string" ? candidate.error.code : null) ??
    (typeof candidate.error?.type === "string" ? candidate.error.type : null) ??
    (typeof candidate.code === "string" ? candidate.code : null);
  const retryAfter = candidate.headers?.get?.("retry-after") ?? null;
  return classifyProviderError({ provider, status, message, code, retryAfter });
}

/** Klassifiziert eine fehlgeschlagene `fetch`-Antwort samt geparstem JSON-Body. */
export function classifyProviderResponse(
  provider: AiProvider,
  response: { status: number; headers?: Headers },
  payload?: unknown,
): ClassifiedProviderError {
  const body = (payload ?? {}) as Record<string, unknown>;
  const errorObject = (body.error ?? {}) as Record<string, unknown>;
  const message =
    (typeof errorObject.message === "string" ? errorObject.message : null) ??
    (typeof body.msg === "string" ? body.msg : null) ??
    (typeof body.message === "string" ? body.message : null);
  const code =
    (typeof errorObject.code === "string" ? errorObject.code : null) ??
    (typeof errorObject.type === "string" ? errorObject.type : null);
  return classifyProviderError({
    provider,
    status: response.status,
    message,
    code,
    retryAfter: response.headers?.get("retry-after") ?? null,
  });
}
