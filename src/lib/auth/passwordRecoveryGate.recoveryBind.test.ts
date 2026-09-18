import { describe, expect, it, vi } from "vitest";
import { sessionProvesRecoveryForUser } from "@/lib/auth/passwordRecoveryGate";

function claimsClient(claims: { sub?: string; amr?: unknown } | null) {
  return {
    auth: {
      getClaims: vi.fn(async () => ({ data: { claims } })),
    },
  };
}

describe("sessionProvesRecoveryForUser", () => {
  it("rejects recovery AMR when sub belongs to a different account", async () => {
    const supabase = claimsClient({
      sub: "account-a",
      amr: [{ method: "recovery" }],
    });
    expect(await sessionProvesRecoveryForUser(supabase, "account-b")).toBe(false);
  });

  it("accepts recovery AMR only when sub matches the target user", async () => {
    const supabase = claimsClient({
      sub: "account-b",
      amr: [{ method: "recovery" }],
    });
    expect(await sessionProvesRecoveryForUser(supabase, "account-b")).toBe(true);
  });

  it("rejects matching sub without recovery AMR", async () => {
    const supabase = claimsClient({
      sub: "account-b",
      amr: [{ method: "password" }],
    });
    expect(await sessionProvesRecoveryForUser(supabase, "account-b")).toBe(false);
  });
});
