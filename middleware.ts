import { NextResponse, type NextRequest } from "next/server";
import { isPasswordResetPublicPath } from "@/lib/auth/passwordResetPaths";
import { LOGIN_WAITLIST_ENABLED } from "@/lib/featureFlags";
import { updateSession } from "@/lib/supabase/middleware";

/** Legacy App-/KI-Hosts → Canonical app.brewai.de (308 Permanent Redirect). */
const LEGACY_APP_HOSTS = new Set([
  "app.evglab.com",
  "www.app.evglab.com",
  "ki.evglab.com",
  "www.ki.evglab.com",
]);

function redirectLegacyAppHost(request: NextRequest): NextResponse | null {
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase();
  if (!host || !LEGACY_APP_HOSTS.has(host)) return null;
  const target = request.nextUrl.clone();
  target.protocol = "https:";
  target.hostname = "app.brewai.de";
  target.port = "";
  return NextResponse.redirect(target, 308);
}

export async function middleware(request: NextRequest) {
  const legacyRedirect = redirectLegacyAppHost(request);
  if (legacyRedirect) return legacyRedirect;

  const { pathname } = request.nextUrl;
  if (LOGIN_WAITLIST_ENABLED) {
    const passwordResetAllowed = isPasswordResetPublicPath(pathname, request.nextUrl.searchParams);
    const oauthPathsAllowedDuringWaitlist = new Set([
      "/auth/google",
      "/auth/callback",
      "/auth/finish",
    ]);
    const isBlockedAuthPath =
      !passwordResetAllowed &&
      !oauthPathsAllowedDuringWaitlist.has(pathname) &&
      (pathname === "/registrieren" ||
        (pathname.startsWith("/auth/") &&
          pathname !== "/auth/signout" &&
          pathname !== "/auth/signin" &&
          pathname !== "/auth/admin-signin" &&
          pathname !== "/auth/signup" &&
          pathname !== "/auth/admin-2fa/verify"));
    if (isBlockedAuthPath) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/anmelden";
      redirectUrl.search = "waitlist=1";
      return NextResponse.redirect(redirectUrl, 307);
    }
  }

  const needsAuthSession =
    pathname.startsWith("/dashboard") ||
    (pathname.startsWith("/admin") && pathname !== "/admin/anmelden") ||
    pathname.startsWith("/invite") ||
    pathname.startsWith("/inhalte-erstellen") ||
    pathname.startsWith("/videos-erstellen") ||
    pathname.startsWith("/auth/finish") ||
    pathname === "/anmelden" ||
    pathname === "/registrieren" ||
    pathname === "/passwort-vergessen" ||
    pathname === "/passwort-zuruecksetzen";

  if (!needsAuthSession) {
    return NextResponse.next();
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
