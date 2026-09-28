/** Rebuild the public sharing image from the real dashboard screenshot:
 *  node scripts/generate-app-og.mjs
 *
 * Optional: DASHBOARD_SHOT=path/to/shot.png to override the inset source.
 * Capture a fresh shot first with: node scripts/linkedin-dashboard-screenshot.mjs
 */
import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url));

async function dataUrl(file, mime) {
  return `data:${mime};base64,${(await readFile(path.join(root, file))).toString("base64")}`;
}

const regular = await dataUrl("node_modules/geist/dist/fonts/geist-sans/Geist-Regular.woff2", "font/woff2");
const medium = await dataUrl("node_modules/geist/dist/fonts/geist-sans/Geist-Medium.woff2", "font/woff2");
const semibold = await dataUrl("node_modules/geist/dist/fonts/geist-sans/Geist-SemiBold.woff2", "font/woff2");
const shotRel =
  process.env.DASHBOARD_SHOT?.trim() || "docs/visual-qa/linkedin-real-dashboard.png";
const shot = await dataUrl(shotRel, "image/png");

const mark = `<svg width="36" height="36" viewBox="150 0 365 390" fill="#18140F"><path fill-rule="evenodd" d="M190.55 383.89 C182.55 381.98 172.59 376.29 166.64 370.22 C159.8 363.25 156.77 358.24 154.02 349.33 C152.05 342.95 152 340.29 152 239.48 L152 136.18 L155.75 135.56 C160.28 134.81 170.1 137.22 174.07 140.05 C178.35 143.1 183.48 149.5 185.04 153.73 C186.18 156.81 186.53 174.32 186.97 249 C187.46 334.03 187.63 340.73 189.27 343.74 C192.25 349.2 197.08 354 202.41 356.81 L207.5 359.5 L244.5 359.5 L281.5 359.5 L286 357.11 C296.06 351.75 300.4 346.68 303.96 336.11 C305.97 330.14 306 328.24 306 192.54 L306 55.01 L229.25 54.76 L152.5 54.5 L152.23 27.76 L151.97 1.02 L272.73 0.76 C339.16 0.62 399.25 0.82 406.28 1.21 C421.07 2.03 431.25 4.42 445 10.3 C472.24 21.94 494.43 45.05 503.3 71 C508.05 84.91 509.29 93.8 508.73 109.89 C508.18 125.55 506.69 132.43 501.51 143.39 C498.23 150.32 490.36 160.99 484.62 166.31 C479.31 171.22 466.96 180.69 460.26 184.97 C456.23 187.55 455.27 188.62 456.1 189.62 C456.7 190.34 458.07 191.2 459.15 191.55 C462.02 192.46 476.61 201.62 483.05 206.56 C491.48 213.02 504.49 227.27 509 235 C527.61 266.87 527.49 308.96 508.71 335.25 C498.98 348.86 481.52 363.2 464.71 371.37 C453.06 377.03 446.78 379.35 435.5 382.16 L426.5 384.39 L310.5 384.61 C240.64 384.74 192.93 384.46 190.55 383.89 Z M214.5 346.04 C208.45 343.15 206.22 340.93 204.53 336.12 C203.21 332.34 203 321.29 203 254.06 C203 170.21 203.06 169.11 208.25 164.24 C213.9 158.92 224.95 157.43 232.68 160.94 C235.32 162.14 237.91 164.42 239.68 167.1 L242.5 171.35 L242.5 253.5 L242.5 335.65 L239.68 339.9 C234.67 347.48 223.3 350.25 214.5 346.04 Z M272.81 346.91 C267.47 346.08 263.98 343.83 261.33 339.5 C259.6 336.66 259.5 332.47 259.5 261 C259.5 189.01 259.59 185.32 261.39 181.7 C263.83 176.78 269.71 173.64 276.54 173.6 C282.56 173.57 287.49 176.12 290.75 180.95 L293 184.3 L293 260.2 C293 341.17 293.13 338.85 288.2 343.32 C285.1 346.13 278.18 347.74 272.81 346.91 Z M433.07 303.8 C439.66 300.62 446.28 293.8 449.17 287.22 C450.33 284.58 451.46 279.41 451.72 275.5 C452.1 269.96 451.75 267.32 450.07 262.85 C447.1 254.99 441.29 248.76 433.22 244.79 L426.55 241.5 L382.77 241.21 L339 240.92 L339 274 L339 307.08 L383.25 306.79 L427.5 306.5 L433.07 303.8 Z M245.15 142.47 C243.5 141.08 241.86 138.63 241.5 137.02 C240.57 132.76 243.39 127.52 247.72 125.46 C250.66 124.07 251.94 123.97 255.03 124.89 C259.67 126.28 262 129.67 262 135.04 C262 143.83 252 148.24 245.15 142.47 Z M427.62 139.3 C436.91 134.33 441.3 128.18 442.93 117.86 C443.96 111.34 442.06 103.07 438.42 98.31 C437.05 96.51 433.81 93.8 431.22 92.27 L426.5 89.5 L383.4 89.21 L340.3 88.92 L339.65 96.61 C338.82 106.46 338.81 134.78 339.63 138.92 L340.27 142.08 L381.88 141.79 C422.58 141.51 423.59 141.45 427.62 139.3 Z M194.5 121.79 C189.5 120.05 185.32 116.3 182.99 111.47 C179.84 104.98 180.49 96.61 184.58 90.79 C188.36 85.41 192.55 83 199.37 82.3 C203.7 81.85 205.74 82.18 209.22 83.87 C215.45 86.88 219.04 91.04 220.6 97.04 C222.6 104.73 220.97 111.09 215.64 116.41 C209.71 122.33 201.8 124.34 194.5 121.79 Z"/></svg>`;

