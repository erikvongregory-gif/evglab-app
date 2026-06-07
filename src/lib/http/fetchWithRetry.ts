export function isTransientFetchError(error: unknown): boolean {
  return error instanceof TypeError && /failed to fetch|networkerror|load failed/i.test(error.message);
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export type FetchWithRetryOptions = {
  retries?: number;
  baseDelayMs?: number;
};

/**
 * Fetch mit Retry bei Netzwerkabbruch und kurzzeitigen Serverfehlern (5xx/429).
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  options: FetchWithRetryOptions = {},
): Promise<Response> {
  const retries = options.retries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 1000;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, init);
      if (isRetryableStatus(response.status) && attempt < retries) {
        await delay(baseDelayMs * (attempt + 1));
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (!isTransientFetchError(error) || attempt >= retries) throw error;
      await delay(baseDelayMs * (attempt + 1));
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error("Anfrage fehlgeschlagen.");
}
