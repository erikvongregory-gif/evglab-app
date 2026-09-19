export type ClientBillingState = {
  plan: string | null;
  monthlyTokens: number;
  usedTokens: number;
  remainingTokens: number;
  status: string;
  unlimited?: boolean;
  freeTrialImageUsed?: boolean;
  onboardingBonusClaimed?: boolean;
};

/** Kurzzeit-Cache: Token-Ring und Dashboard teilen denselben Snapshot. */
const STALE_MS = 30_000;

type CacheEntry = {
  state: ClientBillingState | null;
  at: number;
};

let cache: CacheEntry | null = null;
let inflight: Promise<ClientBillingState | null> | null = null;

export function peekBillingCredits(): ClientBillingState | null {
  return cache?.state ?? null;
}

export function setBillingCredits(state: ClientBillingState | null): void {
  cache = { state, at: Date.now() };
}

export function invalidateBillingCredits(): void {
  cache = null;
  inflight = null;
}

async function fetchBillingStateFromApi(): Promise<ClientBillingState | null> {
  try {
    const res = await fetch("/api/billing/state", { cache: "no-store", credentials: "include" });
    if (!res.ok) return null;
    const json = (await res.json()) as { state?: ClientBillingState };
    return json.state ?? null;
  } catch {
    return null;
  }
}

/**
 * Ein Netzwerk-Request für alle UI-Konsumenten.
 * `force` umgeht den Kurzzeit-Cache (Kauf, Generation, Reparatur).
 */
export async function loadBillingCredits(options?: {
  force?: boolean;
}): Promise<ClientBillingState | null> {
  if (!options?.force && cache && Date.now() - cache.at < STALE_MS) {
    return cache.state;
  }
  if (inflight) return inflight;

  inflight = fetchBillingStateFromApi()
    .then((state) => {
      setBillingCredits(state);
      return state;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}
