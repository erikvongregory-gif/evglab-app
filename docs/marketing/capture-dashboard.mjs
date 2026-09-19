import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname);
const base = process.env.BASE_URL || "http://localhost:3001";
const url = `${base}/marketing-preview/dashboard`;

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();

await page.emulateMedia({ reducedMotion: "reduce" });
await page.addInitScript(() => {
  const style = document.createElement("style");
  style.textContent = `
    nextjs-portal, [data-nextjs-toast], [data-next-mark],
    #__next-build-watcher { display: none !important; }
  `;
  document.documentElement.appendChild(style);
});

await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForSelector("text=Tokens verfügbar", { timeout: 45_000 });
await page.waitForSelector("text=Biergarten Abendlicht", { timeout: 30_000 });
await page.waitForSelector(".recharts-area path", { timeout: 30_000 });

// Chart must exist and use a visible orange stroke
await page.waitForFunction(() => {
  const strokeEl =
    document.querySelector(".recharts-area-curve") ||
    document.querySelector(".recharts-curve");
  if (!strokeEl) return false;
  const stroke = getComputedStyle(strokeEl).stroke.toLowerCase();
  return stroke.includes("199") || stroke.includes("c769") || stroke.includes("rgb(199");
}, { timeout: 20_000 });

await page.waitForTimeout(600);
await page.evaluate(() => {
  document.querySelectorAll("nextjs-portal, [data-nextjs-toast], [data-next-mark]").forEach((el) => el.remove());
});

const rawPath = path.join(outDir, "dashboard-testbrauerei-raw.png");
await page.screenshot({ path: rawPath, fullPage: false, animations: "disabled" });

await page.setViewportSize({ width: 1680, height: 1120 });
await page.evaluate(() => {
  document.documentElement.style.background = "#E8E2D8";
  document.body.style.cssText =
    "margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#E8E2D8;padding:56px;";
  const root = document.querySelector(".brewai-admin");
  if (root instanceof HTMLElement) {
    root.style.cssText = [
      "width:1440px",
      "height:960px",
      "border-radius:18px",
      "overflow:hidden",
      "background:var(--background,#fff)",
      "box-shadow:0 1px 2px rgba(24,20,15,.05),0 28px 80px rgba(24,20,15,.16),0 0 0 1px rgba(24,20,15,.06)",
    ].join(";");
  }
});
await page.waitForTimeout(400);

const framedPath = path.join(outDir, "dashboard-testbrauerei.png");
await page.screenshot({ path: framedPath, fullPage: false, animations: "disabled" });

await browser.close();
console.log(`Wrote:\n  ${rawPath}\n  ${framedPath}`);
