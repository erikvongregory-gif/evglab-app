import Stripe from "stripe";
import {
  activatePlanForUser,
  ensureBillingRow,
  getBillingRow,
  type BillingRow,
  setStripeCustomerId,
} from "@/lib/billing/store";
import { mapPriceIdToPlan as mapPriceIdToPlanFromEnv } from "@/lib/billing/stripePrices";
import { getStripeClient } from "@/lib/billing/stripeServer";
import { type SubscriptionPlanKey } from "@/lib/billing/tokenState";

export { getStripeClient } from "@/lib/billing/stripeServer";

export function mapPriceIdToPlan(priceId?: string | null): SubscriptionPlanKey | null {
  return mapPriceIdToPlanFromEnv(priceId);
}

export function toIsoFromUnix(seconds?: number | null) {
  if (!seconds) return null;
  return new Date(seconds * 1000).toISOString();
}

export function getCurrentPeriodEndUnix(subscription: Stripe.Subscription) {
  const value = (subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end;
  return typeof value === "number" ? value : subscription.items.data[0]?.current_period_end ?? null;
}

export function mapStatusToBillingStatus(status: Stripe.Subscription.Status) {
  if (status === "incomplete_expired" || status === "paused") return "incomplete" as const;
  return status as "active" | "trialing" | "past_due" | "canceled" | "incomplete" | "unpaid";
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
  const plan = planFromPrice ?? planFromMeta;
  if (!plan) {
    return { synced: false as const, reason: "Price-ID konnte keinem Plan zugeordnet werden." };
  }

  await activatePlanForUser({
    userId: args.userId,
    plan,
    subscriptionStatus: mapStatusToBillingStatus(preferred.status),
    stripeCustomerId: customerId,
    stripeSubscriptionId: preferred.id,
    currentPeriodEnd: toIsoFromUnix(getCurrentPeriodEndUnix(preferred)),
    currentPeriodStart: toIsoFromUnix(preferred.items.data[0]?.current_period_start ?? preferred.start_date),
  });
  return { synced: true as const, plan };
}
