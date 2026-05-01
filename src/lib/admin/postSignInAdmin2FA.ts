import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  buildPending2FAToken,
  createOneTimeCode,
  getPendingCookieName,
  sendAdmin2FACodeEmail,
} from "@/lib/admin/emailTwoFactor";
import { logAuthEvent } from "@/lib/security/authObservability";
import { createNoStoreRedirect, secureCookieOptions } from "@/lib/security/authResponses";

function copyResponseCookies(target: NextResponse, source: NextResponse) {
  for (const cookie of source.cookies.getAll()) {
    target.cookies.set(cookie.name, cookie.value, cookie);
  }
}

/**
 * Nach gültiger Supabase-Session: Admin bekommt E-Mail-Code + Pending-Cookie,
 * alle anderen bleiben auf dem normalen Redirect (cookieSource).
 */
export async function redirectWithAdminEmail2FAIfNeeded(
  request: Request,
  opts: {
    user: User | null;
    requestId: string;
    origin: string;
    cookieSource: NextResponse;
    startedAt: number;
    logEvent?: string;
  },
): Promise<NextResponse | null> {
  const { user, requestId, origin, cookieSource, startedAt, logEvent = "signin_admin_2fa_required" } = opts;
  if (!user?.email) return null;
  const role =
    typeof user.user_metadata?.role === "string"
      ? String(user.user_metadata.role).toLowerCase()
      : "";
  if (role !== "admin") return null;

  const code = createOneTimeCode();
  try {
    await sendAdmin2FACodeEmail({ to: user.email, code });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const errorCode =
      message.includes("RESEND_API_KEY") || message.includes("ADMIN_2FA_FROM_EMAIL")
        ? "admin_2fa_email_config"
        : "admin_2fa_email_failed";
    return createNoStoreRedirect(`${origin}/anmelden?error=${errorCode}`, requestId);
  }

  const pendingToken = buildPending2FAToken({
    userId: user.id,
    email: user.email,
    code,
    ttlSeconds: 600,
  });

  const response = createNoStoreRedirect(`${origin}/dashboard/2fa-email`, requestId);
  response.cookies.set(getPendingCookieName(), pendingToken, {
    httpOnly: true,
    ...secureCookieOptions(request),
    maxAge: 60 * 10,
  });
  copyResponseCookies(response, cookieSource);
  response.headers.set("x-request-id", requestId);
  logAuthEvent({
    event: logEvent,
    requestId,
    userId: user.id,
    email: user.email,
    status: 303,
    durationMs: Date.now() - startedAt,
  });
  return response;
}
