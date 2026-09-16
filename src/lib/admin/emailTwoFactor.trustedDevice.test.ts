import { afterEach, describe, expect, it } from "vitest";
import {
  buildTrustedDeviceToken,
  isTrustedDeviceForUser,
} from "@/lib/admin/emailTwoFactor";

const ORIGINAL_SECRET = process.env.ADMIN_2FA_SECRET;

describe("trusted device password epoch", () => {
  afterEach(() => {
    if (ORIGINAL_SECRET === undefined) delete process.env.ADMIN_2FA_SECRET;
    else process.env.ADMIN_2FA_SECRET = ORIGINAL_SECRET;
  });

  it("rejects devices issued before a password change", () => {
    process.env.ADMIN_2FA_SECRET = "test-secret-at-least-32-characters-long!!";
    const token = buildTrustedDeviceToken({ userId: "user-1", passwordEpoch: 100 });
    expect(isTrustedDeviceForUser(token, "user-1", 100)).toBe(true);
    expect(isTrustedDeviceForUser(token, "user-1", 200)).toBe(false);
  });
});
