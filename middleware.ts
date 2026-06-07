import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const loginWaitlistEnabled = process.env.NEXT_PUBLIC_LOGIN_WAITLIST_ENABLED !== "0";
  if (loginWaitlistEnabled) {
    const isBlockedAuthPath =
      pathname === "/registrieren" ||
      pathname === "/passwort-vergessen" ||
      pathname === "/passwort-zuruecksetzen" ||
      (pathname.startsWith("/auth/") &&
        pathname !== "/auth/signout" &&
        pathname !== "/auth/signin" &&
        pathname !== "/auth/admin-signin" &&
        pathname !== "/auth/signup" &&
        pathname !== "/auth/admin-2fa/verify");
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
