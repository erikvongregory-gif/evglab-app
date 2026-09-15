import { afterEach, describe, expect, it, vi } from "vitest";
import { getAppBaseUrlOrigin } from "./env";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  vi.unstubAllEnvs();
  process.env = { ...ORIGINAL_ENV };
});

describe("getAppBaseUrlOrigin", () => {
  it("nutzt requestOrigin ohne konfigurierte URL", () => {
    delete process.env.NEXT_PUBLIC_APP_BASE_URL;
    expect(getAppBaseUrlOrigin("http://localhost:3001")).toBe("http://localhost:3001");
  });

  it("nutzt konfigurierte Produktions-URL in Production", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.NEXT_PUBLIC_APP_BASE_URL = "https://app.brewai.de";
    expect(getAppBaseUrlOrigin("https://app.brewai.de")).toBe("https://app.brewai.de");
  });

  it("bleibt auf localhost auch in Production-Modus (lokales next start)", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.NEXT_PUBLIC_APP_BASE_URL = "https://app.brewai.de";
    expect(getAppBaseUrlOrigin("http://localhost:3000")).toBe("http://localhost:3000");
  });

  it("bleibt auf localhost in Development trotz Produktions-URL", () => {
    vi.stubEnv("NODE_ENV", "development");
    process.env.NEXT_PUBLIC_APP_BASE_URL = "https://app.brewai.de";
    expect(getAppBaseUrlOrigin("http://localhost:3000")).toBe("http://localhost:3000");
  });

  it("behält den Dev-Port auch wenn Env einen anderen localhost-Port hat", () => {
    process.env.NEXT_PUBLIC_APP_BASE_URL = "http://localhost:3001";
    expect(getAppBaseUrlOrigin("http://localhost:3000")).toBe("http://localhost:3000");
  });

  it("nutzt konfigurierte URL in Development bei gleichem Host", () => {
    vi.stubEnv("NODE_ENV", "development");
    process.env.NEXT_PUBLIC_APP_BASE_URL = "http://localhost:3001";
    expect(getAppBaseUrlOrigin("http://localhost:3001")).toBe("http://localhost:3001");
  });
});
