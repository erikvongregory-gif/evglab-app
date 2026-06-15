import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAppBaseUrlOrigin, isBillingCheckoutEnabled, isKleinunternehmerModeEnabled, isSupabaseConfigured } from "@/lib/supabase/env";
import { ensureBillingRow, getBillingRow, setStripeCustomerId } from "@/lib/billing/store";
import { getPriceIdForPlan } from "@/lib/billing/stripePrices";
import { getStripeClient, isStripeConfigured, stripeConfigurationError } from "@/lib/billing/stripeServer";
import type { BillingInterval } from "@/lib/billing/planCatalog";
import { type SubscriptionPlanKey } from "@/lib/billing/tokenState";
import { enforceRateLimitPersistent, enforceSameOrigin } from "@/lib/security/requestGuards";

const checkoutSchema = z.object({
  plan: z.enum(["start", "growth", "pro"]),
  interval: z.enum(["monthly", "yearly"]).optional().default("yearly"),
});

function isAutomaticTaxEnabled() {
  return process.env.STRIPE_ENABLE_AUTOMATIC_TAX !== "false";
}

export async function POST(req: Request) {
  try {
    const rateError = await enforceRateLimitPersistent(req, {
      keyPrefix: "billing-checkout",
      limit: 10,
      windowMs: 60_000,
    });
    if (rateError) return rateError;
    const originError = enforceSameOrigin(req);
    if (originError) return originError;

    if (!isBillingCheckoutEnabled()) {
      return NextResponse.json({ error: "Checkout ist derzeit deaktiviert." }, { status: 403 });
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase ist nicht konfiguriert." }, { status: 500 });
    }

    if (!isStripeConfigured()) {
      return NextResponse.json({ error: stripeConfigurationError(), code: "STRIPE_NOT_CONFIGURED" }, { status: 503 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Konto erforderlich. Bitte zuerst registrieren.", code: "ACCOUNT_REQUIRED" },
        { status: 401 },
      );
    }

    const parsed = checkoutSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
    }
    const plan: SubscriptionPlanKey = parsed.data.plan;
    const interval: BillingInterval = parsed.data.interval;

    const stripe = getStripeClient();
    await ensureBillingRow(user.id);
    const billing = await getBillingRow(user.id);

    let customerId = billing?.stripe_customer_id ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
      await setStripeCustomerId(user.id, customer.id);
    }

    const priceId = getPriceIdForPlan(plan, interval);
    const origin = getAppBaseUrlOrigin(new URL(req.url).origin);
    const kleinunternehmerMode = isKleinunternehmerModeEnabled();
    const automaticTaxEnabled = isAutomaticTaxEnabled() && !kleinunternehmerMode;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/dashboard?tab=pricing&billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dashboard?tab=pricing&billing=cancel`,
      billing_address_collection: automaticTaxEnabled ? "required" : "auto",
      tax_id_collection: { enabled: automaticTaxEnabled },
      customer_update: automaticTaxEnabled
        ? {
            address: "auto",
            name: "auto",
          }
        : undefined,
      automatic_tax: { enabled: automaticTaxEnabled },
      custom_text: kleinunternehmerMode
        ? {
            submit: {
              message: "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.",
            },
          }
        : undefined,
      metadata: {
        user_id: user.id,
        plan,
        interval,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan,
          interval,
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout konnte nicht gestartet werden.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

