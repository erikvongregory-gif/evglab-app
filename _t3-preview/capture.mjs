import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = __dirname;
fs.mkdirSync(out, { recursive: true });

const bases = ["http://localhost:3001", "http://localhost:3000"];
let base = bases[0];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ deviceScaleFactor: 1 });
const page = await context.newPage();

for (const candidate of bases) {
  try {
    const res = await page.goto(`${candidate}/design-handoff?screen=dashboard`, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    const body = await page.textContent("body");
    if (res && res.ok() && body && !body.includes("Nicht verfügbar")) {
      base = candidate;
      break;
    }
  } catch {
    /* try next */
  }
}

const shellUrl = `${base}/design-handoff?screen=dashboard`;
console.log("using", shellUrl);

async function shot(name, w, h, after) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto(shellUrl, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(500);
  if (after) await after(page);
  await page.screenshot({ path: path.join(out, name), fullPage: false });
  console.log("ok", name);
}

await shot("01-desktop-1440-open.png", 1440, 900, async (p) => {
  await p.evaluate(() => localStorage.setItem("evg-studio-rail-collapsed", "0"));
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(400);
});

await shot("02-desktop-collapsed.png", 1440, 900, async (p) => {
  await p.evaluate(() => localStorage.setItem("evg-studio-rail-collapsed", "1"));
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(400);
});

await shot("03-tablet-1024.png", 1024, 800);
await shot("04-tablet-768.png", 768, 900);
await shot("05-mobile-390.png", 390, 844);
await shot("06-mobile-375.png", 375, 812);

await shot("07-mobile-mehr-sheet.png", 390, 844, async (p) => {
  await p.locator(".evg-bottom-nav button").filter({ hasText: "Mehr" }).click();
  await p.waitForTimeout(450);
});

await shot("08-long-names.png", 1440, 900, async (p) => {
  await p.evaluate(() => localStorage.setItem("evg-studio-rail-collapsed", "0"));
  await p.reload({ waitUntil: "networkidle" });
  await p.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent("evglab-profile-updated", {
        detail: {
          breweryName: "Brauerei Zum Langen Hopfenkeller & Traditionssudwerk GmbH",
          profileName: "Maximilian-Alexander von der Brauerei-Verwaltung",
        },
      }),
    );
  });
  await p.waitForTimeout(400);
});

await shot("09a-shell-vs-ref-desktop.png", 1440, 900, async (p) => {
  await p.evaluate(() => localStorage.setItem("evg-studio-rail-collapsed", "0"));
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(400);
});

await shot("09b-shell-vs-ref-mobile.png", 390, 844);

console.log("done");
await browser.close();
