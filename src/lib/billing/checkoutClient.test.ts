import { describe, expect, it } from "vitest";
import {
  buildAnmeldenUrlForHomepageCheckout,
  buildDashboardUrlForHomepageCheckout,
  getHomepageCheckoutPlan,
} from "@/lib/billing/checkoutClient";

describe("checkoutClient homepage deep links", () => {
  it("erkennt gültige Homepage-Checkout-Parameter", () => {
    const params = new URLSearchParams("plan=growth&checkout=1&source=homepage_pricing");
    expect(getHomepageCheckoutPlan(params)).toBe("growth");
  });

  it("baut Anmelde-URL mit Checkout-Parametern", () => {
    expect(buildAnmeldenUrlForHomepageCheckout("start")).toBe(
      "/anmelden?plan=start&checkout=1&source=homepage_pricing",
    );
  });

  it("baut Dashboard-Pricing-URL mit Checkout-Parametern", () => {
    expect(buildDashboardUrlForHomepageCheckout("pro")).toBe(
      "/dashboard?plan=pro&checkout=1&source=homepage_pricing&tab=pricing",
    );
  });
});
