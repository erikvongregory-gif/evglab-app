import type { EmailOtpType } from "@supabase/supabase-js";
import { redirectWithAdminEmail2FAIfNeeded } from "@/lib/admin/postSignInAdmin2FA";
import { getAppBaseUrlOrigin, isInviteOnlyEnabled, isSupabaseConfigured } from "@/lib/supabase/env";
import { createRouteHandlerClient } from "@/lib/supabase/server";
import { createNoStoreRedirect, normalizeNextPath } from "@/lib/security/authResponses";
import { getOrCreateRequestId, logAuthEvent, withTimeout } from "@/lib/security/authObservability";

export async function GET(request: Request) {
  const startedAt = Date.now();
  const requestId = getOrCreateRequestId(request);
  const { searchParams, origin } = new URL(request.url);
  const appOrigin = getAppBaseUrlOrigin(origin);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const safeNext = normalizeNextPath(searchParams.get("next"));

  if (!isSupabaseConfigured()) {
    return createNoStoreRedirect(`${appOrigin}/anmelden?error=config`, requestId);
  }
  if (isInviteOnlyEnabled() && type === "signup") {
    return createNoStoreRedirect(`${appOrigin}/anmelden?error=invite_required`, requestId);
  }

  if (tokenHash && type) {
    const redirectResponse = createNoStoreRedirect(`${appOrigin}${safeNext}`, requestId);
    const supabase = createRouteHandlerClient(request, redirectResponse);
    const { error } = await withTimeout(
      supabase.auth.verifyOtp({ type, token_hash: tokenHash }),
      6_000,
      "auth_callback_verify_timeout",
    );
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const admin2fa = await redirectWithAdminEmail2FAIfNeeded(request, {
        user,
        requestId,
        origin,
        cookieSource: redirectResponse,
        startedAt,
      });
      if (admin2fa) return admin2fa;
      return redirectResponse;
    }
  }

  if (code) {
    const redirectResponse = createNoStoreRedirect(`${appOrigin}${safeNext}`, requestId);
    const supabase = createRouteHandlerClient(request, redirectResponse);
    try {
      const { error } = await withTimeout(
        supabase.auth.exchangeCodeForSession(code),
        6_000,
        "auth_callback_exchange_timeout",
      );
      if (!error) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const admin2fa = await redirectWithAdminEmail2FAIfNeeded(request, {
          user,
          requestId,
          origin,
          cookieSource: redirectResponse,
          startedAt,
          logEvent: "oauth_admin_2fa_required",
        });
        if (admin2fa) return admin2fa;
        return redirectResponse;
      }
    } catch {
      logAuthEvent({
        event: "callback_timeout",
        level: "warn",
        requestId,
        status: 303,
        durationMs: Date.now() - startedAt,
      });
    }
  }

  return createNoStoreRedirect(`${appOrigin}/anmelden?error=auth`, requestId);
}
