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
  return "active";
}

function getBaseTokensForPlan(plan: SubscriptionPlanKey | null | undefined): number {
  if (!plan) return 0;
  return SUBSCRIPTION_PLAN_TOKENS[plan] ?? 0;
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
  preserveTokenBalance?: boolean;
}) {
  const current = args.preserveTokenBalance ? await getBillingRow(args.userId) : null;
  const baseMonthly = SUBSCRIPTION_PLAN_TOKENS[args.plan];
  const purchasedExtras = current ? Math.max(current.monthly_tokens - getBaseTokensForPlan(current.plan), 0) : 0;
  const nextMonthlyTokens = current ? baseMonthly + purchasedExtras : baseMonthly;
  const nextUsedTokens = current ? current.used_tokens : 0;
  const admin = createAdminClient();
  const { error } = await admin.from("billing_subscriptions").upsert(
    {
      user_id: args.userId,
      plan: args.plan,
      monthly_tokens: nextMonthlyTokens,
      used_tokens: nextUsedTokens,
      stripe_customer_id: args.stripeCustomerId,
      stripe_subscription_id: args.stripeSubscriptionId,
      subscription_status: normalizeBillingStatus(args.subscriptionStatus),
      current_period_end: args.currentPeriodEnd,
    },
    { onConflict: "user_id" },
  );
  if (error) {
    throw new Error(`activatePlanForUser fehlgeschlagen: ${error.message}`);
  }
}

export async function updateByStripeSubscription(
  stripeSubscriptionId: string,
  patch: Partial<
    Pick<
      BillingRow,
      "plan" | "monthly_tokens" | "used_tokens" | "subscription_status" | "current_period_end" | "stripe_customer_id"
    >
  >,
) {
  const admin = createAdminClient();
  const safePatch = { ...patch } as typeof patch;
  if (safePatch.subscription_status) {
    safePatch.subscription_status = normalizeBillingStatus(safePatch.subscription_status);
  }
  const { error } = await admin.from("billing_subscriptions").update(safePatch).eq("stripe_subscription_id", stripeSubscriptionId);
  if (error) {
    throw new Error(`updateByStripeSubscription fehlgeschlagen: ${error.message}`);
  }
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

export async function consumeTokens(userId: string, amount: number) {
  const admin = createAdminClient();
  const row = await getBillingRow(userId);
  if (!row) {
    return { ok: false as const, error: "Kein Billing-Profil vorhanden." };
  }
  if (!row.plan || row.subscription_status === "canceled" || row.subscription_status === "none") {
    return { ok: false as const, error: "Kein aktives Abo." };
  }
  const remaining = Math.max(row.monthly_tokens - row.used_tokens, 0);
  if (remaining < amount) {
    return { ok: false as const, error: `Nicht genug Tokens. Benötigt: ${amount}, verfügbar: ${remaining}.` };
  }
  const nextUsed = row.used_tokens + amount;
  const { error } = await admin.from("billing_subscriptions").update({ used_tokens: nextUsed }).eq("user_id", userId);
  if (error) {
    return { ok: false as const, error: "Tokenverbrauch konnte nicht gespeichert werden." };
  }
  return {
    ok: true as const,
    state: { ...row, used_tokens: nextUsed },
  };
}

export async function refundTokens(userId: string, amount: number) {
  const admin = createAdminClient();
  const row = await getBillingRow(userId);
  if (!row) {
    return { ok: false as const, error: "Kein Billing-Profil vorhanden." };
  }
  if (amount <= 0) {
    return { ok: true as const, state: row };
  }
  const nextUsed = Math.max(row.used_tokens - amount, 0);
  const { error } = await admin.from("billing_subscriptions").update({ used_tokens: nextUsed }).eq("user_id", userId);
  if (error) {
    return { ok: false as const, error: "Token-Rueckerstattung konnte nicht gespeichert werden." };
  }
  return {
    ok: true as const,
    state: { ...row, used_tokens: nextUsed },
  };
}

export async function addMonthlyTokens(userId: string, amount: number) {
  if (amount <= 0) {
    return { ok: false as const, error: "Ungueltige Token-Anzahl." };
  }
  const admin = createAdminClient();
  // Atomare DB-Operation via RPC, falls vorhanden — verhindert Lost-Updates bei
  // parallelen Buchungen (z. B. confirm-session + webhook).
  const rpc = await admin.rpc("add_monthly_tokens_atomic", {
    p_user_id: userId,
    p_amount: amount,
  });
  if (!rpc.error) {
    const next = Array.isArray(rpc.data) ? (rpc.data[0] as { monthly_tokens: number; used_tokens: number } | undefined) : undefined;
    if (next) {
      const row = await getBillingRow(userId);
      if (!row) {
        return { ok: false as const, error: "Kein Billing-Profil vorhanden." };
      }
      return { ok: true as const, state: { ...row, monthly_tokens: next.monthly_tokens, used_tokens: next.used_tokens } };
    }
    return { ok: false as const, error: "Kein Billing-Profil vorhanden." };
  }
  // Fallback fuer Umgebungen ohne RPC (z. B. lokal ohne Migration).
  if (rpc.error.code !== "42883" && rpc.error.code !== "PGRST202") {
    // 42883 = function does not exist; PGRST202 = supabase rpc not found
    if (process.env.NODE_ENV === "production") {
      return { ok: false as const, error: "Token-Kauf konnte nicht gespeichert werden (RPC)." };
    }
  }
  const row = await getBillingRow(userId);
  if (!row) {
    return { ok: false as const, error: "Kein Billing-Profil vorhanden." };
  }
  const nextMonthly = Math.max(row.monthly_tokens + amount, 0);
  const { error } = await admin
    .from("billing_subscriptions")
    .update({ monthly_tokens: nextMonthly })
    .eq("user_id", userId);
  if (error) {
    return { ok: false as const, error: "Token-Kauf konnte nicht gespeichert werden." };
  }
  return { ok: true as const, state: { ...row, monthly_tokens: nextMonthly } };
}

/**
 * Versucht, einen Token-Pack-Kauf anhand der Stripe-Checkout-`session_id` zu
 * claimen. Gibt `true` zurueck, wenn dieser Aufrufer der erste ist und somit
 * gutschreiben darf. Bei `false` wurde der Kauf bereits anderweitig verbucht.
 */
export async function claimTokenPackSession(args: {
  sessionId: string;
  userId: string;
  packId: string;
  tokens: number;
  source: "confirm_session" | "webhook";
}): Promise<boolean> {
  const admin = createAdminClient();
  const { error } = await admin.from("billing_token_pack_grants").insert({
    session_id: args.sessionId,
    user_id: args.userId,
    pack_id: args.packId,
    tokens: args.tokens,
    source: args.source,
  });
  if (!error) return true;
  if (error.code === "23505") return false; // bereits geclaimt
  if (error.code === "42P01" && isUndefinedTableTolerated()) return true;
  throw new Error(`claimTokenPackSession fehlgeschlagen: ${error.message}`);
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

