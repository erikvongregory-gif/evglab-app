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

const ADMIN_LOGIN_PATH = "/admin/anmelden";

export async function POST(request: Request) {
  const startedAt = Date.now();
  const requestId = getOrCreateRequestId(request);
  const origin = getAppBaseUrlOrigin(new URL(request.url).origin);
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  if (!isSupabaseConfigured()) {
    return createNoStoreRedirect(`${origin}${ADMIN_LOGIN_PATH}?error=config`, requestId);
  }

  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = normalizeNextPath(String(formData.get("next") ?? "/admin"));
  const identifier = buildCompositeIdentifier(request, [email]);
  const rateError = await enforceRateLimitPersistent(
    request,
    {
      keyPrefix: "auth-admin-signin",
      limit: 8,
      windowMs: 60_000,
    },
    { identifier },
  );
  if (rateError) return rateError;

  if (!email || !password) {
    return createNoStoreRedirect(`${origin}${ADMIN_LOGIN_PATH}?error=missing`, requestId);
  }

  const finishTarget = `${origin}/auth/finish?next=${encodeURIComponent(next)}`;
  const redirectResponse = createNoStoreRedirect(finishTarget, requestId);

  const supabase = await createAuthRouteHandlerClient(redirectResponse);
  const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const errorCode = mapSignInErrorCode(error);
    logAuthEvent({
      event: "admin_signin_failed",
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
    return createNoStoreRedirect(`${origin}${ADMIN_LOGIN_PATH}?${params.toString()}`, requestId);
  }

  const user = signInData.user;
  if (user) {
    await repairOversizedMetadataForUser(supabase, user.id, user.user_metadata);
  }

  const role =
    typeof user?.user_metadata?.role === "string"
      ? String(user.user_metadata.role).toLowerCase()
      : "";
  if (role !== "admin") {
    await supabase.auth.signOut();
    return createNoStoreRedirect(`${origin}${ADMIN_LOGIN_PATH}?error=auth`, requestId);
  }

  const admin2fa = await redirectWithAdminEmail2FAIfNeeded(request, {
    user,
    requestId,
    origin,
    cookieSource: redirectResponse,
    startedAt,
    logEvent: "admin_signin_2fa_required",
  });
  if (admin2fa) return admin2fa;

  logAuthEvent({
    event: "admin_signin_success",
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
