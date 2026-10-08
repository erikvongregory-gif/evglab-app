import { describe, expect, it } from "vitest";
import { enforceSameOrigin } from "./requestGuards";

const request = (headers: Record<string, string>, method = "POST") =>
  new Request("https://app.brewai.de/api/dashboard/settings", { method, headers });

describe("browser origin boundary", () => {
  it("allows explicit app and marketing origins and local development", () => {
    for (const origin of ["https://app.brewai.de", "https://brewai.de"]) {
      expect(enforceSameOrigin(request({ origin }))).toBeNull();
    }
    expect(enforceSameOrigin(new Request("http://localhost:3001/api", {
      method: "POST", headers: { origin: "http://localhost:3001" },
    }))).toBeNull();
  });

  it("does not let proxy destination headers authorize a foreign or missing source", () => {
    const proxy = { "x-forwarded-host": "app.brewai.de", "x-forwarded-proto": "https" };
    for (const headers of [proxy, { ...proxy, referer: "https://evil.example/attack" },
      { ...proxy, "sec-fetch-site": "cross-site" }]) {
      expect(enforceSameOrigin(request(headers))?.status).toBe(403);
    }
  });

  it("never falls back after an explicitly rejected origin or referer", () => {
    const cases: Record<string, string>[] = [
      { origin: "null", "sec-fetch-site": "same-origin" },
      { origin: "https://evil.example", referer: "https://app.brewai.de/" },
      { referer: "https://evil.example/", "sec-fetch-site": "same-origin" },
      { referer: "invalid", "sec-fetch-site": "same-origin" },
    ];
    for (const headers of cases) expect(enforceSameOrigin(request(headers))?.status).toBe(403);
  });

  it("only trusts same-origin metadata without origin or referer", () => {
    expect(enforceSameOrigin(request({ "sec-fetch-site": "same-origin" }))).toBeNull();
    expect(enforceSameOrigin(request({ referer: "https://brewai.de/login" }))).toBeNull();
    for (const site of ["same-site", "cross-site", "none"]) {
      expect(enforceSameOrigin(request({ "sec-fetch-site": site }))?.status).toBe(403);
    }
    expect(enforceSameOrigin(request({ "sec-fetch-site": "none" }, "GET"))).toBeNull();
  });
});
