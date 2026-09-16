import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import {
  bridgeOAuthSession,
  peekBridgedOAuthSession,
  pkceVerifierHashFromRequest,
} from "@/lib/supabase/oauthSessionBridge";

describe("oauthSessionBridge", () => {
  it("binds restored sessions to the PKCE verifier of the original browser", () => {
    const code = "oauth-code-1";
    const request = new Request("https://app.brewai.de/auth/callback?code=oauth-code-1", {
      headers: {
        cookie: "sb-xyz-auth-token-code-verifier=verifier-secret",
      },
    });
    const hash = pkceVerifierHashFromRequest(request);
    expect(hash).toBeTruthy();

    const response = NextResponse.redirect("https://app.brewai.de/dashboard");
    response.cookies.set("sb-xyz-auth-token", "session-value");
    bridgeOAuthSession(code, response, "user-1", hash!);

    expect(peekBridgedOAuthSession(code, null)).toBeNull();
    expect(
      peekBridgedOAuthSession(
        code,
        pkceVerifierHashFromRequest(
          new Request("https://app.brewai.de/auth/callback", {
            headers: { cookie: "sb-xyz-auth-token-code-verifier=other-browser" },
          }),
        ),
      ),
    ).toBeNull();

    const restored = peekBridgedOAuthSession(code, hash);
    expect(restored?.userId).toBe("user-1");
    expect(restored?.cookies.some((c) => c.name === "sb-xyz-auth-token")).toBe(true);
  });
});
