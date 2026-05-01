import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  addMonthlyTokens,
  activatePlanForUser,
  getByStripeCustomerId,
  updateByStripeSubscription,
} from "@/lib/billing/store";
import { SUBSCRIPTION_PLAN_TOKENS, type SubscriptionPlanKey } from "@/lib/billing/tokenState";

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

export async function POST(req: Request) {
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET fehlt." }, { status: 500 });
    }

    const stripe = getStripeClient();
    const rawBody = await req.text();
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return NextResponse.json({ error: "Stripe-Signatur fehlt." }, { status: 400 });
    }

    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const kind = session.metadata?.kind;
      if (kind === "token_pack") {
        const userId = session.metadata?.user_id;
        const tokens = Number.parseInt(session.metadata?.tokens ?? "0", 10);
        if (userId && Number.isFinite(tokens) && tokens > 0) {
          await addMonthlyTokens(userId, tokens);
        }
      }

      const userId = session.metadata?.user_id;
      const plan = (session.metadata?.plan as SubscriptionPlanKey | undefined) ?? null;
      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
      const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
      if (userId && plan && subscriptionId && customerId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await activatePlanForUser({
          userId,
          plan,
          subscriptionStatus: (subscription.status as "active" | "trialing" | "past_due" | "canceled" | "incomplete" | "unpaid") ?? "active",
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          currentPeriodEnd: toIsoFromUnix(getCurrentPeriodEndUnix(subscription)),
        });
      }
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.created") {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
      const priceId = subscription.items.data[0]?.price?.id ?? null;
      const mappedPlan = mapPriceIdToPlan(priceId);
      if (customerId) {
        const row = await getByStripeCustomerId(customerId);
        if (row) {
          await updateByStripeSubscription(subscription.id, {
            plan: mappedPlan ?? row.plan,
            monthly_tokens: mappedPlan ? SUBSCRIPTION_PLAN_TOKENS[mappedPlan] : row.monthly_tokens,
            subscription_status: subscription.status as
              | "active"
              | "trialing"
              | "past_due"
              | "canceled"
              | "incomplete"
              | "unpaid",
            current_period_end: toIsoFromUnix(getCurrentPeriodEndUnix(subscription)),
          });
        }
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      await updateByStripeSubscription(subscription.id, {
        plan: null,
        monthly_tokens: 0,
        used_tokens: 0,
        subscription_status: "canceled",
        current_period_end: toIsoFromUnix(getCurrentPeriodEndUnix(subscription)),
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook-Verarbeitung fehlgeschlagen.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

