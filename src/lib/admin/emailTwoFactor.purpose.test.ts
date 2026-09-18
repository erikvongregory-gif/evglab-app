import { createHmac } from "crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildPending2FAToken,
  buildTrustedDeviceToken,
  buildVerified2FAToken,
  isTrustedDeviceForUser,
  isVerified2FAForUser,
} from "@/lib/admin/emailTwoFactor";
import {
  buildPasswordRecoveryToken,
  isValidPasswordRecoveryToken,
} from "@/lib/auth/passwordRecoveryGate";

const ORIGINAL_SECRET = process.env.ADMIN_2FA_SECRET;

describe("signed auth cookie purposes", () => {
  afterEach(() => {
    if (ORIGINAL_SECRET === undefined) delete process.env.ADMIN_2FA_SECRET;
    else process.env.ADMIN_2FA_SECRET = ORIGINAL_SECRET;
  });

  it("rejects pending 2FA tokens as verified 2FA", () => {
    process.env.ADMIN_2FA_SECRET = "test-secret-at-least-32-characters-long!!";
    const pending = buildPending2FAToken({
      userId: "user-1",
      email: "a@b.c",
      code: "123456",
    });
    expect(isVerified2FAForUser(pending, "user-1")).toBe(false);
  });

  it("rejects pending/verified 2FA tokens as password recovery", () => {
    process.env.ADMIN_2FA_SECRET = "test-secret-at-least-32-characters-long!!";
    const pending = buildPending2FAToken({
      userId: "user-1",
      email: "a@b.c",
      code: "123456",
    });
    const verified = buildVerified2FAToken({ userId: "user-1" });
    expect(isValidPasswordRecoveryToken(pending, "user-1")).toBe(false);
    expect(isValidPasswordRecoveryToken(verified, "user-1")).toBe(false);
  });

  it("rejects verified 2FA tokens as trusted devices", () => {
    process.env.ADMIN_2FA_SECRET = "test-secret-at-least-32-characters-long!!";
    const verified = buildVerified2FAToken({ userId: "user-1" });
    expect(isTrustedDeviceForUser(verified, "user-1", 0)).toBe(false);
  });

  it("rejects tokens without purpose (legacy unspecific shape)", () => {
    process.env.ADMIN_2FA_SECRET = "test-secret-at-least-32-characters-long!!";
    const secret = process.env.ADMIN_2FA_SECRET!;
    const raw = Buffer.from(
      JSON.stringify({ userId: "user-1", expiresAt: Date.now() + 60_000 }),
      "utf8",
    ).toString("base64url");
    const legacy = `${raw}.${createHmac("sha256", secret).update(raw).digest("base64url")}`;
    expect(isVerified2FAForUser(legacy, "user-1")).toBe(false);
    expect(isValidPasswordRecoveryToken(legacy, "user-1")).toBe(false);
    expect(isTrustedDeviceForUser(legacy, "user-1", 0)).toBe(false);
  });

  it("accepts matching purposes", () => {
    process.env.ADMIN_2FA_SECRET = "test-secret-at-least-32-characters-long!!";
    expect(isVerified2FAForUser(buildVerified2FAToken({ userId: "user-1" }), "user-1")).toBe(true);
    expect(
      isValidPasswordRecoveryToken(buildPasswordRecoveryToken({ userId: "user-1" }), "user-1"),
    ).toBe(true);
    expect(
      isTrustedDeviceForUser(buildTrustedDeviceToken({ userId: "user-1", passwordEpoch: 0 }), "user-1", 0),
    ).toBe(true);
  });
});
