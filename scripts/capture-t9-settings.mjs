import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(__dirname, "..", "_t9-preview");
fs.mkdirSync(out, { recursive: true });

const base = process.env.T9_QA_BASE ?? "http://localhost:3000";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

async function shot(name, w, h, url) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(out, name), fullPage: false });
  console.log("ok", name);
}

await shot("01-desktop-settings.png", 1440, 900, `${base}/t9-qa?view=normal`);
await shot("02-desktop-saved.png", 1440, 900, `${base}/t9-qa?view=saved`);
await shot("03-desktop-loading.png", 1440, 900, `${base}/t9-qa?view=loading`);
await shot("04-tablet-settings.png", 1024, 900, `${base}/t9-qa?view=normal`);
await shot("05-mobile-settings.png", 390, 844, `${base}/t9-qa?view=normal`);

console.log("done →", out);
await browser.close();
