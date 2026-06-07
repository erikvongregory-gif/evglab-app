import { describe, expect, it } from "vitest";
import {
  assertSafePublicUrl,
  isBlockedHost,
  isInstagramUrl,
  normalizeWebsiteUrl,
  resolveAbsoluteUrl,
} from "@/lib/brand/url-intake";

describe("url-intake", () => {
  it("normalizes bare domains to https", () => {
    expect(normalizeWebsiteUrl("example.com")).toBe("https://example.com/");
  });

  it("blocks localhost and private IPs", () => {
    expect(isBlockedHost("localhost")).toBe(true);
    expect(isBlockedHost("127.0.0.1")).toBe(true);
    expect(isBlockedHost("10.0.0.5")).toBe(true);
    expect(isBlockedHost("192.168.1.1")).toBe(true);
    expect(isBlockedHost("172.16.0.1")).toBe(true);
    expect(isBlockedHost("example.com")).toBe(false);
  });

  it("rejects unsafe URLs in assertSafePublicUrl", () => {
    expect(() => assertSafePublicUrl(new URL("http://127.0.0.1/"))).toThrow();
    expect(() => assertSafePublicUrl(new URL("https://brauerei.de/"))).not.toThrow();
  });

  it("detects instagram URLs", () => {
    expect(isInstagramUrl("https://www.instagram.com/marke/")).toBe(true);
    expect(isInstagramUrl("https://brauerei.de")).toBe(false);
  });

  it("resolves relative image URLs", () => {
    expect(resolveAbsoluteUrl("https://brauerei.de/about", "/images/hero.jpg")).toBe(
      "https://brauerei.de/images/hero.jpg",
    );
  });
});
