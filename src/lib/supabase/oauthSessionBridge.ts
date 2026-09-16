import { createHash } from "node:crypto";
import type { NextResponse } from "next/server";
import { parseCookieHeader } from "@supabase/ssr";

export type BridgedOAuthSession = {
  cookies: Array<{ name: string; value: string; [key: string]: unknown }>;
  userId: string;
  at: number;
  /** SHA-256 über die PKCE-Verifier-Cookies — Bridge nur für denselben Browser. */
  pkceVerifierHash: string;
};

const bridged = new Map<string, BridgedOAuthSession>();
const TTL_MS = 5 * 60 * 1000;
const CODE_VERIFIER_COOKIE = /^sb-[A-Za-z0-9_-]+-auth-token-code-verifier(?:\.\d+)?$/;

function prune() {
  const now = Date.now();
  for (const [key, entry] of bridged) {
    if (now - entry.at > TTL_MS) bridged.delete(key);
  }
}

/** Hash der PKCE-Verifier aus dem Request — ohne Verifier keine Bridge. */
export function pkceVerifierHashFromRequest(request: Request): string | null {
  const cookies = parseCookieHeader(request.headers.get("Cookie") ?? "");
  const values = cookies
    .filter((cookie) => CODE_VERIFIER_COOKIE.test(cookie.name) && Boolean(cookie.value))
    .map((cookie) => cookie.value as string)
    .sort();
  if (values.length === 0) return null;
  return createHash("sha256").update(values.join("\0")).digest("hex");
}

export function bridgeOAuthSession(
  code: string,
  response: NextResponse,
  userId: string,
  pkceVerifierHash: string,
) {
  prune();
  bridged.set(code, {
    cookies: response.cookies.getAll().map((c) => {
      const { name, value, ...options } = c;
      return { name, value, ...options };
    }),
    userId,
    at: Date.now(),
    pkceVerifierHash,
  });
}

export function peekBridgedOAuthSession(
  code: string,
  pkceVerifierHash: string | null,
): BridgedOAuthSession | null {
  prune();
  if (!pkceVerifierHash) return null;
  const entry = bridged.get(code);
  if (!entry) return null;
  if (entry.pkceVerifierHash !== pkceVerifierHash) return null;
  return entry;
}

export function applyBridgedCookies(target: NextResponse, session: BridgedOAuthSession) {
  for (const cookie of session.cookies) {
    const { name, value, ...options } = cookie;
    target.cookies.set(name, value, options as Parameters<NextResponse["cookies"]["set"]>[2]);
  }
}
