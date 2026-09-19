import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function stubWindow(search = "") {
  const href = search ? `http://localhost/dashboard${search}` : "http://localhost/dashboard";
  vi.stubGlobal("window", {
    location: { href, search },
    history: { replaceState: vi.fn() },
    dispatchEvent: vi.fn(),
  });
}

describe("runBillingBootstrap", () => {
  beforeEach(() => {
    vi.resetModules();
    stubWindow();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("lädt im Normalfall nur Billing-State und ruft Stripe-Sync nicht auf", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/billing/sync")) {
        return new Response("{}", { status: 200 });
      }
      if (url.includes("/api/billing/state")) {
        return Response.json({
          state: {
            plan: "start",
            monthlyTokens: 1000,
            usedTokens: 100,
            remainingTokens: 900,
            status: "active",
          },
        });
      }
      throw new Error(`unexpected fetch ${url} ${init?.method ?? "GET"}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { runBillingBootstrap } = await import("./clientBootstrap");
    const result = await runBillingBootstrap();

    expect(result.state?.remainingTokens).toBe(900);
    expect(fetchMock.mock.calls.map(([url, init]) => [String(url), init?.method ?? "GET"])).toEqual([
      ["/api/billing/state", "GET"],
    ]);
  });

  it("synchronisiert bei ?billing=repair explizit mit Stripe", async () => {
    stubWindow("?billing=repair");

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/billing/sync")) return new Response("{}", { status: 200 });
      if (url.includes("/api/billing/state")) {
        return Response.json({
          state: {
            plan: null,
            monthlyTokens: 0,
            usedTokens: 0,
            remainingTokens: 0,
            status: "none",
          },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { runBillingBootstrap } = await import("./clientBootstrap");
    await runBillingBootstrap();

    const urls = fetchMock.mock.calls.map((call) => {
      const [input, init] = call as unknown as [RequestInfo | URL, RequestInit | undefined];
      return `${init?.method ?? "GET"} ${String(input)}`;
    });
    expect(urls).toContain("POST /api/billing/sync");
    expect(urls).toContain("GET /api/billing/state");
  });

  it("startet bei status none keinen Sync", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/billing/state")) {
        return Response.json({
          state: {
            plan: null,
            monthlyTokens: 0,
            usedTokens: 0,
            remainingTokens: 0,
            status: "none",
          },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { runBillingBootstrap } = await import("./clientBootstrap");
    const result = await runBillingBootstrap();

    expect(result.state?.status).toBe("none");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/billing/state");
  });
});
