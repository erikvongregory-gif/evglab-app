import { publicFetch } from "@/lib/security/public-fetch";
import type { Browser, BrowserContext, Frame, Page } from "playwright";
import {
  assertSafePublicUrl,
  type SafeFetchResult,
  safeFetchHtml,
  URL_FETCH_TIMEOUT_MS,
} from "@/lib/brand/url-intake";
import { CONSENT_AND_AGE_GATE_SELECTORS, looksLikeBlockedGatePage } from "@/lib/brand/consent-gate-dismiss";

const REAL_BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const BROWSER_NAV_TIMEOUT_MS = Math.max(URL_FETCH_TIMEOUT_MS * 3, 24_000);
const GATE_DISMISS_ROUNDS = 3;

function browserIntakeEnabled(): boolean {
  const flag = process.env.BRAND_INTAKE_BROWSER?.trim().toLowerCase();
  if (flag === "0" || flag === "false" || flag === "off") return false;
  return true;
}

async function clickFirstVisible(frame: Frame, selector: string): Promise<boolean> {
  try {
    const locator = frame.locator(selector).first();
    if (!(await locator.isVisible({ timeout: 400 }))) return false;
    await locator.click({ timeout: 2500, force: true });
    return true;
  } catch {
    return false;
  }
}

/** Cookie-Banner und Altersgates in Page + iframes (Cookiebot, Usercentrics …). */
export async function dismissConsentAndAgeGate(page: Page): Promise<number> {
  let clicks = 0;
  const frames = [page.mainFrame(), ...page.frames().filter((f) => f !== page.mainFrame())];

  for (const selector of CONSENT_AND_AGE_GATE_SELECTORS) {
    for (const frame of frames) {
      if (await clickFirstVisible(frame, selector)) {
        clicks += 1;
        await page.waitForTimeout(600);
        break;
      }
    }
  }

  return clicks;
}

function roughTextExcerpt(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2_000);
}

/** Plain-HTML reicht, wenn genug Markeninhalt ohne Gate sichtbar ist. */
export function htmlNeedsBrowserRender(html: string): boolean {
  const excerpt = roughTextExcerpt(html);
  if (looksLikeBlockedGatePage(html, excerpt)) return true;
  return excerpt.length < 80;
}

async function navigateAndCapture(context: BrowserContext, startUrl: string): Promise<SafeFetchResult> {
  const page = await context.newPage();
  try {
    await page.goto(startUrl, {
      waitUntil: "domcontentloaded",
      timeout: BROWSER_NAV_TIMEOUT_MS,
    });

    for (let round = 0; round < GATE_DISMISS_ROUNDS; round += 1) {
      const clicked = await dismissConsentAndAgeGate(page);
      if (clicked === 0 && round > 0) break;
      await page.waitForTimeout(round === 0 ? 900 : 500);
    }

    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);

    return {
      finalUrl: page.url(),
      html: await page.content(),
      contentType: "text/html",
    };
  } finally {
    await page.close().catch(() => undefined);
  }
}

async function createBrowserContext(): Promise<{ browser: Browser; context: BrowserContext }> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled", "--force-webrtc-ip-handling-policy=disable_non_proxied_udp"],
  });
  const context = await browser.newContext({
    serviceWorkers: "block",
    userAgent: REAL_BROWSER_USER_AGENT,
    locale: "de-DE",
    timezoneId: "Europe/Berlin",
    viewport: { width: 1440, height: 900 },
    extraHTTPHeaders: {
      "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
    },
  });

  let requestCount = 0;
  let totalBytes = 0;
  await context.routeWebSocket("**/*", (socket) => socket.close());
  await context.route("**/*", async (route) => {
    if (++requestCount > 80 || totalBytes > 30 * 1024 * 1024 || !["GET", "HEAD"].includes(route.request().method())) {
      return route.abort();
    }
    try {
      const response = await publicFetch(route.request().url(), {
        followRedirects: false,
        maxBytes: 2 * 1024 * 1024,
        headers: { "User-Agent": REAL_BROWSER_USER_AGENT },
      });
      totalBytes += response.body.length;
      await route.fulfill({
        status: response.status,
        body: response.body,
        contentType: response.headers["content-type"] ?? "application/octet-stream",
        headers: response.headers.location ? { location: response.headers.location } : undefined,
      });
    } catch {
      await route.abort();
    }
  });

  return { browser, context };
}

export type BrandIntakeSession = {
  /** HTML zuerst; Browser nur bei Gate/duennem Inhalt. Kontext wird wiederverwendet. */
  fetchHtml: (url: string) => Promise<SafeFetchResult>;
  /** Erzwingt Headless-Render (z.B. nach erkanntem Gate). */
  fetchWithBrowser: (url: string) => Promise<SafeFetchResult>;
  close: () => Promise<void>;
};

export function createBrandIntakeSession(): BrandIntakeSession {
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let launching: Promise<BrowserContext> | null = null;

  async function ensureContext(): Promise<BrowserContext> {
    if (context) return context;
    if (!launching) {
      launching = createBrowserContext().then((created) => {
        browser = created.browser;
        context = created.context;
        return created.context;
      });
    }
    return launching;
  }

  async function fetchWithBrowser(url: string): Promise<SafeFetchResult> {
    assertSafePublicUrl(new URL(url));
    if (!browserIntakeEnabled()) {
      throw new Error("Browser-Intake ist deaktiviert.");
    }
    try {
      const ctx = await ensureContext();
      return await navigateAndCapture(ctx, url);
    } catch (browserError) {
      const reason = browserError instanceof Error ? browserError.message : String(browserError);
      const missingBrowser =
        /executable doesn't exist|browserType.launch|Failed to launch/i.test(reason) ||
        reason.includes("npx playwright install");
      if (missingBrowser) return safeFetchHtml(url);
      throw browserError;
    }
  }

  async function fetchHtml(url: string): Promise<SafeFetchResult> {
    try {
      const plain = await safeFetchHtml(url);
      if (!htmlNeedsBrowserRender(plain.html)) return plain;
    } catch (plainError) {
      if (!browserIntakeEnabled()) throw plainError;
      try {
        return await fetchWithBrowser(url);
      } catch {
        throw plainError;
      }
    }

    if (!browserIntakeEnabled()) {
      return safeFetchHtml(url);
    }

    try {
      return await fetchWithBrowser(url);
    } catch (browserError) {
      const reason = browserError instanceof Error ? browserError.message : String(browserError);
      console.warn("[brand-intake] browser fetch failed, fallback to fetch:", reason);
      return safeFetchHtml(url);
    }
  }

  return {
    fetchHtml,
    fetchWithBrowser,
    async close() {
      launching = null;
      try {
        await context?.close();
      } catch {
        /* ignore */
      }
      try {
        await browser?.close();
      } catch {
        /* ignore */
      }
      context = null;
      browser = null;
    },
  };
}

export async function fetchWebsiteHtmlWithBrowser(startUrl: string): Promise<SafeFetchResult> {
  const session = createBrandIntakeSession();
  try {
    return await session.fetchWithBrowser(startUrl);
  } finally {
    await session.close();
  }
}

/**
 * Marken-Website laden: zuerst plain HTML, Browser nur bei Gate/duennem Inhalt.
 */
export async function fetchWebsiteHtmlForBrandIntake(startUrl: string): Promise<SafeFetchResult> {
  const session = createBrandIntakeSession();
  try {
    return await session.fetchHtml(startUrl);
  } finally {
    await session.close();
  }
}
