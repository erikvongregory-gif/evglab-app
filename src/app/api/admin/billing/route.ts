import { NextResponse } from "next/server";
import { enforceRateLimitPersistent, enforceSameOrigin } from "@/lib/security/requestGuards";
import { SUBSCRIPTION_PLAN_TOKENS, type SubscriptionPlanKey } from "@/lib/billing/tokenState";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/admin/auth";

export async function GET(req: Request) {
  const rateError = await enforceRateLimitPersistent(req, { keyPrefix: "admin-billing-get", limit: 60, windowMs: 60_000 });
  if (rateError) return rateError;
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Kein Admin-Zugriff." }, { status: 403 });

  const client = createAdminClient();
  const { data: userList, error: userListError } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (userListError) return NextResponse.json({ error: userListError.message }, { status: 500 });

  const { data, error } = await client
    .from("billing_subscriptions")
    .select("user_id, plan, monthly_tokens, used_tokens, subscription_status, current_period_end, stripe_customer_id")
    .order("user_id", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const billingByUserId = new Map((data ?? []).map((row) => [row.user_id, row]));
  const rows = (userList.users ?? []).map((user) => {
    const row = billingByUserId.get(user.id);
    const monthlyTokens = row?.monthly_tokens ?? 0;
    const usedTokens = row?.used_tokens ?? 0;
    return {
      userId: user.id,
      email: user.email ?? "",
      plan: row?.plan ?? null,
      monthlyTokens,
      usedTokens,
      remainingTokens: Math.max(monthlyTokens - usedTokens, 0),
      status: row?.subscription_status ?? "none",
      currentPeriodEnd: row?.current_period_end ?? null,
      hasStripeCustomer: Boolean(row?.stripe_customer_id),
    };
  });

  const summary = {
    total: rows.length,
    active: rows.filter((row) => row.status === "active" || row.status === "trialing").length,
    withPlan: rows.filter((row) => Boolean(row.plan)).length,
    tokensConsumed: rows.reduce((sum, row) => sum + (row.usedTokens ?? 0), 0),
  };

  return NextResponse.json({ summary, rows });
}

type PatchPayload = {
  userId?: string;
  plan?: SubscriptionPlanKey | null;
};

const ALLOWED_PLANS = new Set<SubscriptionPlanKey>(["start", "growth", "pro"]);

export async function PATCH(req: Request) {
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const rateError = await enforceRateLimitPersistent(req, { keyPrefix: "admin-billing-patch", limit: 30, windowMs: 60_000 });
  if (rateError) return rateError;
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Kein Admin-Zugriff." }, { status: 403 });

  let payload: PatchPayload;
  try {
    payload = (await req.json()) as PatchPayload;
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }

  const userId = typeof payload.userId === "string" ? payload.userId.trim() : "";
  if (!userId) {
    return NextResponse.json({ error: "userId fehlt." }, { status: 400 });
  }

  const plan = payload.plan ?? null;
  if (plan !== null && !ALLOWED_PLANS.has(plan)) {
    return NextResponse.json({ error: "Ungültiger Plan." }, { status: 400 });
  }

  const client = createAdminClient();

  const patch =
    plan === null
      ? {
          plan: null,
          monthly_tokens: 0,
          used_tokens: 0,
          subscription_status: "none",
          current_period_end: null,
          stripe_subscription_id: null,
        }
      : {
          plan,
          monthly_tokens: SUBSCRIPTION_PLAN_TOKENS[plan],
          used_tokens: 0,
          subscription_status: "active",
          current_period_end: null,
        };

  const { error } = await client.from("billing_subscriptions").upsert(
    {
      user_id: userId,
      ...patch,
    },
    { onConflict: "user_id" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
