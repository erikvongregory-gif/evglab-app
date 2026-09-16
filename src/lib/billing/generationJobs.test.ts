import { describe, expect, it } from "vitest";
import {
  buildGenerationBillingSnapshot,
  generationRequestHash,
} from "./generationJobs";
import type { BillingRow } from "./store";

const sampleState: BillingRow = {
  user_id: "u1",
  plan: "pro",
  monthly_tokens: 1000,
  used_tokens: 100,
  stripe_customer_id: null,
  stripe_subscription_id: null,
  subscription_status: "active",
  current_period_end: null,
};

describe("generationRequestHash", () => {
  it("unterscheidet Route und Payload", () => {
    const a = generationRequestHash(
      new Request("https://app.example/api/inhalte-erstellen/create-task"),
      { quality: "medium", prompt: "a" },
    );
    const b = generationRequestHash(
      new Request("https://app.example/api/inhalte-erstellen/create-task"),
      { quality: "medium", prompt: "b" },
    );
    const c = generationRequestHash(
      new Request("https://app.example/api/inhalte-erstellen/social-post"),
      { quality: "medium", prompt: "a" },
    );
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
    expect(b).not.toBe(c);
  });

  it("ist stabil fuer denselben Inhalt", () => {
    const req = new Request("https://app.example/api/inhalte-erstellen/create-task");
    const payload = { quality: "medium", variantCount: 2 };
    expect(generationRequestHash(req, payload)).toBe(generationRequestHash(req, payload));
  });
});

describe("buildGenerationBillingSnapshot", () => {
  it("verwendet den bereits atomar abgerechneten Kontostand", () => {
    const snap = buildGenerationBillingSnapshot({
      state: { ...sampleState, used_tokens: 135 },
      charged: 35,
      perVariant: 35,
    });
    expect(snap.remainingTokens).toBe(865);
    expect(snap.usedTokens).toBe(135);
    expect(snap.consumed).toBe(35);
    expect(snap.perVariant).toBe(35);
  });

  it("Owner wird nicht belastet", () => {
    const snap = buildGenerationBillingSnapshot({
      state: { ...sampleState, user_id: "owner", used_tokens: 0 },
      charged: 35,
      perVariant: 35,
      owner: true,
    });
    expect(snap.consumed).toBe(0);
    expect(snap.remainingTokens).toBe(1000);
    expect(snap.usedTokens).toBe(0);
  });
});