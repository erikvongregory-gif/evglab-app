import { describe, expect, it } from "vitest";
import { isTeamInviteNextPath, withNextParam } from "./teamInviteAuth";

describe("withNextParam", () => {
  it("keeps absolute redirect URLs absolute", () => {
    const out = withNextParam(
      "https://app.brewai.de/anmelden?mode=register&error=missing",
      "/invite/team/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );
    expect(out.startsWith("https://app.brewai.de/anmelden?")).toBe(true);
    expect(out).toContain("next=%2Finvite%2Fteam%2F");
  });

  it("leaves dashboard next alone", () => {
    expect(withNextParam("https://app.brewai.de/anmelden?error=x", "/dashboard")).toBe(
      "https://app.brewai.de/anmelden?error=x",
    );
  });
});

describe("isTeamInviteNextPath", () => {
  it("accepts team invite paths", () => {
    expect(
      isTeamInviteNextPath(
        "/invite/team/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      ),
    ).toBe(true);
  });

  it("rejects other paths", () => {
    expect(isTeamInviteNextPath("/dashboard")).toBe(false);
    expect(isTeamInviteNextPath("/invite/not-a-token")).toBe(false);
  });
});
