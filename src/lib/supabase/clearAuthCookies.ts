import type { SupabaseClient } from "@supabase/supabase-js";
import { serializeCookieHeader } from "@supabase/ssr";
import type { NextResponse } from "next/server";
import { getSharedCookieDomain } from "@/lib/siteConfig";

const AUTH_TOKEN_COOKIE =
  /^sb-[A-Za-z0-9_-]+-auth-token(?:-code-verifier)?(?:\.\d+)?$/;
const AUTH_TOKEN_COOKIE_PRESERVE_VERIFIER = /^sb-[A-Za-z0-9_-]+-auth-token(?:\.\d+)?$/;
const ALL_SUPABASE_COOKIES = /^sb-[A-Za-z0-9_-]+-/;

export const STALE_AUTH_SESSION_COOKIE = /^sb-[A-Za-z0-9_-]+-auth-token(?:\.\d+)?$/;

function cookieNamesFromRequest(request: Request, pattern: RegExp): string[] {
  return [
    ...new Set(
      (request.headers.get("cookie") ?? "")
        .split(";")
        .map((part) => {
          const separator = part.indexOf("=");
          return (separator === -1 ? part : part.slice(0, separator)).trim();
        })
        .filter((name) => name.length > 0 && pattern.test(name)),
    ),
  ];
}

function isBrewAiHost(hostname: string): boolean {
  return hostname === "brewai.de" || hostname.endsWith(".brewai.de");
}

/** Host-only + Domain=brewai.de — cookies.set() überschreibt denselben Namen, daher append. */
function cookieDomainsToClear(request: Request): Array<string | undefined> {
  const domains = new Set<string | undefined>([undefined]);
  const shared = getSharedCookieDomain();
  if (shared) domains.add(shared);
  try {
    if (isBrewAiHost(new URL(request.url).hostname)) {
      domains.add("brewai.de");
    }
  } catch {
    /* ignore */
  }
  return [...domains];
}

function expireCookieHeader(name: string, domain: string | undefined, secure: boolean): string {
  return serializeCookieHeader(name, "", {
    path: "/",
    sameSite: "lax",
    secure,
    maxAge: 0,
    ...(domain ? { domain } : {}),
  });
}

export function clearIncomingSupabaseAuthCookies(
  request: Request,
  response: NextResponse,
  options?: { preserveCodeVerifier?: boolean; allSupabase?: boolean },
) {
  const pattern = options?.allSupabase
    ? ALL_SUPABASE_COOKIES
    : options?.preserveCodeVerifier
      ? AUTH_TOKEN_COOKIE_PRESERVE_VERIFIER
      : AUTH_TOKEN_COOKIE;
  const names = cookieNamesFromRequest(request, pattern);
  const secure = process.env.NODE_ENV === "production";

  for (const name of names) {
    for (const domain of cookieDomainsToClear(request)) {
      if (domain) {
        // Domain-Variante nur per append — cookies.set überschreibt denselben Namen.
        response.headers.append("Set-Cookie", expireCookieHeader(name, domain, secure));
      } else {
        // Host-only über cookies API, damit createHtmlRedirect/Cookie-Merges sie behalten.
        response.cookies.set(name, "", {
          path: "/",
          sameSite: "lax",
          secure,
          maxAge: 0,
        });
      }
    }
  }
}

export async function purgeStaleAuthSession(
  request: Request,
  response: NextResponse,
  supabase: Pick<SupabaseClient, "auth">,
  options?: { preserveCodeVerifier?: boolean; allSupabase?: boolean },
) {
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  clearIncomingSupabaseAuthCookies(request, response, options);
}
