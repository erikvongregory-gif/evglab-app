import type { BillingInterval } from "@/lib/billing/planCatalog";
import { getStripeSecretKey } from "@/lib/billing/stripeServer";
import type { SubscriptionPlanKey } from "@/lib/billing/tokenState";



/** Aktuelle Price-IDs (Fallback wenn Env fehlt). */

const STRIPE_PRICE_FALLBACKS: Record<

  "test" | "live",

  Record<BillingInterval, Record<SubscriptionPlanKey, string>>

> = {

  test: {

    monthly: {

      start: "price_1TfFkpRsiwg9bLFF2V7TTEFO",

      growth: "price_1TfFkqRsiwg9bLFFV0mTiqm9",

      pro: "price_1TfFkqRsiwg9bLFFCmDTMwiI",

    },

    yearly: {

      start: "price_1TfFkpRsiwg9bLFFvXQzd8om",

      growth: "price_1TfFkqRsiwg9bLFFqiaPfndl",

      pro: "price_1TfFkqRsiwg9bLFFMQE8YRs7",

    },

  },

  live: {

    monthly: {

      start: "price_1TUMhBRojElHlMEe7nvvFwyM",

      growth: "price_1TUMhBRojElHlMEeZhNWLsnq",

      pro: "price_1TUMh8RojElHlMEerxH4kFLp",

    },

    yearly: {

      start: "price_1TeElhRojElHlMEeaOShHJry",

      growth: "price_1TeElhRojElHlMEeRMLLZnUy",

      pro: "price_1TeElhRojElHlMEeOuZHA68v",

    },

  },

};



/**

 * Frühere Price-IDs — bestehende Abos/Webhooks weiter zuordnen.

 * Nach Live-Migration: neue IDs aus scripts/sync-stripe-plan-prices.mjs eintragen.

 */

const LEGACY_STRIPE_PRICE_TO_PLAN: Record<string, SubscriptionPlanKey> = {

  // Test — alt (79/149/299 monatlich, 65/125/249 jährlich)

  price_1TJarsRsiwg9bLFFudD7vEy7: "start",

  price_1TJasBRsiwg9bLFFDsrwFGBV: "growth",

  price_1TJasPRsiwg9bLFFLHg41tgG: "pro",

  price_1TeEoBRsiwg9bLFFpIv3vznP: "start",

  price_1TeEoBRsiwg9bLFFGkV9sJMW: "growth",

  price_1TeEoCRsiwg9bLFFVoOX8v8r: "pro",

  // Live — alt

  price_1TUMhBRojElHlMEe7nvvFwyM: "start",

  price_1TUMhBRojElHlMEeZhNWLsnq: "growth",

  price_1TUMh8RojElHlMEerxH4kFLp: "pro",

  price_1TeElhRojElHlMEeaOShHJry: "start",

  price_1TeElhRojElHlMEeRMLLZnUy: "growth",

  price_1TeElhRojElHlMEeOuZHA68v: "pro",

};



export function getStripePriceEnvKey(plan: SubscriptionPlanKey, interval: BillingInterval): string {

  const suffix = interval === "yearly" ? "YEARLY" : "MONTHLY";

  return `STRIPE_PRICE_${plan.toUpperCase()}_${suffix}`;

}



function getStripeMode(): "test" | "live" {
  const key = getStripeSecretKey() ?? "";
  return key.startsWith("sk_live_") ? "live" : "test";
}



function resolvePriceId(plan: SubscriptionPlanKey, interval: BillingInterval): string | undefined {

  const envKey = getStripePriceEnvKey(plan, interval);

  return process.env[envKey] ?? STRIPE_PRICE_FALLBACKS[getStripeMode()][interval][plan];

}



export function getPriceIdForPlan(plan: SubscriptionPlanKey, interval: BillingInterval = "monthly"): string {

  const priceId = resolvePriceId(plan, interval);

  if (!priceId) {

    throw new Error(`Stripe Price-ID für Plan "${plan}" (${interval}) fehlt.`);

  }

  return priceId;

}



export function mapPriceIdToPlan(priceId?: string | null): SubscriptionPlanKey | null {

  if (!priceId) return null;



  if (priceId in LEGACY_STRIPE_PRICE_TO_PLAN) {

    return LEGACY_STRIPE_PRICE_TO_PLAN[priceId];

  }



  const plans: SubscriptionPlanKey[] = ["start", "growth", "pro"];

  const intervals: BillingInterval[] = ["monthly", "yearly"];



  for (const plan of plans) {

    for (const interval of intervals) {

      if (resolvePriceId(plan, interval) === priceId) return plan;

    }

  }



  return null;

}

