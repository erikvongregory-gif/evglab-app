import { NextRequest, NextResponse } from "next/server";
import {
  buildPending2FAToken,
  buildVerified2FAToken,
  createOneTimeCode,
  getPendingCookieName,
  getVerifiedCookieName,
  sendAdmin2FACodeEmail,
  verifyPending2FACode,
} from "@/lib/admin/emailTwoFactor";
import { enforceRateLimitPersistent, enforceSameOrigin } from "@/lib/security/requestGuards";
import { createNoStoreRedirect, secureCookieOptions } from "@/lib/security/authResponses";
import { getOrCreateRequestId, logAuthEvent } from "@/lib/security/authObservability";
import { createRouteHandlerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const requestId = getOrCreateRequestId(request);
  const { origin } = new URL(request.url);
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const cookieOptions = secureCookieOptions(request);
  const formData = await request.formData();
  const action = String(formData.get("action") ?? "verify");
  const code = String(formData.get("code") ?? "").trim();

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
  const role =
    typeof user?.user_metadata?.role === "string"
      ? String(user.user_metadata.role).toLowerCase()
      : "";
  if (!user || role !== "admin" || !user.email) {
    return createNoStoreRedirect(`${origin}/?auth=signin&error=auth`, requestId);
  }
  const baseIdentifier = `admin2fa:${user.id}`;
  const baseRateError = await enforceRateLimitPersistent(request, {
    keyPrefix: "admin-2fa-verify-base",
    limit: 20,
    windowMs: 60_000,
  }, { identifier: baseIdentifier });
  if (baseRateError) return baseRateError;

  const pendingToken = request.cookies.get(getPendingCookieName())?.value ?? null;
  if (!pendingToken) {
    return createNoStoreRedirect(`${origin}/?auth=signin&error=admin_2fa_session_expired`, requestId);
  }

  if (action === "resend") {
    const resendRateError = await enforceRateLimitPersistent(
      request,
      { keyPrefix: "admin-2fa-resend", limit: 3, windowMs: 10 * 60_000 },
      { identifier: baseIdentifier },
    );
    if (resendRateError) return resendRateError;
    const newCode = createOneTimeCode();
    try {
      await sendAdmin2FACodeEmail({ to: user.email, code: newCode });
    } catch {
      return createNoStoreRedirect(
        `${origin}/?auth=signin&notice=admin_2fa_required&error=email_failed`,
        requestId,
      );
    }
    const nextPending = buildPending2FAToken({
      userId: user.id,
      email: user.email,
      code: newCode,
      ttlSeconds: 600,
    });
    const resendResponse = createNoStoreRedirect(
      `${origin}/?auth=signin&notice=admin_2fa_resent`,
      requestId,
    );
    resendResponse.cookies.set(getPendingCookieName(), nextPending, {
      httpOnly: true,
      ...cookieOptions,
      maxAge: 60 * 10,
    });
    logAuthEvent({
      event: "admin_2fa_code_resent",
      requestId,
      userId: user.id,
      email: user.email,
      status: 303,
      durationMs: Date.now() - startedAt,
    });
    return withAuthCookies(resendResponse);
  }

  if (!code) {
    return createNoStoreRedirect(
      `${origin}/?auth=signin&notice=admin_2fa_required&error=missing_code`,
      requestId,
    );
  }
  const verifyRateError = await enforceRateLimitPersistent(
    request,
    { keyPrefix: "admin-2fa-code-verify", limit: 5, windowMs: 10 * 60_000 },
    { identifier: baseIdentifier },
  );
  if (verifyRateError) return verifyRateError;

  const result = verifyPending2FACode(pendingToken, {
    userId: user.id,
    code,
  });
  if (!result.ok) {
    logAuthEvent({
      event: "admin_2fa_verify_failed",
      level: "warn",
      requestId,
      userId: user.id,
      email: user.email,
      status: 303,
      durationMs: Date.now() - startedAt,
    });
    return createNoStoreRedirect(
      `${origin}/?auth=signin&notice=admin_2fa_required&error=admin_2fa_invalid`,
      requestId,
    );
  }

  const verifiedToken = buildVerified2FAToken({
    userId: user.id,
    ttlSeconds: 60 * 60 * 12,
  });
  const done = createNoStoreRedirect(`${origin}/dashboard`, requestId);
  done.cookies.set(getVerifiedCookieName(), verifiedToken, {
    httpOnly: true,
    ...cookieOptions,
    maxAge: 60 * 60 * 12,
  });
  done.cookies.set(getPendingCookieName(), "", {
    httpOnly: true,
    ...cookieOptions,
    maxAge: 0,
  });
  logAuthEvent({
    event: "admin_2fa_verified",
    requestId,
    userId: user.id,
    email: user.email,
    status: 303,
    durationMs: Date.now() - startedAt,
  });
  return withAuthCookies(done);
}
