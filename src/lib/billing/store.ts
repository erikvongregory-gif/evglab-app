import { OWNER_TOKEN_ALLOWANCE, isOwnerUserId } from "@/lib/auth/owner";
import { SUBSCRIPTION_PLAN_TOKENS, type SubscriptionPlanKey } from "@/lib/billing/tokenState";
import { createAdminClient } from "@/lib/supabase/admin";

export type BillingStatus = "active" | "trialing" | "past_due" | "canceled" | "incomplete" | "unpaid" | "none";

export type BillingRow = {
  user_id: string;
  plan: SubscriptionPlanKey | null;
  monthly_tokens: number;
  used_tokens: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: BillingStatus;
  current_period_end: string | null;
};

type StripeEventClaimRow = {
  event_id: string;
  event_type: string;
  status: "processing" | "processed";
  processed_at?: string | null;
};

/**
 * Wenn die Dedupe-Tabelle in Prod fehlt, wollen wir das laut hoeren statt still
 * weiterzumachen. In Dev/Local ist Toleranz gegenueber `42P01` (table missing)
 * praktisch fuer schnelle Iteration ohne Migration.
 */
function isUndefinedTableTolerated(): boolean {
  return process.env.NODE_ENV !== "production";
}

function normalizeBillingStatus(status: string | null | undefined): BillingStatus {
  const allowed: BillingStatus[] = ["active", "trialing", "past_due", "canceled", "incomplete", "unpaid", "none"];
  if (status && allowed.includes(status as BillingStatus)) return status as BillingStatus;
  return "incomplete";
}

export async function ensureBillingRow(userId: string) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("billing_subscriptions")
    .upsert(
      {
        user_id: userId,
        plan: null,
        monthly_tokens: 0,
        used_tokens: 0,
        subscription_status: "none",
      },
      { onConflict: "user_id", ignoreDuplicates: true },
    );
  if (error) {
    throw new Error(`ensureBillingRow fehlgeschlagen: ${error.message}`);
  }
}

export async function getBillingRow(userId: string): Promise<BillingRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("billing_subscriptions")
    .select("user_id,plan,monthly_tokens,used_tokens,stripe_customer_id,stripe_subscription_id,subscription_status,current_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as BillingRow | null) ?? null;
}

export async function setStripeCustomerId(userId: string, customerId: string) {
  const admin = createAdminClient();
  const { error } = await admin.from("billing_subscriptions").update({ stripe_customer_id: customerId }).eq("user_id", userId);
  if (error) {
    throw new Error(`setStripeCustomerId fehlgeschlagen: ${error.message}`);
  }
}

export async function activatePlanForUser(args: {
  userId: string;
  plan: SubscriptionPlanKey;
  subscriptionStatus: BillingStatus;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  currentPeriodEnd: string | null;
}) {
  const { error } = await createAdminClient().rpc("billing_activate_plan_atomic", {
    p_user_id: args.userId,
    p_plan: args.plan,
    p_allowance: SUBSCRIPTION_PLAN_TOKENS[args.plan],
    p_status: normalizeBillingStatus(args.subscriptionStatus),
    p_customer_id: args.stripeCustomerId,
    p_subscription_id: args.stripeSubscriptionId,
    p_period_end: args.currentPeriodEnd,
  });
  if (error) throw new Error(`activatePlanForUser fehlgeschlagen: ${error.message}`);
}

export async function cancelBillingSubscription(subscriptionId: string, periodEnd: string | null) {
  const { error } = await createAdminClient().rpc("billing_cancel_subscription_atomic", {
    p_subscription_id: subscriptionId, p_period_end: periodEnd,
  });
  if (error) throw new Error(error.message);
}

export async function getByStripeCustomerId(customerId: string): Promise<BillingRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("billing_subscriptions")
    .select("user_id,plan,monthly_tokens,used_tokens,stripe_customer_id,stripe_subscription_id,subscription_status,current_period_end")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return (data as BillingRow | null) ?? null;
}

export async function getByStripeSubscriptionId(subscriptionId: string): Promise<BillingRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("billing_subscriptions")
    .select("user_id,plan,monthly_tokens,used_tokens,stripe_customer_id,stripe_subscription_id,subscription_status,current_period_end")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();
  return (data as BillingRow | null) ?? null;
}

