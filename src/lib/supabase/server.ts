import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import { getSharedCookieDomain } from "@/lib/siteConfig";

function supabaseCookieOptions() {
  const domain = getSharedCookieDomain();
  return {
    path: "/" as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    ...(domain ? { domain } : {}),
  };
}

function withSharedCookieDomain<T extends { domain?: string }>(options: T): T {
  const domain = getSharedCookieDomain();
  if (!domain) return options;
  return { ...options, domain };
}

export async function createClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) {
    throw new Error(
      "Supabase env fehlt: NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY (oder PUBLISHABLE_KEY).",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookieOptions: supabaseCookieOptions(),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, withSharedCookieDomain(options)),
          );
        } catch {
          /* Schreiben nur in Middleware / Route Handler; RSC ignorieren */
        }
      },
    },
  });
}

/**
 * Supabase-Client für Auth-Route-Handler.
 * Liest Cookies über next/headers (chunk-safe), schreibt auf Response + Cookie-Store.
 */
export async function createAuthRouteHandlerClient(response: NextResponse) {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) {
    throw new Error(
      "Supabase env fehlt: NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY (oder PUBLISHABLE_KEY).",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookieOptions: supabaseCookieOptions(),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value, options }) => {
          const opts = withSharedCookieDomain(options);
          try {
            cookieStore.set(name, value, opts);
          } catch {
            /* Route Handler */
          }
          response.cookies.set(name, value, opts);
        });
        Object.entries(headers).forEach(([k, v]) => {
          if (k.toLowerCase() === "set-cookie") return;
          response.headers.set(k, String(v));
        });
      },
    },
  });
}

/**
 * Supabase-Client für Route Handler: Cookies müssen auf derselben {@link NextResponse} landen,
 * die zurückgegeben wird (v. a. bei Redirects), sonst geht die Session verloren.
 */
export function createRouteHandlerClient(request: Request, response: NextResponse) {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) {
    throw new Error(
      "Supabase env fehlt: NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY (oder PUBLISHABLE_KEY).",
    );
  }

  return createServerClient(url, key, {
    cookieOptions: supabaseCookieOptions(),
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.get("Cookie") ?? "").map((c) => ({
          name: c.name,
          value: c.value ?? "",
        }));
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, withSharedCookieDomain(options));
        });
        Object.entries(headers).forEach(([k, v]) => {
          if (k.toLowerCase() === "set-cookie") return;
          response.headers.set(k, String(v));
        });
      },
    },
  });
}
