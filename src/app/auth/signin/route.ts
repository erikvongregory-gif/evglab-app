import { NextResponse } from "next/server";
import {
  buildPending2FAToken,
  createOneTimeCode,
  getPendingCookieName,
  sendAdmin2FACodeEmail,
} from "@/lib/admin/emailTwoFactor";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createRouteHandlerClient } from "@/lib/supabase/server";
import { logAuthEvent, getOrCreateRequestId } from "@/lib/security/authObservability";
import {
  createNoStoreRedirect,
  normalizeNextPath,
  secureCookieOptions,
} from "@/lib/security/authResponses";
import { buildCompositeIdentifier, enforceRateLimitPersistent, enforceSameOrigin } from "@/lib/security/requestGuards";

export async function POST(request: Request) {
  const startedAt = Date.now();
  const requestId = getOrCreateRequestId(request);
  const { origin } = new URL(request.url);
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const cookieOptions = secureCookieOptions(request);
  if (!isSupabaseConfigured()) {
    return createNoStoreRedirect(`${origin}/?auth=signin&error=config`, requestId);
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
    return createNoStoreRedirect(`${origin}/?auth=signin&error=missing`, requestId);
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
    return createNoStoreRedirect(`${origin}/?auth=signin&error=auth`, requestId);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role =
    typeof user?.user_metadata?.role === "string"
      ? String(user.user_metadata.role).toLowerCase()
      : "";
  if (role === "admin" && user?.id && user.email) {
    const code = createOneTimeCode();
    try {
      await sendAdmin2FACodeEmail({ to: user.email, code });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const errorCode = message.includes("RESEND_API_KEY") || message.includes("ADMIN_2FA_FROM_EMAIL")
        ? "admin_2fa_email_config"
        : "admin_2fa_email_failed";
      return createNoStoreRedirect(`${origin}/?auth=signin&error=${errorCode}`, requestId);
    }
    const pendingToken = buildPending2FAToken({
      userId: user.id,
      email: user.email,
      code,
      ttlSeconds: 600,
    });
    const response = createNoStoreRedirect(
      `${origin}/?auth=signin&notice=admin_2fa_required`,
      requestId,
    );
    response.cookies.set(getPendingCookieName(), pendingToken, {
      httpOnly: true,
      ...cookieOptions,
      maxAge: 60 * 10,
    });
    logAuthEvent({
      event: "signin_admin_2fa_required",
      requestId,
      userId: user.id,
      email: user.email,
      status: 303,
      durationMs: Date.now() - startedAt,
    });
    return withAuthCookies(response);
  }

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
