import type { SupabaseClient } from "@supabase/supabase-js";
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

function cookieDomainsToClear(): Array<string | undefined> {
  const sharedDomain = getSharedCookieDomain();
  if (!sharedDomain) return [undefined];
  return [undefined, sharedDomain];
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

  for (const name of names) {
    for (const domain of cookieDomainsToClear()) {
      const cookieOptions = {
        path: "/" as const,
        sameSite: "lax" as const,
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 0,
        ...(domain ? { domain } : {}),
      };
      response.cookies.set(name, "", cookieOptions);
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
