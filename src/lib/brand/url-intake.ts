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
  "Mozilla/5.0 (compatible; EvGlabBrandBot/1.0; +https://evglab.de) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";

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
  if (host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) return true;
  return false;
}

export function assertSafePublicUrl(url: URL): void {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Nur http- und https-URLs sind erlaubt.");
  }
  if (isBlockedHost(url.hostname)) {
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
  let currentUrl = startUrl;
  let redirectCount = 0;

  while (true) {
    const parsed = new URL(currentUrl);
    assertSafePublicUrl(parsed);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), URL_FETCH_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": BROWSER_USER_AGENT,
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
        },
        cache: "no-store",
      });
    } catch (e) {
      clearTimeout(timeout);
      if (e instanceof Error && e.name === "AbortError") {
        throw new Error("Die Website hat zu lange geantwortet.");
      }
      throw new Error("Die Website konnte nicht geladen werden.");
    } finally {
      clearTimeout(timeout);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Ungueltige Weiterleitung der Website.");
      redirectCount += 1;
      if (redirectCount > URL_MAX_REDIRECTS) {
        throw new Error("Zu viele Weiterleitungen.");
      }
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    if (!response.ok) {
      throw new Error(`Website antwortete mit Status ${response.status}.`);
    }

    const contentType = response.headers.get("content-type") ?? "text/html";
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > URL_MAX_BODY_BYTES) {
      throw new Error("Die Website ist zu gross zum Analysieren.");
    }

    return {
      finalUrl: currentUrl,
      html: buffer.toString("utf-8"),
      contentType,
    };
  }
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
