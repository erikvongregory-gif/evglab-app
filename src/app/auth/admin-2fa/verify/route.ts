import { NextRequest, NextResponse } from "next/server";
import {
  PENDING_TTL_SECONDS,
  TRUSTED_DEVICE_TTL_SECONDS,
  VERIFIED_TTL_SECONDS,
  buildPending2FAToken,
  buildTrustedDeviceToken,
  buildVerified2FAToken,
  createOneTimeCode,
  getPendingCookieName,
  getTrustedDeviceCookieName,
  getVerifiedCookieName,
  send2FACodeEmail,
  verifyOwnerBackupCode,
  verifyPending2FACode,
} from "@/lib/admin/emailTwoFactor";
import { isOwnerUser } from "@/lib/auth/owner";
import { enforceRateLimitPersistent, enforceSameOrigin } from "@/lib/security/requestGuards";
import { createNoStoreRedirect, normalizeNextPath, secureCookieOptions } from "@/lib/security/authResponses";
import { getOrCreateRequestId, logAuthEvent } from "@/lib/security/authObservability";
import { createRouteHandlerClient } from "@/lib/supabase/server";
import { getAppBaseUrlOrigin } from "@/lib/supabase/env";

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const requestId = getOrCreateRequestId(request);
  const origin = getAppBaseUrlOrigin(new URL(request.url).origin);
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const cookieOptions = secureCookieOptions(request);
  const formData = await request.formData();
  const action = String(formData.get("action") ?? "verify");
  const code = String(formData.get("code") ?? "").trim();
  const next = normalizeNextPath(String(formData.get("next") ?? "/dashboard"));
  const verifyPage = next === "/dashboard" ? "/dashboard/2fa-email" : `/dashboard/2fa-email?next=${encodeURIComponent(next)}`;

  const authResponse = NextResponse.next();
  const supabase = createRouteHandlerClient(request, authResponse);
  const withAuthCookies = (response: NextResponse) => {
    for (const cookie of authResponse.cookies.getAll()) {
      response.cookies.set(cookie.name, cookie.value, cookie);
    }
    return response;
  };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return createNoStoreRedirect(`${origin}/anmelden?error=auth`, requestId);
  }
  const baseIdentifier = `twofa:${user.id}`;
  const baseRateError = await enforceRateLimitPersistent(request, {
    keyPrefix: "two-factor-verify-base",
    limit: 20,
    windowMs: 60_000,
  }, { identifier: baseIdentifier });
  if (baseRateError) return baseRateError;

  const pendingToken = request.cookies.get(getPendingCookieName())?.value ?? null;
  const usedBackupCode = Boolean(code) && isOwnerUser(user) && verifyOwnerBackupCode(code);
  const withQuery = (path: string, query: string) => `${origin}${path}${path.includes("?") ? "&" : "?"}${query}`;

  // "send" deckt beide Fälle ab: erneut senden und erstmalig anfordern, wenn
  // eine bestehende Session noch kein Pending-Cookie hat.
  if (action === "resend" || action === "send") {
    const resendRateError = await enforceRateLimitPersistent(
      request,
      { keyPrefix: "two-factor-send", limit: 5, windowMs: 10 * 60_000 },
      { identifier: baseIdentifier },
    );
    if (resendRateError) return resendRateError;
    const newCode = createOneTimeCode();
    try {
      await send2FACodeEmail({ to: user.email, code: newCode });
    } catch {
      return createNoStoreRedirect(withQuery(verifyPage, "error=email_failed"), requestId);
    }
    const nextPending = buildPending2FAToken({
      userId: user.id,
      email: user.email,
      code: newCode,
      ttlSeconds: PENDING_TTL_SECONDS,
    });
    const sendResponse = createNoStoreRedirect(withQuery(verifyPage, "notice=resent"), requestId);
    sendResponse.cookies.set(getPendingCookieName(), nextPending, {
      httpOnly: true,
      ...cookieOptions,
      maxAge: PENDING_TTL_SECONDS,
    });
    logAuthEvent({
      event: "two_factor_code_sent",
      requestId,
      userId: user.id,
      email: user.email,
      status: 303,
      durationMs: Date.now() - startedAt,
    });
    return withAuthCookies(sendResponse);
  }

  if (!code) {
    return createNoStoreRedirect(withQuery(verifyPage, "error=missing_code"), requestId);
  }
  if (!pendingToken && !usedBackupCode) {
    return createNoStoreRedirect(withQuery(verifyPage, "error=admin_2fa_session_expired"), requestId);
  }
  const verifyRateError = await enforceRateLimitPersistent(
    request,
    { keyPrefix: "two-factor-code-verify", limit: 5, windowMs: 10 * 60_000 },
    { identifier: baseIdentifier },
  );
  if (verifyRateError) return verifyRateError;

  const result = usedBackupCode ? { ok: true as const } : verifyPending2FACode(pendingToken, { userId: user.id, code });
  if (!result.ok) {
    logAuthEvent({
      event: "two_factor_verify_failed",
      level: "warn",
      requestId,
      userId: user.id,
      email: user.email,
      status: 303,
      durationMs: Date.now() - startedAt,
    });
    return createNoStoreRedirect(withQuery(verifyPage, "error=admin_2fa_invalid"), requestId);
  }

  const done = createNoStoreRedirect(`${origin}${next}`, requestId);
  done.cookies.set(getVerifiedCookieName(), buildVerified2FAToken({ userId: user.id }), {
    httpOnly: true,
    ...cookieOptions,
    maxAge: VERIFIED_TTL_SECONDS,
  });
  done.cookies.set(getTrustedDeviceCookieName(), buildTrustedDeviceToken({ userId: user.id }), {
    httpOnly: true,
    ...cookieOptions,
    maxAge: TRUSTED_DEVICE_TTL_SECONDS,
  });
  done.cookies.set(getPendingCookieName(), "", {
    httpOnly: true,
    ...cookieOptions,
    maxAge: 0,
  });
  logAuthEvent({
    event: usedBackupCode ? "two_factor_backup_code_used" : "two_factor_verified",
    requestId,
    userId: user.id,
    email: user.email,
    status: 303,
    durationMs: Date.now() - startedAt,
  });
  return withAuthCookies(done);
}
