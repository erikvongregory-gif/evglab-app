export type ClientBillingState = {
  plan: string | null;
  monthlyTokens: number;
  usedTokens: number;
  remainingTokens: number;
  status: string;
};

export async function fetchBillingState(): Promise<ClientBillingState | null> {
  try {
    const res = await fetch("/api/billing/state", { cache: "no-store", credentials: "include" });
    if (!res.ok) return null;
    const json = (await res.json()) as { state?: ClientBillingState };
    return json.state ?? null;
  } catch {
    return null;
  }
}

export async function syncBillingFromClient(): Promise<void> {
  try {
    await fetch("/api/billing/sync", { method: "POST", cache: "no-store", credentials: "include" });
  } catch {
    /* Netzwerkfehler ignorieren */
  }
}

export async function confirmBillingSession(sessionId: string): Promise<void> {
  try {
    await fetch("/api/billing/confirm-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ sessionId }),
    });
  } catch {
    /* Webhook bleibt Fallback */
  }
}

function cleanBillingQueryParams() {
  if (typeof window === "undefined") return;
  const cleaned = new URL(window.location.href);
  cleaned.searchParams.delete("billing");
  cleaned.searchParams.delete("session_id");
  window.history.replaceState({}, "", cleaned.toString());
}

async function waitForActiveBilling(): Promise<ClientBillingState | null> {
  for (let i = 0; i < 8; i += 1) {
    const state = await fetchBillingState();
    if (state?.plan && state.status !== "none" && state.status !== "canceled") {
      return state;
    }
    if (i === 3 || i === 6) {
      await syncBillingFromClient();
    }
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }
  return fetchBillingState();
}

/** Nach Checkout-Redirect und bei leerer DB: Stripe-Sync + Session bestätigen. */
export async function runBillingBootstrap(): Promise<ClientBillingState | null> {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  const billing = params.get("billing");
  const sessionId = params.get("session_id");

  if (billing === "success" && sessionId) {
    await confirmBillingSession(sessionId);
    const state = await waitForActiveBilling();
    cleanBillingQueryParams();
    window.dispatchEvent(new CustomEvent("evglab-billing-updated"));
    return state;
  }

  if (billing === "success_tokens" && sessionId) {
    await confirmBillingSession(sessionId);
    await syncBillingFromClient();
    cleanBillingQueryParams();
    window.dispatchEvent(new CustomEvent("evglab-billing-updated"));
    return fetchBillingState();
  }

  if (billing === "cancel_tokens" || billing === "cancel") {
    cleanBillingQueryParams();
  }

  let state = await fetchBillingState();
  if (!state?.plan || state.status === "none" || state.status === "canceled") {
    await syncBillingFromClient();
    state = await fetchBillingState();
  } else {
    await syncBillingFromClient();
    state = await fetchBillingState();
  }

  if (state) {
    window.dispatchEvent(new CustomEvent("evglab-billing-updated"));
  }
  return state;
}
