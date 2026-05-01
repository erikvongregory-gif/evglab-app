import { NextResponse } from "next/server";

type RateLimitRule = {
  keyPrefix: string;
  limit: number;
  windowMs: number;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const rateBuckets = new Map<string, RateLimitBucket>();
const upstashUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

function getClientIdentifier(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }
  return req.headers.get("x-real-ip") || "unknown-client";
}

function buildRateLimitKey(rule: RateLimitRule, identifier: string): string {
  return `${rule.keyPrefix}:${identifier}`;
}

export function enforceRateLimit(req: Request, rule: RateLimitRule): NextResponse | null {
  const now = Date.now();
  const key = buildRateLimitKey(rule, getClientIdentifier(req));
  const entry = rateBuckets.get(key);
  if (!entry || entry.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + rule.windowMs });
    return null;
  }
  if (entry.count >= rule.limit) {
    const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte kurz warten." },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      },
    );
  }
  entry.count += 1;
  rateBuckets.set(key, entry);
  return null;
}

type PersistentRateLimitOptions = {
  identifier?: string;
  identifierParts?: Array<string | null | undefined>;
};

const RATE_LIMIT_TIMEOUT_MS = 1_500;

function compactIdentifierPart(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9._:@-]/g, "").slice(0, 120);
}

export function buildCompositeIdentifier(
  req: Request,
  identifierParts: Array<string | null | undefined> = [],
): string {
  const parts = [getClientIdentifier(req), ...identifierParts]
    .map((part) => (part ? compactIdentifierPart(part) : ""))
    .filter(Boolean);
  return parts.join("|").slice(0, 300) || getClientIdentifier(req);
}

export async function enforceRateLimitPersistent(
  req: Request,
  rule: RateLimitRule,
  options: PersistentRateLimitOptions = {},
): Promise<NextResponse | null> {
  const identifier =
    options.identifier || buildCompositeIdentifier(req, options.identifierParts ?? []);
  if (!upstashUrl || !upstashToken) {
    return enforceRateLimit(req, { ...rule, keyPrefix: `${rule.keyPrefix}:fallback` });
  }

  const key = buildRateLimitKey(rule, identifier);
  try {
    // Avoid blocking auth/API flows if Upstash is slow/unreachable.
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), RATE_LIMIT_TIMEOUT_MS);
    const response = await fetch(`${upstashUrl}/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${upstashToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          ["INCR", key],
          ["PEXPIRE", key, String(rule.windowMs), "NX"],
          ["PTTL", key],
        ]),
        cache: "no-store",
        signal: controller.signal,
      }).finally(() => {
        globalThis.clearTimeout(timeout);
      });
    if (!response.ok) {
      return enforceRateLimit(req, { ...rule, keyPrefix: `${rule.keyPrefix}:fallback` });
    }

    const payload = (await response.json()) as Array<{ result?: unknown }>;
    const count = Number(payload?.[0]?.result ?? 0);
    const ttlMs = Math.max(Number(payload?.[2]?.result ?? rule.windowMs), 1);
    if (count > rule.limit) {
      const retryAfter = Math.max(1, Math.ceil(ttlMs / 1000));
      return NextResponse.json(
        { error: "Zu viele Anfragen. Bitte kurz warten." },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfter) },
        },
      );
    }
    return null;
  } catch {
    return enforceRateLimit(req, { ...rule, keyPrefix: `${rule.keyPrefix}:fallback` });
  }
}

export function sanitizeTaskId(taskId: string): string {
  const cleaned = taskId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
  return cleaned || `${Date.now()}`;
}

export function enforceSameOrigin(req: Request): NextResponse | null {
  const targetOrigin = new URL(req.url).origin;
  const requestOrigin = req.headers.get("origin");
  if (requestOrigin) {
    if (requestOrigin !== targetOrigin) {
      return NextResponse.json({ error: "Ungültige Herkunft." }, { status: 403 });
    }
    return null;
  }

  const referer = req.headers.get("referer");
  if (referer) {
    try {
      if (new URL(referer).origin === targetOrigin) return null;
    } catch {
      return NextResponse.json({ error: "Ungültige Herkunft." }, { status: 403 });
    }
  }

  const forwardedHost = req.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const forwardedProto = req.headers.get("x-forwarded-proto") ?? "https";
    if (`${forwardedProto}://${forwardedHost}` === targetOrigin) return null;
  }

  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite === "same-origin" || fetchSite === "same-site" || fetchSite === "none") {
    return null;
  }

  return NextResponse.json({ error: "Origin-Header fehlt." }, { status: 403 });
}
