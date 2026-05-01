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

function normalizeBillingStatus(status: string | null | undefined): BillingStatus {
  const allowed: BillingStatus[] = ["active", "trialing", "past_due", "canceled", "incomplete", "unpaid", "none"];
  if (status && allowed.includes(status as BillingStatus)) return status as BillingStatus;
  return "active";
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
  const admin = createAdminClient();
  const { error } = await admin.from("billing_subscriptions").upsert(
    {
      user_id: args.userId,
      plan: args.plan,
      monthly_tokens: SUBSCRIPTION_PLAN_TOKENS[args.plan],
      used_tokens: 0,
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
  const admin = createAdminClient();
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

