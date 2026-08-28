import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(__dirname, "..", "_t11-search-preview");
fs.mkdirSync(out, { recursive: true });

const base = process.env.T11_SEARCH_QA_BASE ?? "http://localhost:3001";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

async function shot(name, w, h, url) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(out, name), fullPage: false });
  console.log("ok", name);
}

await shot("01-desktop-search-empty.png", 1440, 900, `${base}/t11-search-qa?view=empty`);
await shot("05-tablet-search.png", 1024, 900, `${base}/dashboard`);
await shot("06-mobile-search.png", 390, 844, `${base}/dashboard`);

console.log("done →", out);
await browser.close();
