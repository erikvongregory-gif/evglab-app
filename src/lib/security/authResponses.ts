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

/** Cookies von einer Response auf eine andere kopieren — ohne name/value in den Options, sonst verwirft Next sie. */
export function appendResponseCookies(target: NextResponse, source: NextResponse) {
  for (const cookie of source.cookies.getAll()) {
    const { name, value, ...options } = cookie;
    target.cookies.set(name, value, options);
  }
  return target;
}

/** 303-Redirect inkl. Session-Cookies von einer OAuth-Exchange-Response. */
export function createRedirectWithCookies(
  url: string,
  requestId: string,
  cookieSource: NextResponse,
  status = 303,
): NextResponse {
  return appendResponseCookies(createNoStoreRedirect(url, requestId, status), cookieSource);
}

/** Recovery-Links: Hash-Fragment (#access_token) erreicht den Server nicht — im Browser weiterleiten. */
export function createRecoveryHashForwardHtml(opts: {
  targetUrl: string;
  fallbackUrl: string;
  requestId: string;
}): NextResponse {
  const target = JSON.stringify(opts.targetUrl);
  const fallback = JSON.stringify(opts.fallbackUrl);
  const html = `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"/><title>Passwort zurücksetzen</title></head><body><p style="font-family:system-ui,sans-serif;color:#c4bdb3;background:#131211;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center">Passwort-Reset wird vorbereitet …</p><script>
(function(){var target=${target},fallback=${fallback},hash=location.hash||"",search=location.search||"";
if(hash.indexOf("access_token")>=0){location.replace(target+hash);return}
if(search.indexOf("code=")>=0||search.indexOf("token_hash=")>=0){location.replace("/auth/callback"+search+hash);return}
var n=0;function step(){n++;fetch("/api/auth/status",{credentials:"same-origin",cache:"no-store"}).then(function(r){return r.ok?r.json():null}).then(function(j){if(j&&j.authenticated)return location.replace(target);if(n>=15)return location.replace(fallback);setTimeout(step,200)}).catch(function(){if(n>=15)return location.replace(fallback);setTimeout(step,250)})}
step()})();</script></body></html>`;
  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      "x-request-id": opts.requestId,
    },
  });
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
  if (cookieSource) appendResponseCookies(response, cookieSource);
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
  if (cookieSource) appendResponseCookies(response, cookieSource);
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
  const configuredDomain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN?.trim()?.replace(/^\./, "");
  const host = url.hostname;
  const onBrewAi = host === "brewai.de" || host.endsWith(".brewai.de");
  const domain = secure && onBrewAi ? configuredDomain || "brewai.de" : undefined;
  return {
    secure,
    ...(domain ? { domain } : {}),
    sameSite: "lax",
    path: "/",
  };
}
