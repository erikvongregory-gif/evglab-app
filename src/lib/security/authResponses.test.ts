import { describe, expect, it } from "vitest";
import {
  createHtmlRedirect,
  createOAuthSessionPollerHtml,
  jsonForHtmlScript,
  normalizeNextPath,
} from "@/lib/security/authResponses";

describe("normalizeNextPath", () => {
  it("keeps safe relative paths", () => {
    expect(normalizeNextPath("/dashboard")).toBe("/dashboard");
    expect(normalizeNextPath("/inhalte-erstellen?tab=1")).toBe("/inhalte-erstellen?tab=1");
  });

  it("rejects protocol-relative and external targets", () => {
    expect(normalizeNextPath("//evil.example")).toBe("/dashboard");
    expect(normalizeNextPath("/\\evil.example")).toBe("/dashboard");
    expect(normalizeNextPath("/\\\\evil.example")).toBe("/dashboard");
    expect(normalizeNextPath("https://evil.example")).toBe("/dashboard");
  });

  it("rejects encoded bypasses", () => {
    expect(normalizeNextPath("/%2f%2fevil.example")).toBe("/dashboard");
    expect(normalizeNextPath("/%5Cevil.example")).toBe("/dashboard");
  });
});

describe("jsonForHtmlScript", () => {
  it("escapes script breakouts that JSON.stringify alone would allow", () => {
    const payload = jsonForHtmlScript("https://app.example/</script><script>alert(1)</script>");
    expect(payload).not.toContain("</script>");
    expect(payload).toContain("\\u003c/script\\u003e");
  });
});

describe("HTML auth redirects", () => {
  it("does not embed raw closing script tags from redirect URLs", async () => {
    const evil = "/dashboard</script><script>alert(1)</script>";
    const html = createHtmlRedirect(evil, "req-1");
    const text = await html.text();
    expect(text).not.toMatch(/<\/script>\s*<script>alert/i);
    expect(text).toContain("\\u003c/script\\u003e");
  });

  it("escapes poller success and fallback URLs", async () => {
    const response = createOAuthSessionPollerHtml({
      successUrl: "https://app.example/</script><script>alert(1)</script>",
      fallbackUrl: "https://app.example/ok",
      requestId: "req-2",
    });
    const text = await response.text();
    expect(text).not.toMatch(/<\/script>\s*<script>alert/i);
    expect(text).toContain("\\u003c/script\\u003e");
  });
});
