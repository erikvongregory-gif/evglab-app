import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  addMonthlyTokens,
  activatePlanForUser,
  claimTokenPackSession,
  getByStripeCustomerId,
  claimStripeWebhookEvent,
  markStripeWebhookEventProcessed,
  releaseStripeWebhookEvent,
  renewBillingPeriodTokens,
  updateByStripeSubscription,
} from "@/lib/billing/store";
import { SUBSCRIPTION_PLAN_TOKENS, type SubscriptionPlanKey } from "@/lib/billing/tokenState";
import { mapPriceIdToPlan } from "@/lib/billing/stripePrices";
import { getStripeClient } from "@/lib/billing/stripeServer";

function toIsoFromUnix(seconds?: number | null) {
  if (!seconds) return null;
  return new Date(seconds * 1000).toISOString();
}

function getCurrentPeriodEndUnix(subscription: Stripe.Subscription) {
  const value = (subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end;
  return typeof value === "number" ? value : null;
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const legacy = (invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null }).subscription;
  if (typeof legacy === "string") return legacy;
  if (legacy && typeof legacy === "object" && "id" in legacy) return legacy.id;

  const fromParent = invoice.parent?.subscription_details?.subscription;
  if (typeof fromParent === "string") return fromParent;
  if (fromParent && typeof fromParent === "object" && "id" in fromParent) return fromParent.id;

  const lineSub = invoice.lines?.data?.[0]?.subscription;
  if (typeof lineSub === "string") return lineSub;
  if (lineSub && typeof lineSub === "object" && "id" in lineSub) return lineSub.id;

  return null;
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
    const claimed = await claimStripeWebhookEvent(event.id, event.type);
    if (!claimed) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const kind = session.metadata?.kind;
        if (kind === "token_pack") {
          const userId = session.metadata?.user_id;
          const tokens = Number.parseInt(session.metadata?.tokens ?? "0", 10);
          if (userId && Number.isFinite(tokens) && tokens > 0) {
            const packId = (session.metadata?.pack_id ?? session.metadata?.pack ?? "tokens").toString();
            const claimed = await claimTokenPackSession({
              sessionId: session.id,
              userId,
              packId,
              tokens,
              source: "webhook",
            });
            if (claimed) {
              await addMonthlyTokens(userId, tokens);
            }
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
            subscriptionStatus:
              (subscription.status as "active" | "trialing" | "past_due" | "canceled" | "incomplete" | "unpaid") ?? "active",
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            currentPeriodEnd: toIsoFromUnix(getCurrentPeriodEndUnix(subscription)),
            preserveTokenBalance: true,
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
            const oldBaseTokens = row.plan ? SUBSCRIPTION_PLAN_TOKENS[row.plan] : 0;
            const extraTokens = Math.max(row.monthly_tokens - oldBaseTokens, 0);
            const baseTokens = mappedPlan ? SUBSCRIPTION_PLAN_TOKENS[mappedPlan] : null;
            await updateByStripeSubscription(subscription.id, {
              plan: mappedPlan ?? row.plan,
              monthly_tokens: baseTokens ? baseTokens + extraTokens : row.monthly_tokens,
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

      if (event.type === "invoice.paid") {
        const invoice = event.data.object as Stripe.Invoice;
        const billingReason = invoice.billing_reason;
        if (billingReason === "subscription_cycle" || billingReason === "subscription_update") {
          const subscriptionId = getInvoiceSubscriptionId(invoice);
          if (subscriptionId) {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            await renewBillingPeriodTokens({
              stripeSubscriptionId: subscriptionId,
              currentPeriodEnd: toIsoFromUnix(getCurrentPeriodEndUnix(subscription)),
            });
          }
        }
      }

      await markStripeWebhookEventProcessed(event.id);
      return NextResponse.json({ received: true });
    } catch (processingError) {
      await releaseStripeWebhookEvent(event.id);
      throw processingError;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook-Verarbeitung fehlgeschlagen.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

