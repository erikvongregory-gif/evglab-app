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

/** 303-Redirect inkl. Session-Cookies von einer OAuth-Exchange-Response. */
export function createRedirectWithCookies(
  url: string,
  requestId: string,
  cookieSource: NextResponse,
  status = 303,
): NextResponse {
  const response = createNoStoreRedirect(url, requestId, status);
  for (const cookie of cookieSource.cookies.getAll()) {
    const { name, value, ...options } = cookie;
    response.cookies.set(name, value, options);
  }
  return response;
}

/** 200 + JS-Redirect: verhindert doppelte 303-Requests mit demselben OAuth-Code. */
export function createHtmlRedirect(
  url: string,
  requestId: string,
  cookieSource?: NextResponse,
): NextResponse {
  const html = `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"/><title>Weiterleitung</title></head><body><p style="font-family:system-ui;color:#6b6560">Weiterleitung …</p><script>location.replace(${JSON.stringify(url)})</script></body></html>`;
  const response = new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      "x-request-id": requestId,
    },
  });
  if (cookieSource) {
    for (const cookie of cookieSource.cookies.getAll()) {
      const { name, value, ...options } = cookie;
      response.cookies.set(name, value, options);
    }
  }
  return response;
}

/**
 * Leichte 200-HTML-Seite: wartet im Browser auf Session (kein langer Server-Hold).
 * Wichtig bei doppeltem OAuth-Callback — verhindert Browser-Timeouts.
 */
export function createOAuthSessionPollerHtml(
  opts: { successUrl: string; fallbackUrl: string; requestId: string },
  cookieSource?: NextResponse,
): NextResponse {
  const success = JSON.stringify(opts.successUrl);
  const fallback = JSON.stringify(opts.fallbackUrl);
  const html = `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"/><title>Anmeldung</title></head><body><p style="font-family:system-ui,sans-serif;color:#c4bdb3;background:#131211;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center">Anmeldung wird abgeschlossen …</p><script>
(function(){var ok=${success},fb=${fallback},n=0,max=120;
function go(u){location.replace(u)}
function repair(){return fetch("/api/auth/repair-session",{method:"POST",credentials:"same-origin",cache:"no-store"}).catch(function(){})}
function step(){n++;var p=(n===3||n===8)?repair():Promise.resolve();p.then(function(){return fetch("/api/auth/status",{credentials:"same-origin",cache:"no-store"})}).then(function(r){return r.ok?r.json():null}).then(function(j){if(j&&j.authenticated)return go(j.admin2faRequired?"/dashboard/2fa-email":ok);if(n>=max)return go(fb);setTimeout(step,n<12?120:n<30?220:350)}).catch(function(){if(n>=max)return go(fb);setTimeout(step,250)})}
step()})();</script></body></html>`;
  const response = new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      "x-request-id": opts.requestId,
    },
  });
  if (cookieSource) {
    for (const cookie of cookieSource.cookies.getAll()) {
      const { name, value, ...options } = cookie;
      response.cookies.set(name, value, options);
    }
  }
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
