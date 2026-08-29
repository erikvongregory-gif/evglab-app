import type { BillingReceiptData } from "@/components/ui/billing-receipt-printer";

export type ClientBillingState = {
  plan: string | null;
  monthlyTokens: number;
  usedTokens: number;
  remainingTokens: number;
  status: string;
};

export type BillingBootstrapResult = {
  state: ClientBillingState | null;
  receipt: BillingReceiptData | null;
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

type ConfirmSessionResponse = {
  ok?: boolean;
  error?: string;
  receipt?: Omit<BillingReceiptData, "preview" | "dateLabel"> & { dateLabel?: string };
  state?: ClientBillingState | null;
};

export async function confirmBillingSession(
  sessionId: string,
): Promise<{ ok: boolean; receipt: BillingReceiptData | null; state: ClientBillingState | null }> {
  try {
    const res = await fetch("/api/billing/confirm-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ sessionId }),
    });
    const json = (await res.json().catch(() => null)) as ConfirmSessionResponse | null;
    if (!res.ok || !json?.ok) {
      return { ok: false, receipt: null, state: null };
    }
    const receipt = json.receipt
      ? {
          ...json.receipt,
          dateLabel: json.receipt.dateLabel ?? new Date().toLocaleString("de-DE"),
          preview: false,
        }
      : null;
    return { ok: true, receipt, state: json.state ?? null };
  } catch {
    /* Webhook bleibt Fallback */
    return { ok: false, receipt: null, state: null };
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
export async function runBillingBootstrap(): Promise<BillingBootstrapResult> {
  if (typeof window === "undefined") return { state: null, receipt: null };

  const params = new URLSearchParams(window.location.search);
  const billing = params.get("billing");
  const sessionId = params.get("session_id");

  if (billing === "success" && sessionId) {
    const confirmed = await confirmBillingSession(sessionId);
    const state = confirmed.state ?? (await waitForActiveBilling());
    cleanBillingQueryParams();
    window.dispatchEvent(new CustomEvent("evglab-billing-updated"));
    if (confirmed.ok && confirmed.receipt) {
      window.dispatchEvent(new CustomEvent("evglab-billing-receipt", { detail: confirmed.receipt }));
    }
    return { state, receipt: confirmed.ok ? confirmed.receipt : null };
  }

  if (billing === "success_tokens" && sessionId) {
    const confirmed = await confirmBillingSession(sessionId);
    await syncBillingFromClient();
    cleanBillingQueryParams();
    window.dispatchEvent(new CustomEvent("evglab-billing-updated"));
    if (confirmed.ok && confirmed.receipt) {
      window.dispatchEvent(new CustomEvent("evglab-billing-receipt", { detail: confirmed.receipt }));
    }
    return {
      state: confirmed.state ?? (await fetchBillingState()),
      receipt: confirmed.ok ? confirmed.receipt : null,
    };
  }

  if (billing === "cancel_tokens" || billing === "cancel") {
    cleanBillingQueryParams();
  }

  // Fake success query without session must never show a receipt.
  if ((billing === "success" || billing === "success_tokens") && !sessionId) {
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
  return { state, receipt: null };
}
