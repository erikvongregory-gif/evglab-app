import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(__dirname, "..", "_t8-preview");
fs.mkdirSync(out, { recursive: true });

const base = process.env.T8_QA_BASE ?? "http://localhost:3000";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

async function shot(name, w, h, url, { waitMs = 700, scrollTo } = {}) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(waitMs);
  if (scrollTo) {
    await page.locator(scrollTo).scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
  }
  await page.screenshot({ path: path.join(out, name), fullPage: false });
  console.log("ok", name);
}

await shot("01-desktop-pricing.png", 1440, 900, `${base}/t8-qa?view=pricing`);
await shot("02-desktop-current-plan.png", 1440, 900, `${base}/t8-qa?view=current-plan`, {
  scrollTo: ".studio-pricing-summary",
});
await shot("03-desktop-checkout-loading.png", 1440, 900, `${base}/t8-qa?view=checkout-loading`, { waitMs: 1400 });
await shot("04-desktop-token-packs.png", 1440, 900, `${base}/t8-qa?view=token-packs`, {
  scrollTo: ".studio-pricing-token-section",
});
await shot("05-desktop-error.png", 1440, 900, `${base}/t8-qa?view=error`);
await shot("06-tablet-pricing.png", 1024, 900, `${base}/t8-qa?view=pricing`);
await shot("07-mobile-pricing.png", 390, 844, `${base}/t8-qa?view=pricing`);
await shot("08-mobile-current-plan.png", 390, 844, `${base}/t8-qa?view=current-plan`, {
  scrollTo: ".studio-pricing-summary",
});
await shot("09-mobile-token-packs.png", 390, 844, `${base}/t8-qa?view=token-packs`, {
  scrollTo: ".studio-pricing-token-section",
});

console.log("done →", out);
await browser.close();
