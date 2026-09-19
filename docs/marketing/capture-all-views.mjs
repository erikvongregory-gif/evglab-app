import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "views");
const base = process.env.BASE_URL || "http://localhost:3001";
/** Marketing width band: 1600–1920 — capture at 1920. */
const WIDTH = Number(process.env.SHOT_WIDTH || 1920);
const HEIGHT = Number(process.env.SHOT_HEIGHT || 1080);

const SCREENS = [
  { id: "dashboard", file: "01-dashboard", wait: "Tokens verfügbar", chart: true },
  { id: "dashboard-empty", file: "02-dashboard-empty", wait: "Tokens verfügbar" },
  { id: "dashboard-incomplete", file: "03-dashboard-incomplete", wait: "Tokens verfügbar", chart: true },
  { id: "assistant", file: "04-assistant", wait: "Kampagnen-Idee" },
  { id: "create", file: "05-create", wait: "Testbrauerei" },
  { id: "create-locked", file: "06-create-locked", wait: "Testbrauerei" },
  { id: "media", file: "07-media", wait: "Biergarten Abendlicht" },
  { id: "brand", file: "08-brand", wait: "Testbrauerei" },
  { id: "brand-empty", file: "09-brand-empty", wait: "Markenprofil" },
  { id: "team", file: "10-team", wait: "Marie Keller" },
  { id: "pricing", file: "11-pricing", wait: "Brauerei Pro" },
  { id: "settings", file: "12-settings", wait: "Marie Keller" },
  { id: "videos", file: "13-videos", wait: "Video" },
  { id: "dashboard-dark", file: "14-dashboard-dark", wait: "Tokens verfügbar", chart: true },
];

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
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

const results = [];

for (const screen of SCREENS) {
  const url = `${base}/marketing-preview/${screen.id}`;
  process.stdout.write(`→ ${screen.file} … `);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForSelector(`text=${screen.wait}`, { timeout: 45_000 });
    if (screen.chart) {
      await page.waitForSelector(".recharts-area path", { timeout: 20_000 }).catch(() => null);
      await page.waitForTimeout(800);
    } else {
      await page.waitForTimeout(1000);
    }
    await page.evaluate(() => {
      document
        .querySelectorAll("nextjs-portal, [data-nextjs-toast], [data-next-mark]")
        .forEach((el) => el.remove());
    });
    const outPath = path.join(outDir, `${screen.file}.png`);
    await page.screenshot({ path: outPath, fullPage: false, animations: "disabled" });
    results.push({ file: screen.file, ok: true, path: outPath });
    console.log("ok");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    results.push({ file: screen.file, ok: false, error: message });
    console.log(`FAIL: ${message.split("\n")[0]}`);
  }
}

await browser.close();

const ok = results.filter((r) => r.ok).length;
console.log(`\n${ok}/${SCREENS.length} captured → ${outDir} (${WIDTH}×${HEIGHT} @2x)`);
if (ok < SCREENS.length) process.exitCode = 1;
