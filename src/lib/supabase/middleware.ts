import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl, isInviteOnlyEnabled } from "@/lib/supabase/env";
import { getOrCreateRequestId } from "@/lib/security/authObservability";

export async function updateSession(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const supabaseResponse = NextResponse.next({ request });
  supabaseResponse.headers.set("x-request-id", requestId);

  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
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

  const pathname = request.nextUrl.pathname;

  if (user && (pathname === "/anmelden" || pathname === "/registrieren")) {
    const plan = request.nextUrl.searchParams.get("plan");
    const checkout = request.nextUrl.searchParams.get("checkout");
    const source = request.nextUrl.searchParams.get("source");
    const dashboardUrl = new URL("/dashboard", request.url);
    if (
      (plan === "start" || plan === "growth" || plan === "pro") &&
      checkout === "1" &&
      source === "homepage_pricing"
    ) {
      dashboardUrl.searchParams.set("plan", plan);
      dashboardUrl.searchParams.set("checkout", "1");
      dashboardUrl.searchParams.set("source", source);
      dashboardUrl.searchParams.set("tab", "pricing");
    }
    const redirect = NextResponse.redirect(dashboardUrl);
    redirect.headers.set("x-request-id", requestId);
    redirect.headers.set("Cache-Control", "no-store, max-age=0");
    return redirect;
  }

  if (!user && (pathname.startsWith("/dashboard") || pathname.startsWith("/admin"))) {
    const loginUrl = new URL("/anmelden", request.url);
    for (const key of ["plan", "checkout", "source", "tab"] as const) {
      const value = request.nextUrl.searchParams.get(key);
      if (value) loginUrl.searchParams.set(key, value);
    }
    const redirect = NextResponse.redirect(loginUrl);
    redirect.headers.set("x-request-id", requestId);
    redirect.headers.set("Cache-Control", "no-store, max-age=0");
    return redirect;
  }

  if (isInviteOnlyEnabled() && pathname === "/registrieren") {
    const redirect = NextResponse.redirect(new URL("/anmelden?mode=register&error=invite_required", request.url));
    redirect.headers.set("x-request-id", requestId);
    redirect.headers.set("Cache-Control", "no-store, max-age=0");
    return redirect;
  }

  return supabaseResponse;
}
