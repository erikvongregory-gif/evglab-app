import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import { clearIncomingSupabaseAuthCookies } from "./clearAuthCookies";

function setCookieHeaders(response: NextResponse): string[] {
  const getSetCookie = response.headers.getSetCookie?.bind(response.headers);
  if (getSetCookie) return getSetCookie();
  const single = response.headers.get("set-cookie");
  return single ? [single] : [];
}

describe("clearIncomingSupabaseAuthCookies", () => {
  it("expires obsolete chunked auth cookies without touching unrelated cookies", () => {
    const request = new Request("https://app.brewai.de/auth/google", {
      headers: {
        cookie:
          "theme=dark; sb-lutmsbxcjmocftiovwfs-auth-token.0=old; sb-auth-auth-token.1=old; analytics=yes",
      },
    });
    const response = NextResponse.redirect("https://accounts.google.com");

    clearIncomingSupabaseAuthCookies(request, response);

    const headers = setCookieHeaders(response);
    expect(headers.some((h) => h.startsWith("sb-lutmsbxcjmocftiovwfs-auth-token.0="))).toBe(true);
    expect(headers.some((h) => h.startsWith("sb-auth-auth-token.1="))).toBe(true);
    expect(headers.every((h) => /Max-Age=0/i.test(h))).toBe(true);
    expect(headers.some((h) => h.startsWith("theme="))).toBe(false);
  });

  it("clears every Supabase cookie before a fresh Google OAuth start", () => {
    const request = new Request("https://app.brewai.de/auth/google", {
      headers: {
        cookie:
          "sb-old-auth-token.0=old; sb-old-auth-token-code-verifier=old; sb-old-other=value; theme=dark",
      },
    });
    const response = NextResponse.redirect("https://accounts.google.com");

    clearIncomingSupabaseAuthCookies(request, response, { allSupabase: true });

    const headers = setCookieHeaders(response);
    expect(headers.some((h) => h.startsWith("sb-old-"))).toBe(true);
    expect(headers.every((h) => /Max-Age=0/i.test(h))).toBe(true);
    expect(headers.some((h) => h.startsWith("theme="))).toBe(false);
  });

  it("preserves PKCE verifier cookies on OAuth callback sweeps", () => {
    const request = new Request("https://app.brewai.de/auth/callback", {
      headers: {
        cookie:
          "sb-lutmsbxcjmocftiovwfs-auth-token.0=old; sb-lutmsbxcjmocftiovwfs-auth-token-code-verifier=keep",
      },
    });
    const response = NextResponse.redirect("https://app.brewai.de/dashboard");

    clearIncomingSupabaseAuthCookies(request, response, { preserveCodeVerifier: true });

    const headers = setCookieHeaders(response);
    expect(headers.some((h) => h.includes("-auth-token-code-verifier="))).toBe(false);
    expect(headers.some((h) => h.includes("-auth-token.0="))).toBe(true);
  });

  it("clears brewai.de Domain cookies even when COOKIE_DOMAIN env is unset", () => {
    const request = new Request("https://app.brewai.de/auth/clear-session", {
      headers: { cookie: "sb-auth-auth-token-code-verifier=stale" },
    });
    const response = NextResponse.json({ ok: true });

    clearIncomingSupabaseAuthCookies(request, response, { allSupabase: true });

    const headers = setCookieHeaders(response);
    expect(headers.some((h) => h.includes("code-verifier=") && /Domain=brewai\.de/i.test(h))).toBe(true);
    expect(headers.some((h) => h.includes("code-verifier=") && !/Domain=/i.test(h))).toBe(true);
  });
});
