import type { User } from "@supabase/supabase-js";
import type { NextResponse } from "next/server";
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
import { appendResponseCookies, createNoStoreRedirect, secureCookieOptions } from "@/lib/security/authResponses";

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

function twoFactorUrl(origin: string, next?: string, error?: string) {
  const url = new URL(`${origin}/dashboard/2fa-email`);
  if (next && next !== "/dashboard") url.searchParams.set("next", next);
  if (error) url.searchParams.set("error", error);
  return url.toString();
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
    const failed = createNoStoreRedirect(twoFactorUrl(origin, next, "email_failed"), requestId);
    appendResponseCookies(failed, cookieSource);
    logAuthEvent({
      event: "signin_2fa_email_failed",
      level: "warn",
      requestId,
      userId: user.id,
      email: user.email,
      status: 303,
      durationMs: Date.now() - startedAt,
      meta: { message: error instanceof Error ? error.message : "" },
    });
    return failed;
  }

  const response = createNoStoreRedirect(twoFactorUrl(origin, next), requestId);
  response.cookies.set(getPendingCookieName(), buildPending2FAToken({
    userId: user.id,
    email: user.email,
    code,
    ttlSeconds: PENDING_TTL_SECONDS,
  }), {
    httpOnly: true,
    ...secureCookieOptions(request),
    maxAge: PENDING_TTL_SECONDS,
  });
  appendResponseCookies(response, cookieSource);
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
