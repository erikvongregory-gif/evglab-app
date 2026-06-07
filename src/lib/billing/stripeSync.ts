import Stripe from "stripe";
import {
  activatePlanForUser,
  ensureBillingRow,
  getBillingRow,
  type BillingRow,
  setStripeCustomerId,
  updateByStripeSubscription,
} from "@/lib/billing/store";
import { mapPriceIdToPlan as mapPriceIdToPlanFromEnv } from "@/lib/billing/stripePrices";
import { SUBSCRIPTION_PLAN_TOKENS, type SubscriptionPlanKey } from "@/lib/billing/tokenState";

export function getStripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY fehlt.");
  return new Stripe(key);
}

export function mapPriceIdToPlan(priceId?: string | null): SubscriptionPlanKey | null {
  return mapPriceIdToPlanFromEnv(priceId);
}

export function toIsoFromUnix(seconds?: number | null) {
  if (!seconds) return null;
  return new Date(seconds * 1000).toISOString();
}

export function getCurrentPeriodEndUnix(subscription: Stripe.Subscription) {
  const value = (subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end;
  return typeof value === "number" ? value : null;
}

export function mapStatusToBillingStatus(status: Stripe.Subscription.Status) {
  if (status === "incomplete_expired" || status === "paused") return "incomplete" as const;
  return status as "active" | "trialing" | "past_due" | "canceled" | "incomplete" | "unpaid";
}

async function getPurchasedTokenTotal(stripe: Stripe, customerId: string, userId: string): Promise<number> {
  let total = 0;
  let cursor: string | undefined;
  for (let page = 0; page < 20; page += 1) {
    const sessions = await stripe.checkout.sessions.list({
      customer: customerId,
      limit: 100,
      ...(cursor ? { starting_after: cursor } : {}),
    });
    for (const session of sessions.data) {
      if (session.mode !== "payment") continue;
      if (session.payment_status !== "paid" && session.status !== "complete") continue;
      if (session.metadata?.kind !== "token_pack") continue;
      if (session.metadata?.user_id !== userId) continue;
      const tokens = Number.parseInt(session.metadata?.tokens ?? "0", 10);
      if (Number.isFinite(tokens) && tokens > 0) total += tokens;
    }
    if (!sessions.has_more || sessions.data.length === 0) break;
    cursor = sessions.data[sessions.data.length - 1]?.id;
  }
  return total;
}

type SyncArgs = {
  userId: string;
  userEmail?: string | null;
  currentRow?: BillingRow | null;
};

export async function syncBillingFromStripe(args: SyncArgs) {
  await ensureBillingRow(args.userId);
  const stripe = getStripeClient();
  const currentRow = args.currentRow ?? (await getBillingRow(args.userId));
  let customerId = currentRow?.stripe_customer_id ?? null;

  if (!customerId && args.userEmail) {
    const customers = await stripe.customers.list({ email: args.userEmail, limit: 20 });
    const matched =
      customers.data.find((c) => c.metadata?.user_id === args.userId) ??
      customers.data.find((c) => c.email === args.userEmail) ??
      null;
    if (matched?.id) {
      customerId = matched.id;
      await setStripeCustomerId(args.userId, matched.id);
    }
  }

  if (!customerId) {
    return { synced: false as const, reason: "Kein Stripe-Kunde vorhanden." };
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
    return { synced: false as const, reason: "Keine aktive Subscription gefunden." };
  }

  const planFromMeta = (preferred.metadata?.plan as SubscriptionPlanKey | undefined) ?? null;
  const planFromPrice = mapPriceIdToPlan(preferred.items.data[0]?.price?.id ?? null);
  const plan = planFromMeta ?? planFromPrice;
  if (!plan) {
    return { synced: false as const, reason: "Price-ID konnte keinem Plan zugeordnet werden." };
  }

  const purchasedTokenTotal = await getPurchasedTokenTotal(stripe, customerId, args.userId);
  const expectedMonthlyTokens = SUBSCRIPTION_PLAN_TOKENS[plan] + purchasedTokenTotal;

  await activatePlanForUser({
    userId: args.userId,
    plan,
    subscriptionStatus: mapStatusToBillingStatus(preferred.status),
    stripeCustomerId: customerId,
    stripeSubscriptionId: preferred.id,
    currentPeriodEnd: toIsoFromUnix(getCurrentPeriodEndUnix(preferred)),
    preserveTokenBalance: true,
  });
  await updateByStripeSubscription(preferred.id, {
    monthly_tokens: expectedMonthlyTokens,
  });
  return { synced: true as const, plan };
}
