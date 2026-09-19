import type { BillingReceiptData } from "@/components/ui/billing-receipt-printer";
import {
  loadBillingCredits,
  setBillingCredits,
  type ClientBillingState,
} from "@/lib/billing/creditsCache";

export type { ClientBillingState };

export type BillingBootstrapResult = {
  state: ClientBillingState | null;
  receipt: BillingReceiptData | null;
};

/** Öffentliche API — nutzt den gemeinsamen Credits-Cache. */
export async function fetchBillingState(options?: {
  force?: boolean;
}): Promise<ClientBillingState | null> {
  return loadBillingCredits(options);
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
    if (json.state) setBillingCredits(json.state);
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

function notifyBillingUpdated() {
  window.dispatchEvent(new CustomEvent("evglab-billing-updated"));
}

async function waitForActiveBilling(): Promise<ClientBillingState | null> {
  for (let i = 0; i < 8; i += 1) {
    const state = await loadBillingCredits({ force: true });
    if (state?.plan && state.status !== "none" && state.status !== "canceled") {
      return state;
    }
    if (i === 3 || i === 6) {
      await syncBillingFromClient();
    }
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }
  return loadBillingCredits({ force: true });
}

/**
 * Billing nach Navigation.
 * Normalfall: nur DB-State (kein Stripe).
 * Stripe-Sync: Checkout-Redirect, explizites `?billing=repair`, sonst Webhooks.
 */
export async function runBillingBootstrap(): Promise<BillingBootstrapResult> {
  if (typeof window === "undefined") return { state: null, receipt: null };

  const params = new URLSearchParams(window.location.search);
  const billing = params.get("billing");
  const sessionId = params.get("session_id");

  if (billing === "success" && sessionId) {
    const confirmed = await confirmBillingSession(sessionId);
    const state = confirmed.state ?? (await waitForActiveBilling());
    cleanBillingQueryParams();
    notifyBillingUpdated();
    if (confirmed.ok && confirmed.receipt) {
      window.dispatchEvent(new CustomEvent("evglab-billing-receipt", { detail: confirmed.receipt }));
    }
    return { state, receipt: confirmed.ok ? confirmed.receipt : null };
  }

  if (billing === "success_tokens" && sessionId) {
    const confirmed = await confirmBillingSession(sessionId);
    await syncBillingFromClient();
    cleanBillingQueryParams();
    notifyBillingUpdated();
    if (confirmed.ok && confirmed.receipt) {
      window.dispatchEvent(new CustomEvent("evglab-billing-receipt", { detail: confirmed.receipt }));
    }
    return {
      state: confirmed.state ?? (await loadBillingCredits({ force: true })),
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

  // Explizite Reparatur (Support/Deep-Link) — nicht bei none/canceled im Normalfall.
  if (billing === "repair") {
    await syncBillingFromClient();
    cleanBillingQueryParams();
    const state = await loadBillingCredits({ force: true });
    if (state) notifyBillingUpdated();
    return { state, receipt: null };
  }

  // Normaler Seitenaufruf: nur DB, kein Stripe.
  const state = await loadBillingCredits({ force: true });
  return { state, receipt: null };
}
