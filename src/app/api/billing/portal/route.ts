import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { ensureBillingRow, getBillingRow } from "@/lib/billing/store";
import { resolveStripeCustomerId } from "@/lib/billing/stripeCustomer";
import { getStripeClient, isStripeConfigured, stripeConfigurationError } from "@/lib/billing/stripeServer";
import { enforceRateLimit, enforceSameOrigin } from "@/lib/security/requestGuards";

export async function POST(req: Request) {
  try {
    const rateError = enforceRateLimit(req, {
      keyPrefix: "billing-portal",
      limit: 10,
      windowMs: 60_000,
    });
    if (rateError) return rateError;
    const originError = enforceSameOrigin(req);
    if (originError) return originError;

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
      return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
    }

    await ensureBillingRow(user.id);
    const row = await getBillingRow(user.id);
    if (!row?.stripe_customer_id) {
      return NextResponse.json({ error: "Kein Stripe-Kunde vorhanden. Bitte zuerst einen Plan kaufen." }, { status: 400 });
    }

    const stripe = getStripeClient();
    const customerId = await resolveStripeCustomerId({
      stripe,
      userId: user.id,
      email: user.email,
      existingCustomerId: row.stripe_customer_id,
    });
    const { origin } = new URL(req.url);
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/dashboard`,
    });

    return NextResponse.json({ url: session.url });
  } catch {
    return NextResponse.json({ error: "Portal konnte nicht geöffnet werden." }, { status: 500 });
  }
}

