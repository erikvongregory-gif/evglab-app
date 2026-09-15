import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ activate: vi.fn(), list: vi.fn(), row: vi.fn() }));
vi.mock("@/lib/billing/store", () => ({
  activatePlanForUser: mocks.activate, ensureBillingRow: vi.fn(), getBillingRow: mocks.row, setStripeCustomerId: vi.fn(),
}));
vi.mock("@/lib/billing/stripeServer", () => ({
  // No checkout history API: syncing must not rebuild a balance from purchases.
  getStripeClient: () => ({ subscriptions: { list: mocks.list } }),
}));
vi.mock("@/lib/billing/stripePrices", () => ({ mapPriceIdToPlan: () => "growth" }));
import { syncBillingFromStripe } from "./stripeSync";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.row.mockResolvedValue({ stripe_customer_id: "cus_one" });
  mocks.list.mockResolvedValue({ data: [{ id: "sub_one", status: "active", metadata: { plan: "start" },
    items: { data: [{ price: { id: "price_growth" }, current_period_end: 1790812800 }] },
  }] });
});
it("syncs entitlement using the current price without replaying historical purchases", async () => {
  expect(await syncBillingFromStripe({ userId: "user_one" })).toEqual({ synced: true, plan: "growth" });
  expect(mocks.activate).toHaveBeenCalledWith({ userId: "user_one", plan: "growth", subscriptionStatus: "active",
    stripeCustomerId: "cus_one", stripeSubscriptionId: "sub_one", currentPeriodStart: null, currentPeriodEnd: new Date(1790812800 * 1000).toISOString(),
  });
});
