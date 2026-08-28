import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(__dirname, "..", "_t10-preview");
fs.mkdirSync(out, { recursive: true });

const base = process.env.T10_QA_BASE ?? "http://localhost:3000";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

async function shot(name, w, h, url) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(out, name), fullPage: false });
  console.log("ok", name);
}

await shot("01-desktop-team.png", 1440, 900, `${base}/t10-qa?view=normal`);
await shot("02-desktop-empty.png", 1440, 900, `${base}/t10-qa?view=empty`);
await shot("03-desktop-error.png", 1440, 900, `${base}/t10-qa?view=error`);
await shot("04-tablet-team.png", 1024, 900, `${base}/t10-qa?view=normal`);
await shot("05-mobile-team.png", 390, 844, `${base}/t10-qa?view=normal`);

console.log("done →", out);
await browser.close();
