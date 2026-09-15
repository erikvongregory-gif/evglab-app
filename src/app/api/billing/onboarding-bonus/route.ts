import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit, enforceSameOrigin } from "@/lib/security/requestGuards";
import { ensureBillingRow, getBillingRow } from "@/lib/billing/store";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const ONBOARDING_BONUS_TOKENS = 300;

function hasActiveBilling(row: { plan: string | null; subscription_status: string }) {
  return Boolean(row.plan) && row.subscription_status !== "none" && row.subscription_status !== "canceled";
}

export async function POST(req: Request) {
  const rateError = enforceRateLimit(req, { keyPrefix: "billing-onboarding-bonus", limit: 10, windowMs: 60_000 });
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

  await ensureBillingRow(user.id);
  let row = await getBillingRow(user.id);
  if (!row) {
    return NextResponse.json({ error: "Billing-Profil nicht gefunden." }, { status: 500 });
  }

  const alreadyClaimed = Boolean(user.user_metadata?.onboarding_bonus_claimed_at);
  let bonusGranted = false;
  if (!alreadyClaimed && !hasActiveBilling(row)) {
    const admin = createAdminClient();
    const { data: granted, error: updateError } = await admin.rpc("billing_onboarding_bonus_atomic", {
      p_user_id: user.id,
      p_amount: ONBOARDING_BONUS_TOKENS,
    });
    if (updateError) {
      return NextResponse.json({ error: "Bonus konnte nicht gespeichert werden." }, { status: 500 });
    }

    const { error: metadataError } = await supabase.auth.updateUser({
      data: {
        onboarding_bonus_claimed_at: new Date().toISOString(),
      },
    });
    if (metadataError) {
      return NextResponse.json({ error: "Bonus konnte nicht final gespeichert werden." }, { status: 500 });
    }

    bonusGranted = granted === true;

    row = await getBillingRow(user.id);
    if (!row) {
      return NextResponse.json({ error: "Billing-Profil nicht gefunden." }, { status: 500 });
    }
  }

  return NextResponse.json({
    state: {
      plan: row.plan,
      monthlyTokens: row.monthly_tokens,
      usedTokens: row.used_tokens,
      remainingTokens: Math.max(row.monthly_tokens - row.used_tokens, 0),
      status: row.subscription_status,
      bonusGranted,
      bonusAlreadyClaimed: alreadyClaimed || hasActiveBilling(row),
    },
  });
}

