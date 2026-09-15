import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import { clearIncomingSupabaseAuthCookies } from "./clearAuthCookies";

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

    const cookies = response.cookies.getAll();
    expect(cookies.filter((cookie) => cookie.name.includes("auth-token"))).toHaveLength(2);
    expect(cookies.every((cookie) => cookie.value === "" && cookie.maxAge === 0)).toBe(true);
    expect(cookies.some((cookie) => cookie.name === "theme")).toBe(false);
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

    const cookies = response.cookies.getAll();
    expect(cookies.some((cookie) => cookie.name.startsWith("sb-"))).toBe(true);
    expect(cookies.every((cookie) => cookie.value === "" && cookie.maxAge === 0)).toBe(true);
    expect(cookies.some((cookie) => cookie.name === "theme")).toBe(false);
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

    const cookies = response.cookies.getAll();
    expect(cookies.some((cookie) => cookie.name.endsWith("-auth-token-code-verifier"))).toBe(false);
    expect(cookies.some((cookie) => cookie.name.endsWith("-auth-token.0"))).toBe(true);
  });
});
