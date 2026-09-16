import { getWorkspace } from "@/lib/dashboard/workspace";
import { hasPassedTwoFactor } from "@/lib/auth/twoFactorSession";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isOwnerUser } from "@/lib/auth/owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit, enforceSameOrigin } from "@/lib/security/requestGuards";
import { buildOwnerBillingRow, ensureBillingRow, getBillingRow } from "@/lib/billing/store";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const ONBOARDING_BONUS_TOKENS = 300;

function hasActiveBilling(row: { plan: string | null; subscription_status: string }) {
  return Boolean(row.plan) && row.subscription_status !== "none" && row.subscription_status !== "canceled";
}

function isMissingOnboardingBonusRpc(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    message.includes("billing_onboarding_bonus_atomic") ||
    message.includes("could not find the function")
  );
}

async function markOnboardingBonusClaimed(supabase: SupabaseClient, alreadyClaimed: boolean) {
  if (alreadyClaimed) return { error: null };
  const { error } = await supabase.auth.updateUser({
    data: { onboarding_bonus_claimed_at: new Date().toISOString() },
  });
  return { error };
}

async function grantOnboardingBonusLegacy(userId: string, amount: number) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("billing_subscriptions")
    .update({
      plan: "start",
      monthly_tokens: amount,
      used_tokens: 0,
      subscription_status: "active",
    })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
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

  if (user && !(await hasPassedTwoFactor(user))) return NextResponse.json({ error: "Zwei-Faktor-Prüfung erforderlich.", code: "two_factor_required" }, { status: 403 });
  if (user && (await getWorkspace(user.id)).role !== "owner") return NextResponse.json({error:"Abrechnung kann nur der Teaminhaber verwalten."},{status:403});
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const alreadyClaimed = Boolean(user.user_metadata?.onboarding_bonus_claimed_at);

  if (isOwnerUser(user)) {
    const ownerRow = buildOwnerBillingRow(user.id);
    await markOnboardingBonusClaimed(supabase, alreadyClaimed);
    return NextResponse.json({
      state: {
        plan: ownerRow.plan,
        monthlyTokens: ownerRow.monthly_tokens,
        usedTokens: 0,
        remainingTokens: ownerRow.monthly_tokens,
        status: ownerRow.subscription_status,
        unlimited: true,
        bonusGranted: false,
        bonusAlreadyClaimed: true,
      },
    });
  }

  await ensureBillingRow(user.id);
  let row = await getBillingRow(user.id);
  if (!row) {
    return NextResponse.json({ error: "Billing-Profil nicht gefunden." }, { status: 500 });
  }

  let bonusGranted = false;
  if (!alreadyClaimed && !hasActiveBilling(row)) {
    const admin = createAdminClient();
    const { data: granted, error: updateError } = await admin.rpc("billing_onboarding_bonus_atomic", {
      p_user_id: user.id,
      p_amount: ONBOARDING_BONUS_TOKENS,
    });

    if (updateError) {
      if (!isMissingOnboardingBonusRpc(updateError)) {
        return NextResponse.json({ error: "Bonus konnte nicht gespeichert werden." }, { status: 500 });
      }
      try {
        await grantOnboardingBonusLegacy(user.id, ONBOARDING_BONUS_TOKENS);
        bonusGranted = true;
      } catch {
        return NextResponse.json({ error: "Bonus konnte nicht gespeichert werden." }, { status: 500 });
      }
    } else {
      bonusGranted = granted === true;
    }

    const { error: metadataError } = await markOnboardingBonusClaimed(supabase, false);
    if (metadataError) {
      return NextResponse.json({ error: "Bonus konnte nicht final gespeichert werden." }, { status: 500 });
    }

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

