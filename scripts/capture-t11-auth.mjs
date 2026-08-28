import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(__dirname, "..", "_t11-preview");
fs.mkdirSync(out, { recursive: true });

const base = process.env.T11_QA_BASE ?? "http://localhost:3000";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

async function shot(name, w, h, url) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(out, name), fullPage: false });
  console.log("ok", name);
}

await shot("01-desktop-signin.png", 1440, 900, `${base}/t11-qa?view=signin`);
await shot("02-desktop-register.png", 1440, 900, `${base}/t11-qa?view=register`);
await shot("03-desktop-error.png", 1440, 900, `${base}/t11-qa?view=error`);
await shot("04-desktop-admin.png", 1440, 900, `${base}/t11-qa?view=admin`);
await shot("05-tablet-signin.png", 1024, 900, `${base}/t11-qa?view=signin`);
await shot("06-mobile-signin.png", 390, 844, `${base}/t11-qa?view=signin`);

console.log("done →", out);
await browser.close();
