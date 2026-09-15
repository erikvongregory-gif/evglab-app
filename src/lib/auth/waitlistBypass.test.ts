import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildWaitlistBypassCookieValue,
  isWaitlistBypassCookieValid,
  isWaitlistBypassTokenValid,
} from "@/lib/auth/waitlistBypass";

describe("waitlistBypass", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("akzeptiert das konfigurierte Token", () => {
    vi.stubEnv("LOGIN_WAITLIST_BYPASS_SECRET", "operator-secret-123");
    expect(isWaitlistBypassTokenValid("operator-secret-123")).toBe(true);
    expect(isWaitlistBypassTokenValid("wrong")).toBe(false);
  });

  it("validiert das Bypass-Cookie", () => {
    vi.stubEnv("LOGIN_WAITLIST_BYPASS_SECRET", "operator-secret-123");
    const cookie = buildWaitlistBypassCookieValue();
    expect(cookie).toBeTruthy();
    expect(isWaitlistBypassCookieValid(cookie)).toBe(true);
    expect(isWaitlistBypassCookieValid("invalid")).toBe(false);
  });
});
