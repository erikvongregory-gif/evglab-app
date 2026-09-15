import type { Frame, Page } from "playwright";
import {
  assertSafePublicUrl,
  type SafeFetchResult,
  safeFetchHtml,
  URL_FETCH_TIMEOUT_MS,
} from "@/lib/brand/url-intake";
import { CONSENT_AND_AGE_GATE_SELECTORS } from "@/lib/brand/consent-gate-dismiss";

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

export async function fetchWebsiteHtmlWithBrowser(startUrl: string): Promise<SafeFetchResult> {
  assertSafePublicUrl(new URL(startUrl));

  const { chromium } = await import("playwright");
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled"],
  });

  try {
    const context = await browser.newContext({
      userAgent: REAL_BROWSER_USER_AGENT,
      locale: "de-DE",
      timezoneId: "Europe/Berlin",
      viewport: { width: 1440, height: 900 },
      extraHTTPHeaders: {
        "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
      },
    });

    const page = await context.newPage();
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

    const html = await page.content();
    const finalUrl = page.url();
    await context.close();

    return {
      finalUrl,
      html,
      contentType: "text/html",
    };
  } finally {
    await browser.close();
  }
}

/**
 * Marken-Website laden: zuerst Headless-Browser (Cookie + Altersgate),
 * Fallback auf plain fetch.
 */
export async function fetchWebsiteHtmlForBrandIntake(startUrl: string): Promise<SafeFetchResult> {
  if (!browserIntakeEnabled()) {
    return safeFetchHtml(startUrl);
  }

  try {
    return await fetchWebsiteHtmlWithBrowser(startUrl);
  } catch (browserError) {
    const reason = browserError instanceof Error ? browserError.message : String(browserError);
    const missingBrowser =
      /executable doesn't exist|browserType.launch|Failed to launch/i.test(reason) ||
      reason.includes("npx playwright install");
    if (missingBrowser) {
      throw new Error(
        "Chromium für die Marken-Analyse fehlt. Auf dem Server ausführen: npx playwright install chromium",
      );
    }
    console.warn("[brand-intake] browser fetch failed, fallback to fetch:", reason);
    return safeFetchHtml(startUrl);
  }
}
