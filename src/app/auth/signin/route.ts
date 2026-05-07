import { NextResponse } from "next/server";
import { redirectWithAdminEmail2FAIfNeeded } from "@/lib/admin/postSignInAdmin2FA";
import { getAppBaseUrlOrigin, isSupabaseConfigured } from "@/lib/supabase/env";
import { createRouteHandlerClient } from "@/lib/supabase/server";
import { logAuthEvent, getOrCreateRequestId } from "@/lib/security/authObservability";
import { createNoStoreRedirect, normalizeNextPath } from "@/lib/security/authResponses";
import { buildCompositeIdentifier, enforceRateLimitPersistent, enforceSameOrigin } from "@/lib/security/requestGuards";

export async function POST(request: Request) {
  const startedAt = Date.now();
  const requestId = getOrCreateRequestId(request);
  const origin = getAppBaseUrlOrigin(new URL(request.url).origin);
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  if (!isSupabaseConfigured()) {
    return createNoStoreRedirect(`${origin}/anmelden?error=config`, requestId);
  }

  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = normalizeNextPath(String(formData.get("next") ?? "/dashboard"));
  const identifier = buildCompositeIdentifier(request, [email]);
  const rateError = await enforceRateLimitPersistent(
    request,
    {
      keyPrefix: "auth-signin",
      limit: 8,
      windowMs: 60_000,
    },
    { identifier },
  );
  if (rateError) return rateError;

  if (!email || !password) {
    return createNoStoreRedirect(`${origin}/anmelden?error=missing`, requestId);
  }

  const redirectResponse = createNoStoreRedirect(`${origin}${next}`, requestId);
  const withAuthCookies = (response: NextResponse) => {
    for (const cookie of redirectResponse.cookies.getAll()) {
      response.cookies.set(cookie.name, cookie.value, cookie);
    }
    response.headers.set("x-request-id", requestId);
    return response;
  };

  const supabase = createRouteHandlerClient(request, redirectResponse);
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    logAuthEvent({
      event: "signin_failed",
      level: "warn",
      requestId,
      email,
      status: 303,
      durationMs: Date.now() - startedAt,
      meta: { reason: "auth" },
    });
    return createNoStoreRedirect(`${origin}/anmelden?error=auth`, requestId);
  }

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

  logAuthEvent({
    event: "signin_success",
    requestId,
    userId: user?.id,
    email: user?.email,
    status: 303,
    durationMs: Date.now() - startedAt,
  });
  return withAuthCookies(redirectResponse);
}
