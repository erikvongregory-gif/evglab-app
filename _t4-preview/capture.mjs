import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = __dirname;
fs.mkdirSync(out, { recursive: true });

const base = "http://localhost:3001";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

async function shot(name, w, h, url) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(out, name), fullPage: false });
  console.log("ok", name);
}

await shot("01-desktop-1440.png", 1440, 900, `${base}/design-handoff?screen=dashboard`);
await shot("02-tablet-1024.png", 1024, 900, `${base}/design-handoff?screen=dashboard`);
await shot("03-tablet-768.png", 768, 900, `${base}/design-handoff?screen=dashboard`);
await shot("04-mobile-390.png", 390, 844, `${base}/design-handoff?screen=dashboard`);
await shot("05-mobile-375.png", 375, 812, `${base}/design-handoff?screen=dashboard`);
await shot("06-brand-incomplete.png", 1440, 900, `${base}/design-handoff?screen=dashboard-incomplete`);
await shot("07-empty-state.png", 1440, 900, `${base}/design-handoff?screen=dashboard-empty`);
await shot("08-ref-desktop-compare.png", 1440, 900, `${base}/design-handoff?screen=dashboard`);
await shot("09-ref-mobile-compare.png", 390, 844, `${base}/design-handoff?screen=dashboard`);

console.log("done");
await browser.close();