// Dashboard tokens: --bg #F6F6F4 · --t1 #18140F · --t2 #4A4339 · --ac #C7691E · --line #E5E3DE
const html = `<!doctype html>
<html lang="de">
<meta charset="utf-8">
<style>
@font-face{font-family:Geist;src:url('${regular}');font-weight:400}
@font-face{font-family:Geist;src:url('${medium}');font-weight:500}
@font-face{font-family:Geist;src:url('${semibold}');font-weight:600}
*{box-sizing:border-box}
body{
  margin:0;width:1200px;height:630px;overflow:hidden;
  background:#F6F6F4;color:#18140F;font-family:Geist,sans-serif;
}
body:before{
  content:'';position:absolute;inset:0;pointer-events:none;
  background:
    radial-gradient(ellipse 55% 70% at 12% 40%, #FBEFE0 0%, transparent 62%),
    radial-gradient(ellipse 40% 50% at 88% 80%, rgba(199,105,30,.06) 0%, transparent 55%);
}
.brand{
  position:absolute;top:48px;left:52px;z-index:1;
  display:flex;align-items:center;gap:10px;
  font-size:26px;font-weight:600;letter-spacing:-.04em;color:#18140F;
}
.brand small{
  margin-left:2px;padding-left:10px;border-left:1px solid #E5E3DE;
  font-size:12px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:#C7691E;
}
.copy{position:absolute;left:52px;top:188px;width:400px;z-index:1}
.eyebrow{
  font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#C7691E;
}
h1{
  font-size:52px;font-weight:600;letter-spacing:-.045em;line-height:1.05;
  margin:18px 0 0;color:#18140F;
}
h1 span{color:#C7691E}
.sub{
  margin-top:20px;font-size:17px;font-weight:400;line-height:1.5;color:#4A4339;max-width:340px;
}
.footer{
  position:absolute;bottom:44px;left:52px;z-index:1;
  display:flex;align-items:center;gap:12px;
  font-size:13px;font-weight:500;letter-spacing:.02em;color:#5E574E;
}
.footer:before{content:'';width:20px;height:1.5px;background:#C7691E;border-radius:1px}
.frame{
  position:absolute;left:490px;top:48px;width:770px;height:546px;z-index:1;
  border-radius:12px;overflow:hidden;background:#FFFFFF;
  border:1px solid #E5E3DE;
  box-shadow:0 1px 2px rgba(24,20,15,.04), 0 24px 64px rgba(24,20,15,.10);
  transform:rotate(-1.8deg);transform-origin:center;
}
.chrome{
  height:34px;display:flex;align-items:center;gap:6px;padding:0 14px;
  background:#FAFAF8;border-bottom:1px solid #E5E3DE;
}
.dot{width:7px;height:7px;border-radius:50%;background:#D8D5CE}
.address{margin-left:12px;color:#5E574E;font-size:11px;font-weight:500}
.shot-wrap{position:relative;height:512px;overflow:hidden;background:#F6F6F4}
.shot{display:block;width:100%;height:512px;object-fit:cover;object-position:left top}
/* next-dev indicator (bottom-left “N”) aus dem Live-Shot abdecken */
.shot-wrap:after{
  content:'';position:absolute;left:6px;bottom:6px;width:52px;height:52px;
  background:#FFFFFF;border-radius:10px;pointer-events:none;
}
</style>
<body>
  <div class="brand">${mark}BrewAI<small>Studio</small></div>
  <section class="copy">
    <div class="eyebrow">Das KI-Studio für Brauereien</div>
    <h1>Deine Brauerei.<br><span>Dein Content.</span></h1>
    <div class="sub">Aus deinem Bier wird ein Motiv.<br>Aus deiner Marke ein eigener Stil.</div>
  </section>
  <div class="footer">app.brewai.de</div>
  <section class="frame" aria-label="BrewAI Dashboard">
    <div class="chrome">
      <i class="dot"></i><i class="dot"></i><i class="dot"></i>
      <span class="address">app.brewai.de / dashboard</span>
    </div>
    <div class="shot-wrap">
      <img class="shot" src="${shot}" alt="BrewAI Dashboard">
    </div>
  </section>
</body>
</html>`;

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((img) => img.decode()));
  });
  const output = path.join(root, "public/og/brewai-studio-v1.png");
  await mkdir(path.dirname(output), { recursive: true });
  await page.screenshot({ path: output, type: "png" });
  console.log(`Wrote ${output} (inset: ${shotRel})`);
} finally {
  await browser.close();
}
