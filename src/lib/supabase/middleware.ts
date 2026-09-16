import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getDashboardMetadata } from "@/lib/dashboard/metadata";
import {
  resolveStudioEntryPath,
  sanitizeStudioOnboardingState,
} from "@/lib/dashboard/onboarding";
import { getSupabaseAnonKey, getSupabaseUrl, isInviteOnlyEnabled } from "@/lib/supabase/env";
import { getOrCreateRequestId } from "@/lib/security/authObservability";
import { clearIncomingSupabaseAuthCookies } from "@/lib/supabase/clearAuthCookies";
import { getSharedCookieDomain } from "@/lib/siteConfig";

const AUTH_COOKIE_SWEEP_PATHS = new Set([
  "/anmelden",
  "/registrieren",
  // /auth/google absichtlich nicht: Middleware-Max-Age=0 race’t mit dem neuen PKCE-Verifier
  // (Set-Cookie) und erzeugt dauerhaft pkce_code_verifier_not_found / oauth_state.
  "/auth/signin",
  "/auth/signup",
  "/auth/callback",
  "/auth/signout",
  "/auth/clear-session",
]);

function withSharedCookieDomain<T extends { domain?: string }>(options: T): T {
  const domain = getSharedCookieDomain();
  if (!domain) return options;
  return { ...options, domain };
}

function onboardingStateFromUser(user: { user_metadata?: Record<string, unknown> }) {
  return sanitizeStudioOnboardingState(getDashboardMetadata(user.user_metadata).onboarding);
}

function redirectWithRequestId(url: URL, requestId: string) {
  const redirect = NextResponse.redirect(url);
  redirect.headers.set("x-request-id", requestId);
  redirect.headers.set("Cache-Control", "no-store, max-age=0");
  return redirect;
}

export async function updateSession(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const pathname = request.nextUrl.pathname;
  const supabaseResponse = NextResponse.next({ request });
  supabaseResponse.headers.set("x-request-id", requestId);

  if (AUTH_COOKIE_SWEEP_PATHS.has(pathname)) {
    clearIncomingSupabaseAuthCookies(request, supabaseResponse, {
      preserveCodeVerifier: pathname === "/auth/callback",
      allSupabase: pathname === "/auth/clear-session",
    });
  }

  // Auth-Handler lesen/schreiben Session selbst — kein getUser() mit riesigen Cookie-Jars.
  if (
    pathname === "/auth/callback" ||
    pathname === "/auth/google" ||
    pathname === "/auth/clear-session"
  ) {
    return supabaseResponse;
  }

  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, key, {
    cookieOptions: {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      ...(getSharedCookieDomain() ? { domain: getSharedCookieDomain() } : {}),
    },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, withSharedCookieDomain(options));
        });
        Object.entries(headers).forEach(([k, v]) => {
          if (k.toLowerCase() === "set-cookie") return;
          supabaseResponse.headers.set(k, v);
        });
      },
    },
  });

  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"] = null;
  try {
    const authResult = await Promise.race([
      supabase.auth.getUser(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("middleware_auth_timeout")), 25_000);
      }),
    ]);
    user = authResult.data.user;
  } catch {
    return supabaseResponse;
  }

  if (user && (pathname === "/anmelden" || pathname === "/registrieren")) {
    const plan = request.nextUrl.searchParams.get("plan");
    const checkout = request.nextUrl.searchParams.get("checkout");
    const source = request.nextUrl.searchParams.get("source");
    const onboarding = onboardingStateFromUser(user);
    const requestedNext = request.nextUrl.searchParams.get("next");
    const entry = requestedNext?.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : resolveStudioEntryPath(onboarding, "/dashboard");
    const targetUrl = new URL(entry, request.url);
    if (
      entry === "/dashboard" &&
      (plan === "start" || plan === "growth" || plan === "pro") &&
      checkout === "1" &&
      source === "homepage_pricing"
    ) {
      targetUrl.searchParams.set("plan", plan);
      targetUrl.searchParams.set("checkout", "1");
      targetUrl.searchParams.set("source", source);
      targetUrl.searchParams.set("tab", "pricing");
    }
    return redirectWithRequestId(targetUrl, requestId);
  }


  if (!user && (pathname.startsWith("/dashboard") || pathname.startsWith("/admin") || pathname.startsWith("/onboarding"))) {
    const loginUrl = new URL("/anmelden", request.url);
    for (const key of ["plan", "checkout", "source", "tab"] as const) {
      const value = request.nextUrl.searchParams.get(key);
      if (value) loginUrl.searchParams.set(key, value);
    }
    return redirectWithRequestId(loginUrl, requestId);
  }

  if (isInviteOnlyEnabled() && pathname === "/registrieren") {
    return redirectWithRequestId(
      new URL("/anmelden?mode=register&error=invite_required", request.url),
      requestId,
    );
  }

  return supabaseResponse;
}
