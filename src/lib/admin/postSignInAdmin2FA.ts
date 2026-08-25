import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  PENDING_TTL_SECONDS,
  buildPending2FAToken,
  createOneTimeCode,
  getPendingCookieName,
  getTrustedDeviceCookieName,
  isTrustedDeviceForUser,
  send2FACodeEmail,
} from "@/lib/admin/emailTwoFactor";
import { logAuthEvent } from "@/lib/security/authObservability";
import { createNoStoreRedirect, secureCookieOptions } from "@/lib/security/authResponses";

function copyResponseCookies(target: NextResponse, source: NextResponse) {
  for (const cookie of source.cookies.getAll()) {
    target.cookies.set(cookie.name, cookie.value, cookie);
  }
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return null;
}

/**
 * Nach gültiger Supabase-Session: 2FA ist für jedes Konto Pflicht. Geräte, die
 * die Prüfung schon bestanden haben, tragen ein Trusted-Device-Cookie und
 * überspringen den Code für dessen Laufzeit.
 */
export async function redirectWithEmail2FAIfNeeded(
  request: Request,
  opts: {
    user: User | null;
    requestId: string;
    origin: string;
    cookieSource: NextResponse;
    startedAt: number;
    logEvent?: string;
    next?: string;
  },
): Promise<NextResponse | null> {
  const { user, requestId, origin, cookieSource, startedAt, logEvent = "signin_2fa_required", next } = opts;
  if (!user?.email) return null;

  const trustedDevice = readCookie(request, getTrustedDeviceCookieName());
  if (isTrustedDeviceForUser(trustedDevice, user.id)) return null;

  const code = createOneTimeCode();
  try {
    await send2FACodeEmail({ to: user.email, code });
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
    ttlSeconds: PENDING_TTL_SECONDS,
  });

  const verifyUrl = new URL(`${origin}/dashboard/2fa-email`);
  if (next) verifyUrl.searchParams.set("next", next);
  const response = createNoStoreRedirect(verifyUrl.toString(), requestId);
  response.cookies.set(getPendingCookieName(), pendingToken, {
    httpOnly: true,
    ...secureCookieOptions(request),
    maxAge: PENDING_TTL_SECONDS,
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
