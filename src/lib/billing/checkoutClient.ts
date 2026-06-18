import type { BillingInterval } from "@/lib/billing/planCatalog";
import type { SubscriptionPlanKey } from "@/lib/billing/tokenState";

export type BillingCheckoutResult =
  | { ok: true }
  | { ok: false; error: string; redirected?: boolean };

export function getHomepageCheckoutPlan(params: URLSearchParams): SubscriptionPlanKey | null {
  const plan = params.get("plan");
  const checkout = params.get("checkout");
  const source = params.get("source");
  const isValidPlan = plan === "start" || plan === "growth" || plan === "pro";
  if (!isValidPlan || checkout !== "1" || source !== "homepage_pricing") return null;
  return plan;
}

export function clearHomepageCheckoutParams(params: URLSearchParams) {
  params.delete("plan");
  params.delete("checkout");
  params.delete("source");
}

export function buildHomepageCheckoutSearchParams(plan: SubscriptionPlanKey): URLSearchParams {
  return new URLSearchParams({
    plan,
    checkout: "1",
    source: "homepage_pricing",
  });
}

export function buildAnmeldenUrlForHomepageCheckout(plan: SubscriptionPlanKey): string {
  const params = buildHomepageCheckoutSearchParams(plan);
  return `/anmelden?${params.toString()}`;
}

export function buildDashboardUrlForHomepageCheckout(plan: SubscriptionPlanKey): string {
  const params = buildHomepageCheckoutSearchParams(plan);
  params.set("tab", "pricing");
  return `/dashboard?${params.toString()}`;
}

export async function startBillingCheckout(args: {
  plan: SubscriptionPlanKey;
  interval?: BillingInterval;
}): Promise<BillingCheckoutResult> {
  const res = await fetch("/api/billing/checkout", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ plan: args.plan, interval: args.interval ?? "yearly" }),
  });
  const json = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;

  if (res.status === 401) {
    window.location.href = buildAnmeldenUrlForHomepageCheckout(args.plan);
    return { ok: false, error: "Anmeldung erforderlich.", redirected: true };
  }
  if (!res.ok || !json?.url) {
    return { ok: false, error: json?.error ?? "Checkout konnte nicht gestartet werden." };
  }

  window.location.href = json.url;
  return { ok: true };
}
