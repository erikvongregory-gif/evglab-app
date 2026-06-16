import { afterEach, describe, expect, it } from "vitest";
import { getAppBaseUrlOrigin } from "./env";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("getAppBaseUrlOrigin", () => {
  it("nutzt requestOrigin ohne konfigurierte URL", () => {
    delete process.env.NEXT_PUBLIC_APP_BASE_URL;
    expect(getAppBaseUrlOrigin("http://localhost:3001")).toBe("http://localhost:3001");
  });

  it("nutzt konfigurierte Produktions-URL in Production", () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_APP_BASE_URL = "https://app.evglab.com";
    expect(getAppBaseUrlOrigin("https://app.evglab.com")).toBe("https://app.evglab.com");
  });

  it("bleibt auf localhost auch in Production-Modus (lokales next start)", () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_APP_BASE_URL = "https://app.evglab.com";
    expect(getAppBaseUrlOrigin("http://localhost:3000")).toBe("http://localhost:3000");
  });

  it("bleibt auf localhost in Development trotz Produktions-URL", () => {
    process.env.NODE_ENV = "development";
    process.env.NEXT_PUBLIC_APP_BASE_URL = "https://app.evglab.com";
    expect(getAppBaseUrlOrigin("http://localhost:3000")).toBe("http://localhost:3000");
  });

  it("behält den Dev-Port auch wenn Env einen anderen localhost-Port hat", () => {
    process.env.NEXT_PUBLIC_APP_BASE_URL = "http://localhost:3001";
    expect(getAppBaseUrlOrigin("http://localhost:3000")).toBe("http://localhost:3000");
  });

  it("nutzt konfigurierte URL in Development bei gleichem Host", () => {
    process.env.NODE_ENV = "development";
    process.env.NEXT_PUBLIC_APP_BASE_URL = "http://localhost:3001";
    expect(getAppBaseUrlOrigin("http://localhost:3001")).toBe("http://localhost:3001");
  });
});
