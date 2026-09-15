import { isIP } from "node:net";
import { publicFetch, isPublicAddress } from "@/lib/security/public-fetch";
const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
  "169.254.169.254",
]);

const PRIVATE_IPV4_RE =
  /^(10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|127\.\d+\.\d+\.\d+|0\.0\.0\.0)$/;

export const URL_FETCH_TIMEOUT_MS = 8_000;
export const URL_MAX_BODY_BYTES = 2 * 1024 * 1024;
export const URL_MAX_REDIRECTS = 3;

export const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** Häufige Consent-/Alters-Cookies — hilft bei Fetch-Fallback ohne JS. */
export const BRAND_INTAKE_CONSENT_COOKIES =
  "age_verified=1; ageGate=true; age_check=passed; ageConfirmed=yes; CookieConsent={stamp:'0',necessary:true,preferences:true,statistics:true,marketing:true};";

export function normalizeWebsiteUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (parsed.username || parsed.password) return null;
    parsed.hash = "";
    return parsed.toString().slice(0, 1200);
  } catch {
    return null;
  }
}

export function isBlockedHost(hostname: string): boolean {
  const host = hostname.replace(/^\[/, "").replace(/\]$/, "").toLowerCase();
  if (!host) return true;
  if (BLOCKED_HOSTS.has(host)) return true;
  if (host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (PRIVATE_IPV4_RE.test(host)) return true;
  if (isIP(host) && !isPublicAddress(host)) return true;
  return false;
}

export function assertSafePublicUrl(url: URL): void {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Nur http- und https-URLs sind erlaubt.");
  }
  if (url.username || url.password || isBlockedHost(url.hostname)) {
    throw new Error("Diese URL ist nicht erlaubt.");
  }
}

export function isInstagramUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    return host === "instagram.com" || host.endsWith(".instagram.com");
  } catch {
    return false;
  }
}

export type SafeFetchResult = {
  finalUrl: string;
  html: string;
  contentType: string;
};

export async function safeFetchHtml(startUrl: string): Promise<SafeFetchResult> {
  assertSafePublicUrl(new URL(startUrl));
  const response = await publicFetch(startUrl, { maxBytes: URL_MAX_BODY_BYTES, timeoutMs: URL_FETCH_TIMEOUT_MS,
    headers: { "User-Agent": BROWSER_USER_AGENT, Accept: "text/html,application/xhtml+xml", Cookie: BRAND_INTAKE_CONSENT_COOKIES } });
  if (response.status < 200 || response.status >= 300) throw new Error(`Website antwortete mit Status ${response.status}.`);
  return { finalUrl: response.finalUrl, html: response.body.toString("utf8"), contentType: response.headers["content-type"] ?? "text/html" };
}

export function resolveAbsoluteUrl(baseUrl: string, href: string): string | null {
  try {
    const resolved = new URL(href, baseUrl);
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") return null;
    assertSafePublicUrl(resolved);
    return resolved.toString();
  } catch {
    return null;
  }
}
