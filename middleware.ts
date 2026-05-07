import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const loginWaitlistEnabled = process.env.NEXT_PUBLIC_LOGIN_WAITLIST_ENABLED !== "0";
  if (loginWaitlistEnabled) {
    const isBlockedAuthPath =
      pathname === "/registrieren" ||
      (pathname.startsWith("/auth/") && pathname !== "/auth/signout");
    if (isBlockedAuthPath) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/anmelden";
      redirectUrl.search = "waitlist=1";
      return NextResponse.redirect(redirectUrl, 307);
    }
  }

  const needsAuthSession =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/invite") ||
    pathname === "/anmelden" ||
    pathname === "/registrieren";

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
