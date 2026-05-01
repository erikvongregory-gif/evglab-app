import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { activatePlanForUser } from "@/lib/billing/store";
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

export async function POST(req: Request) {
  try {
    const rateError = enforceRateLimit(req, {
      keyPrefix: "billing-confirm-session",
      limit: 12,
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

    const body = z.object({ sessionId: z.string().trim().min(1).max(200) }).safeParse(await req.json());
    if (!body.success) {
      return NextResponse.json({ error: "sessionId fehlt." }, { status: 400 });
    }

    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(body.data.sessionId, {
      expand: ["subscription"],
    });
    if (session.mode !== "subscription") {
      return NextResponse.json({ error: "Keine Subscription-Session." }, { status: 400 });
    }
    if (session.payment_status !== "paid" && session.status !== "complete") {
      return NextResponse.json({ error: "Zahlung nicht abgeschlossen." }, { status: 400 });
    }

    const userIdMeta = session.metadata?.user_id;
    if (!userIdMeta || userIdMeta !== user.id) {
      return NextResponse.json({ error: "Session gehoert nicht zum User." }, { status: 403 });
    }
    const customerId =
      typeof session.customer === "string" ? session.customer : (session.customer?.id ?? null);
    const subscription =
      typeof session.subscription === "string"
        ? await stripe.subscriptions.retrieve(session.subscription)
        : session.subscription;
    const planFromMeta = (session.metadata?.plan as SubscriptionPlanKey | undefined) ?? null;
    const planFromPrice = mapPriceIdToPlan(subscription?.items.data[0]?.price?.id ?? null);
    const plan = planFromMeta ?? planFromPrice;
    if (!plan || !customerId || !subscription?.id) {
      return NextResponse.json({ error: "Session-Metadaten unvollstaendig." }, { status: 400 });
    }

    const subscriptionWithPeriod = subscription as Stripe.Subscription & { current_period_end?: number };
    const currentPeriodEndUnix =
      typeof subscriptionWithPeriod.current_period_end === "number"
        ? subscriptionWithPeriod.current_period_end
        : null;

    await activatePlanForUser({
      userId: user.id,
      plan,
      subscriptionStatus:
        (subscription.status as "active" | "trialing" | "past_due" | "canceled" | "incomplete" | "unpaid") ?? "active",
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      currentPeriodEnd: currentPeriodEndUnix ? new Date(currentPeriodEndUnix * 1000).toISOString() : null,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Session-Bestätigung fehlgeschlagen." }, { status: 500 });
  }
}

