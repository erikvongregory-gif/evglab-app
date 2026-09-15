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
});