/** Erneuert das Monatskontingent einmal je Periode; nur ungenutzte Extras bleiben erhalten. */
export async function renewBillingPeriodTokens(args: {
  stripeSubscriptionId: string;
  currentPeriodEnd: string | null;
}) {
  const { error } = await createAdminClient().rpc("billing_renew_period_atomic", {
    p_subscription_id: args.stripeSubscriptionId, p_period_end: args.currentPeriodEnd,
  });
  if (error) throw new Error(`Token-Verlängerung fehlgeschlagen: ${error.message}`);
}

/** Synthetischer Billing-Stand für Owner-Konten — kein Stripe-Abo, kein Verbrauch. */
export function buildOwnerBillingRow(userId: string): BillingRow {
  return {
    user_id: userId,
    plan: "pro",
    monthly_tokens: OWNER_TOKEN_ALLOWANCE,
    used_tokens: 0,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    subscription_status: "active",
    current_period_end: null,
  };
}

/**
 * Wie `getBillingRow`, aber Owner-Konten bekommen einen unbegrenzten Stand.
 * In Generierungs-Routen statt `getBillingRow` verwenden, damit die
 * Guthaben-Vorprüfung Owner nicht blockiert.
 */
export async function getEffectiveBillingRow(userId: string): Promise<BillingRow | null> {
  if (await isOwnerUserId(userId)) return buildOwnerBillingRow(userId);
  return getBillingRow(userId);
}

async function adjustTokens(userId: string, amount: number, operation: "consume" | "refund" | "add") {
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 2_147_483_647) {
    return { ok: false as const, error: "Ungültige Token-Anzahl." };
  }
  if (operation !== "add" && await isOwnerUserId(userId)) {
    return { ok: true as const, state: buildOwnerBillingRow(userId) };
  }
  const { data, error } = await createAdminClient().rpc("billing_adjust_tokens_atomic", {
    p_user_id: userId, p_amount: amount, p_operation: operation,
  });
  if (error) return { ok: false as const, error: error.message as string };
  const state = (Array.isArray(data) ? data[0] : null) as BillingRow | null;
  if (!state) return { ok: false as const, error: "Kein Billing-Profil vorhanden." };
  return { ok: true as const, state };
}

export async function consumeTokens(userId: string, amount: number) {
  return adjustTokens(userId, amount, "consume");
}

export async function refundTokens(userId: string, amount: number) {
  return adjustTokens(userId, amount, "refund");
}

export async function addMonthlyTokens(userId: string, amount: number) {
  return adjustTokens(userId, amount, "add");
}

/** Checkout deduplication and credit are one DB transaction. Throws on failure. */
export async function grantTokenPackSession(args: {
  sessionId: string;
  userId: string;
  packId: string;
  tokens: number;
  source: "confirm_session" | "webhook";
}): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("billing_grant_token_pack_atomic", {
    p_session_id: args.sessionId, p_user_id: args.userId, p_pack_id: args.packId,
    p_tokens: args.tokens, p_source: args.source,
  });
  if (error) throw new Error(`Token-Gutschrift fehlgeschlagen: ${error.message}`);
  if (typeof data !== "boolean") throw new Error("Ungültiges Ergebnis der Token-Gutschrift.");
  return data;
}

export async function claimStripeWebhookEvent(eventId: string, eventType: string): Promise<boolean> {
  const admin = createAdminClient();
  const { error } = await admin.from("stripe_webhook_events").insert({
    event_id: eventId,
    event_type: eventType,
    status: "processing",
  } satisfies StripeEventClaimRow);
  if (!error) return true;
  // Fallback fuer Umgebungen ohne Migration der Dedupe-Tabelle - nur in Dev tolerieren.
  if (error.code === "42P01" && isUndefinedTableTolerated()) return true;
  if (error.code === "23505") return false;
  throw new Error(`claimStripeWebhookEvent fehlgeschlagen: ${error.message}`);
}

export async function markStripeWebhookEventProcessed(eventId: string) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("stripe_webhook_events")
    .update({ status: "processed", processed_at: new Date().toISOString() })
    .eq("event_id", eventId);
  if (error && !(error.code === "42P01" && isUndefinedTableTolerated())) {
    throw new Error(`markStripeWebhookEventProcessed fehlgeschlagen: ${error.message}`);
  }
}

export async function releaseStripeWebhookEvent(eventId: string) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("stripe_webhook_events")
    .delete()
    .eq("event_id", eventId)
    .eq("status", "processing");
  if (error && !(error.code === "42P01" && isUndefinedTableTolerated())) {
    throw new Error(`releaseStripeWebhookEvent fehlgeschlagen: ${error.message}`);
  }
}
