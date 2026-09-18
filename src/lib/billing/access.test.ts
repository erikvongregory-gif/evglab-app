import { describe, expect, it } from "vitest";
import {
  hasActiveSubscription,
  hasPaidSubscription,
  paidPlanFromBilling,
} from "@/lib/billing/access";
import type { BillingRow } from "@/lib/billing/store";

function row(partial: Partial<BillingRow>): BillingRow {
  return {
    user_id: "u1",
    plan: null,
    monthly_tokens: 0,
    used_tokens: 0,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    subscription_status: "none",
    current_period_end: null,
    ...partial,
  };
}

describe("billing access", () => {
  it("treats bonus-only start/active without Stripe as unpaid", () => {
    const bonus = row({
      plan: "start",
      subscription_status: "active",
      monthly_tokens: 0,
      used_tokens: 0,
    });
    expect(hasPaidSubscription(bonus)).toBe(false);
    expect(paidPlanFromBilling(bonus)).toBeNull();
    expect(hasActiveSubscription(bonus)).toBe(false);
  });

  it("allows studio access when bonus tokens remain", () => {
    const bonus = row({
      plan: null,
      subscription_status: "none",
      monthly_tokens: 50,
      used_tokens: 10,
    });
    expect(hasPaidSubscription(bonus)).toBe(false);
    expect(hasActiveSubscription(bonus)).toBe(true);
  });

  it("recognizes Stripe subscriptions as paid", () => {
    const paid = row({
      plan: "growth",
      subscription_status: "active",
      stripe_subscription_id: "sub_123",
      monthly_tokens: 3000,
      used_tokens: 0,
    });
    expect(hasPaidSubscription(paid)).toBe(true);
    expect(paidPlanFromBilling(paid)).toBe("growth");
    expect(hasActiveSubscription(paid)).toBe(true);
  });
});
