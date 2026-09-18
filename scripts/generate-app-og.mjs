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

const mark = `<svg width="36" height="36" viewBox="0 0 28 28" fill="none"><path d="M4 22 Q10 12 16 20 T24 16" stroke="#E89259" stroke-width="1.6" stroke-linecap="round" opacity=".55"/><path d="M2 18 Q7 6 14 14 T26 10" stroke="#C7691E" stroke-width="2.2" stroke-linecap="round"/></svg>`;

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
