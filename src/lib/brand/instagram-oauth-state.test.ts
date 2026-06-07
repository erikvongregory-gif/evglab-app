import { describe, expect, it } from "vitest";
import {
  createInstagramOAuthState,
  parseInstagramOAuthState,
  sanitizeReturnTo,
  serializeInstagramOAuthState,
} from "./instagram-oauth-state";

describe("instagram-oauth-state", () => {
  it("sanitizeReturnTo erlaubt nur relative Pfade", () => {
    expect(sanitizeReturnTo("/dashboard?tab=brand")).toBe("/dashboard?tab=brand");
    expect(sanitizeReturnTo("https://evil.example/phish")).toBe(
      "/dashboard?tab=brand&openBrand=1&brandInput=instagram",
    );
    expect(sanitizeReturnTo("//evil.example/phish")).toBe(
      "/dashboard?tab=brand&openBrand=1&brandInput=instagram",
    );
  });

  it("serialisiert und parst OAuth-State", () => {
    const state = createInstagramOAuthState("user-1", "/dashboard?tab=brand");
    const raw = serializeInstagramOAuthState(state);
    const parsed = parseInstagramOAuthState(raw);
    expect(parsed?.state).toBe(state.state);
    expect(parsed?.userId).toBe("user-1");
    expect(parsed?.returnTo).toBe("/dashboard?tab=brand");
  });
});
