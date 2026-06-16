import { NextResponse } from "next/server";
import type { BillingRow } from "@/lib/billing/store";
import { ensureBillingRow, getBillingRow } from "@/lib/billing/store";

export const SUBSCRIPTION_REQUIRED_MESSAGE =
  "Bitte schließe zuerst ein Abo ab, um Bilder zu erstellen.";

export function hasActiveSubscription(
  row: Pick<BillingRow, "plan" | "subscription_status"> | null | undefined,
): boolean {
  if (!row?.plan) return false;
  return row.subscription_status !== "none" && row.subscription_status !== "canceled";
}

export function hasActiveSubscriptionFromState(plan: string | null | undefined, status: string | undefined): boolean {
  if (!plan) return false;
  return status !== "none" && status !== "canceled";
}

/** Server/API: 402 wenn kein aktives Abo. */
export async function requireActiveSubscription(userId: string): Promise<NextResponse | null> {
  await ensureBillingRow(userId);
  const row = await getBillingRow(userId);
  if (!hasActiveSubscription(row)) {
    return NextResponse.json(
      { error: SUBSCRIPTION_REQUIRED_MESSAGE, code: "subscription_required" },
      { status: 402 },
    );
  }
  return null;
}
