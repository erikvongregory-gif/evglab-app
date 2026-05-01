import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { ensureBillingRow, getBillingRow } from "@/lib/billing/store";
import { enforceRateLimitPersistent, enforceSameOrigin } from "@/lib/security/requestGuards";

type TokenPackKey = "tokens_500" | "tokens_2000";

function getStripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY fehlt.");
  return new Stripe(key);
}

function getPackConfig(pack: TokenPackKey) {
  const map: Record<TokenPackKey, { priceId?: string; tokens: number }> = {
    tokens_500: { priceId: process.env.STRIPE_PRICE_TOKENS_500, tokens: 500 },
    tokens_2000: { priceId: process.env.STRIPE_PRICE_TOKENS_2000, tokens: 2000 },
  };
  return map[pack];
}

export async function POST(req: Request) {
  try {
    const rateError = await enforceRateLimitPersistent(req, {
      keyPrefix: "billing-buy-tokens",
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

    const body = z.object({ pack: z.enum(["tokens_500", "tokens_2000"]) }).safeParse(await req.json());
    if (!body.success) {
      return NextResponse.json({ error: "Token-Pack fehlt." }, { status: 400 });
    }
    const pack: TokenPackKey = body.data.pack;
    const packConfig = getPackConfig(pack);
    if (!packConfig?.priceId) {
      return NextResponse.json({ error: "Preis für Token-Pack ist nicht konfiguriert." }, { status: 500 });
    }

    await ensureBillingRow(user.id);
    const row = await getBillingRow(user.id);
    if (!row?.stripe_customer_id) {
      return NextResponse.json({ error: "Bitte zuerst ein Abo kaufen." }, { status: 400 });
    }

    const stripe = getStripeClient();
    const { origin } = new URL(req.url);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: row.stripe_customer_id,
      line_items: [{ price: packConfig.priceId, quantity: 1 }],
      success_url: `${origin}/dashboard?billing=success_tokens`,
      cancel_url: `${origin}/dashboard?billing=cancel_tokens`,
      metadata: {
        user_id: user.id,
        kind: "token_pack",
        tokens: String(packConfig.tokens),
        pack,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch {
    return NextResponse.json({ error: "Token-Pack Checkout konnte nicht gestartet werden." }, { status: 500 });
  }
}

