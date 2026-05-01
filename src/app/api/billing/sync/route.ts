import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { activatePlanForUser, ensureBillingRow, getBillingRow, setStripeCustomerId } from "@/lib/billing/store";
import { type SubscriptionPlanKey } from "@/lib/billing/tokenState";
import { enforceRateLimit, enforceSameOrigin } from "@/lib/security/requestGuards";

function getStripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY fehlt.");
  return new Stripe(key);
}

function mapPriceIdToPlan(priceId?: string | null): SubscriptionPlanKey | null {
  const map: Record<SubscriptionPlanKey, string | undefined> = {
    start: process.env.STRIPE_PRICE_START_MONTHLY,
    growth: process.env.STRIPE_PRICE_GROWTH_MONTHLY,
    pro: process.env.STRIPE_PRICE_PRO_MONTHLY,
  };
  const entry = Object.entries(map).find(([, id]) => id && id === priceId);
  return (entry?.[0] as SubscriptionPlanKey | undefined) ?? null;
}

function toIsoFromUnix(seconds?: number | null) {
  if (!seconds) return null;
  return new Date(seconds * 1000).toISOString();
}

function getCurrentPeriodEndUnix(subscription: Stripe.Subscription) {
  const value = (subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end;
  return typeof value === "number" ? value : null;
}

function mapStatusToBillingStatus(status: Stripe.Subscription.Status) {
  if (status === "incomplete_expired" || status === "paused") return "incomplete" as const;
  return status as "active" | "trialing" | "past_due" | "canceled" | "incomplete" | "unpaid";
}

export async function POST(req: Request) {
  try {
    const rateError = enforceRateLimit(req, {
      keyPrefix: "billing-sync",
      limit: 10,
      windowMs: 60_000,
    });
    if (rateError) return rateError;
    const originError = enforceSameOrigin(req);
    if (originError) return originError;

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase ist nicht konfiguriert." }, { status: 500 });
    }
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
    }

    await ensureBillingRow(user.id);
    const row = await getBillingRow(user.id);

    const stripe = getStripeClient();
    let customerId = row?.stripe_customer_id ?? null;
    if (!customerId) {
      const email = user.email ?? null;
      if (email) {
        const customers = await stripe.customers.list({ email, limit: 20 });
        const matched =
          customers.data.find((c) => c.metadata?.user_id === user.id) ??
          customers.data.find((c) => c.email === email) ??
          null;
        if (matched?.id) {
          customerId = matched.id;
          await setStripeCustomerId(user.id, matched.id);
        }
      }
    }
    if (!customerId) {
      return NextResponse.json({ ok: true, synced: false, reason: "Kein Stripe-Kunde vorhanden." });
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 20,
    });

    const preferred = subscriptions.data
      .slice()
      .sort((a, b) => (b.created ?? 0) - (a.created ?? 0))
      .find((sub) => sub.status !== "canceled" && sub.status !== "incomplete_expired");

    if (!preferred) {
      return NextResponse.json({ ok: true, synced: false, reason: "Keine aktive Subscription gefunden." });
    }

    const planFromMeta = (preferred.metadata?.plan as SubscriptionPlanKey | undefined) ?? null;
    const planFromPrice = mapPriceIdToPlan(preferred.items.data[0]?.price?.id ?? null);
    const plan = planFromMeta ?? planFromPrice;
    if (!plan) {
      return NextResponse.json({ ok: true, synced: false, reason: "Price-ID konnte keinem Plan zugeordnet werden." });
    }

    await activatePlanForUser({
      userId: user.id,
      plan,
      subscriptionStatus: mapStatusToBillingStatus(preferred.status),
      stripeCustomerId: customerId,
      stripeSubscriptionId: preferred.id,
      currentPeriodEnd: toIsoFromUnix(getCurrentPeriodEndUnix(preferred)),
    });

    return NextResponse.json({ ok: true, synced: true, plan });
  } catch {
    return NextResponse.json({ error: "Billing-Sync fehlgeschlagen." }, { status: 500 });
  }
}

