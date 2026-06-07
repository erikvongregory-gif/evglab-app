import type { NextResponse } from "next/server";

export type BridgedOAuthSession = {
  cookies: Array<{ name: string; value: string; [key: string]: unknown }>;
  userId: string;
  at: number;
};

const bridged = new Map<string, BridgedOAuthSession>();
const TTL_MS = 5 * 60 * 1000;

function prune() {
  const now = Date.now();
  for (const [key, entry] of bridged) {
    if (now - entry.at > TTL_MS) bridged.delete(key);
  }
}

export function bridgeOAuthSession(code: string, response: NextResponse, userId: string) {
  prune();
  bridged.set(code, {
    cookies: response.cookies.getAll().map((c) => {
      const { name, value, ...options } = c;
      return { name, value, ...options };
    }),
    userId,
    at: Date.now(),
  });
}

export function peekBridgedOAuthSession(code: string): BridgedOAuthSession | null {
  prune();
  return bridged.get(code) ?? null;
}

export function applyBridgedCookies(target: NextResponse, session: BridgedOAuthSession) {
  for (const cookie of session.cookies) {
    const { name, value, ...options } = cookie;
    target.cookies.set(name, value, options as Parameters<NextResponse["cookies"]["set"]>[2]);
  }
}
