import { describe, expect, it } from "vitest";
import { resolveAuthCallbackRedirect } from "./authEntryRedirect";

describe("resolveAuthCallbackRedirect", () => {
  it("treats bare OAuth code as dashboard, not password recovery", () => {
    expect(resolveAuthCallbackRedirect({ code: "pkce-code" })).toBe(
      "/auth/callback?code=pkce-code&next=%2Fdashboard",
    );
  });

  it("routes recovery type to password reset", () => {
    expect(resolveAuthCallbackRedirect({ code: "r", type: "recovery" })).toBe(
      "/auth/callback?code=r&type=recovery&next=%2Fpasswort-zuruecksetzen",
    );
  });

  it("keeps explicit next", () => {
    expect(resolveAuthCallbackRedirect({ code: "x", next: "/team" })).toBe(
      "/auth/callback?code=x&next=%2Fteam",
    );
  });
});
