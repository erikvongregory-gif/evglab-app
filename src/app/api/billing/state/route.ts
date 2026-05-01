import { NextResponse } from "next/server";
import Stripe from "stripe";
import { activatePlanForUser, ensureBillingRow, getBillingRow, setStripeCustomerId } from "@/lib/billing/store";
import { type SubscriptionPlanKey } from "@/lib/billing/tokenState";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

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

export async function GET() {
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

  const freeTrialImageUsed = Boolean(user.user_metadata?.free_trial_image_used_at);
  const onboardingBonusClaimed = Boolean(user.user_metadata?.onboarding_bonus_claimed_at);

  await ensureBillingRow(user.id);
  let row = await getBillingRow(user.id);

  // Hard fallback: wenn lokal kein aktiver Plan steht, auf jedem State-Call direkt mit Stripe synchronisieren.
  if (!row?.plan || row.subscription_status === "none" || row.subscription_status === "canceled") {
    try {
      const stripe = getStripeClient();
      let customerId = row?.stripe_customer_id ?? null;

      if (!customerId && user.email) {
        const customers = await stripe.customers.list({ email: user.email, limit: 20 });
        const matched =
          customers.data.find((c) => c.metadata?.user_id === user.id) ??
          customers.data.find((c) => c.email === user.email) ??
          null;
        if (matched?.id) {
          customerId = matched.id;
          await setStripeCustomerId(user.id, matched.id);
        }
      }

      if (customerId) {
        const subscriptions = await stripe.subscriptions.list({
          customer: customerId,
          status: "all",
          limit: 20,
        });
        const preferred = subscriptions.data
          .slice()
          .sort((a, b) => (b.created ?? 0) - (a.created ?? 0))
          .find((sub) => sub.status !== "canceled" && sub.status !== "incomplete_expired");

        if (preferred) {
          const planFromMeta = (preferred.metadata?.plan as SubscriptionPlanKey | undefined) ?? null;
          const planFromPrice = mapPriceIdToPlan(preferred.items.data[0]?.price?.id ?? null);
          const plan = planFromMeta ?? planFromPrice;
          if (plan) {
            await activatePlanForUser({
              userId: user.id,
              plan,
              subscriptionStatus: mapStatusToBillingStatus(preferred.status),
              stripeCustomerId: customerId,
              stripeSubscriptionId: preferred.id,
              currentPeriodEnd: toIsoFromUnix(getCurrentPeriodEndUnix(preferred)),
            });
            row = await getBillingRow(user.id);
          }
        }
      }
    } catch {
      // fallback bleibt still; state wird trotzdem ausgeliefert
    }
  }

  const state = row
    ? {
        plan: row.plan,
        monthlyTokens: row.monthly_tokens,
        usedTokens: row.used_tokens,
        remainingTokens: Math.max(row.monthly_tokens - row.used_tokens, 0),
        status: row.subscription_status,
        freeTrialImageUsed,
        onboardingBonusClaimed,
      }
    : {
        plan: null,
        monthlyTokens: 0,
        usedTokens: 0,
        remainingTokens: 0,
        status: "none",
        freeTrialImageUsed,
        onboardingBonusClaimed,
      };
  return NextResponse.json(
    { state },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    },
  );
}

