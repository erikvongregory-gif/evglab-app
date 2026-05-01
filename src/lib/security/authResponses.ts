import { NextResponse } from "next/server";
import { withRequestHeaders } from "@/lib/security/authObservability";

const DEFAULT_REDIRECT_PATH = "/dashboard";

export function normalizeNextPath(value: string | null | undefined): string {
  if (!value) return DEFAULT_REDIRECT_PATH;
  if (!value.startsWith("/")) return DEFAULT_REDIRECT_PATH;
  if (value.startsWith("//")) return DEFAULT_REDIRECT_PATH;
  return value;
}

export function createNoStoreRedirect(url: string, requestId: string, status = 303): NextResponse {
  const response = NextResponse.redirect(url, status);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("x-request-id", requestId);
  return response;
}

export function withRequestIdJson(
  body: unknown,
  requestId: string,
  init: ResponseInit = {},
): NextResponse {
  return NextResponse.json(body, {
    ...init,
    headers: withRequestHeaders(init.headers, requestId),
  });
}

export function secureCookieOptions(request: Request): {
  secure: boolean;
  domain?: string;
  sameSite: "lax";
  path: "/";
} {
  const url = new URL(request.url);
  const secure = process.env.NODE_ENV === "production";
  const domain =
    secure && (url.hostname === "evglab.com" || url.hostname.endsWith(".evglab.com"))
      ? "evglab.com"
      : undefined;
  return {
    secure,
    ...(domain ? { domain } : {}),
    sameSite: "lax",
    path: "/",
  };
}
