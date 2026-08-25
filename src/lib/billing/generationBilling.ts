import { NextResponse } from "next/server";
import { consumeTokens, ensureBillingRow, getEffectiveBillingRow } from "@/lib/billing/store";

/**
 * Vorprüfung des Guthabens vor einem teuren Provider-Call. Verhindert, dass
 * Nutzer ohne Tokens Provider-Kosten auslösen.
 */
export async function requireTokenBudget(userId: string, cost: number): Promise<NextResponse | null> {
  await ensureBillingRow(userId);
  const row = await getEffectiveBillingRow(userId);
  const remaining = Math.max((row?.monthly_tokens ?? 0) - (row?.used_tokens ?? 0), 0);
  if (remaining < cost) {
    return NextResponse.json(
      {
        error: `Nicht genug Tokens. Benötigt: ${cost}, verfügbar: ${remaining}.`,
        code: "insufficient_tokens",
      },
      { status: 402 },
    );
  }
  return null;
}

/**
 * Buchung nach erfolgreicher Generierung. Erst hier abrechnen — bei
 * Provider-Ausfällen soll der Nutzer nichts verlieren.
 */
export async function chargeGeneratedTokens(userId: string, cost: number) {
  const result = await consumeTokens(userId, cost);
  if (!result.ok) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: result.error, code: "insufficient_tokens" }, { status: 402 }),
    };
  }
  const { monthly_tokens: monthlyTokens, used_tokens: usedTokens, plan } = result.state;
  return {
    ok: true as const,
    billing: {
      consumed: cost,
      plan,
      monthlyTokens,
      usedTokens,
      remainingTokens: Math.max(monthlyTokens - usedTokens, 0),
    },
  };
}
