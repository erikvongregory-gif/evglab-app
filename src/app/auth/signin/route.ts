import { NextResponse } from "next/server";
import { redirectWithAdminEmail2FAIfNeeded } from "@/lib/admin/postSignInAdmin2FA";
import { getAppBaseUrlOrigin, isSupabaseConfigured } from "@/lib/supabase/env";
import { mapSignInErrorCode, signInErrorDetail } from "@/lib/auth/signInErrors";
import { repairOversizedMetadataForUser } from "@/lib/auth/repairOversizedMetadata";
import { createAuthRouteHandlerClient } from "@/lib/supabase/server";
import { logAuthEvent, getOrCreateRequestId } from "@/lib/security/authObservability";
import {
  createNoStoreRedirect,
  createOAuthSessionPollerHtml,
  normalizeNextPath,
} from "@/lib/security/authResponses";
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

  const finishTarget = `${origin}/auth/finish?next=${encodeURIComponent(next)}`;
  const redirectResponse = createNoStoreRedirect(finishTarget, requestId);

  const supabase = await createAuthRouteHandlerClient(redirectResponse);
  const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const errorCode = mapSignInErrorCode(error);
    logAuthEvent({
      event: "signin_failed",
      level: "warn",
      requestId,
      email,
      status: 303,
      durationMs: Date.now() - startedAt,
      meta: {
        reason: errorCode,
        supabaseCode: error.code,
        supabaseMessage: signInErrorDetail(error),
      },
    });
    const params = new URLSearchParams({ error: errorCode });
    const detail = signInErrorDetail(error);
    if (process.env.NODE_ENV === "development" && detail) {
      params.set("detail", detail);
    }
    return createNoStoreRedirect(`${origin}/anmelden?${params.toString()}`, requestId);
  }

  const user = signInData.user;
  if (user) {
    await repairOversizedMetadataForUser(supabase, user.id, user.user_metadata);
  }

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
  const successUrl = `${origin}${next}`;
  return createOAuthSessionPollerHtml(
    { successUrl, fallbackUrl: finishTarget, requestId },
    redirectResponse,
  );
}
