import { NextResponse } from "next/server";
import { ensureBillingRow, getBillingRow } from "@/lib/billing/store";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { syncBillingFromStripe } from "@/lib/billing/stripeSync";

export async function GET() {
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

  const freeTrialImageUsed = Boolean(user.user_metadata?.free_trial_image_used_at);
  const onboardingBonusClaimed = Boolean(user.user_metadata?.onboarding_bonus_claimed_at);

  await ensureBillingRow(user.id);
  let row = await getBillingRow(user.id);

  // Hard fallback: wenn lokal kein aktiver Plan steht, auf jedem State-Call direkt mit Stripe synchronisieren.
  if (!row?.plan || row.subscription_status === "none" || row.subscription_status === "canceled") {
    try {
      const syncResult = await syncBillingFromStripe({
        userId: user.id,
        userEmail: user.email,
        currentRow: row,
      });
      if (syncResult.synced) {
        row = await getBillingRow(user.id);
      }
    } catch {
      // fallback bleibt still; state wird trotzdem ausgeliefert
    }
  }

  const state = row
    ? {
        plan: row.plan,
        monthlyTokens: row.monthly_tokens,
        usedTokens: row.used_tokens,
        remainingTokens: Math.max(row.monthly_tokens - row.used_tokens, 0),
        status: row.subscription_status,
        freeTrialImageUsed,
        onboardingBonusClaimed,
      }
    : {
        plan: null,
        monthlyTokens: 0,
        usedTokens: 0,
        remainingTokens: 0,
        status: "none",
        freeTrialImageUsed,
        onboardingBonusClaimed,
      };
  return NextResponse.json(
    { state },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    },
  );
}

