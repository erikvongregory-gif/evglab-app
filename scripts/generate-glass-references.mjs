import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const dir = path.join(process.cwd(), "assets", "glass-references");

/** Neutral side-view silhouettes — geometry only, no lettering. */
const glasses = {
  willibecher: `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="1024" viewBox="0 0 768 1024">
  <rect width="768" height="1024" fill="#f5f5f5"/>
  <g fill="none" stroke="#1a1a1a" stroke-width="12" stroke-linejoin="round">
    <path d="M250 160 L220 760 Q220 860 384 860 Q548 860 548 760 L518 160 Z"/>
    <path d="M250 160 L518 160"/>
    <path d="M268 760 L500 760"/>
  </g>
</svg>`,
  pils_tulpe: `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="1024" viewBox="0 0 768 1024">
  <rect width="768" height="1024" fill="#f5f5f5"/>
  <g fill="none" stroke="#1a1a1a" stroke-width="12" stroke-linejoin="round">
    <ellipse cx="384" cy="900" rx="120" ry="26"/>
    <path d="M384 874 L384 600"/>
    <path d="M384 600 C290 600 235 500 235 390 C235 260 300 170 384 145 C468 170 533 260 533 390 C533 500 478 600 384 600"/>
  </g>
</svg>`,
  weizen: `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="1024" viewBox="0 0 768 1024">
  <rect width="768" height="1024" fill="#f5f5f5"/>
  <g fill="none" stroke="#1a1a1a" stroke-width="12" stroke-linejoin="round">
    <path d="M305 120 C235 200 215 320 240 500 C265 720 275 840 295 900 L473 900 C493 840 503 720 528 500 C553 320 533 200 463 120 Z"/>
    <path d="M305 120 L463 120"/>
    <path d="M295 900 L473 900"/>
  </g>
</svg>`,
  masskrug: `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="1024" viewBox="0 0 768 1024">
  <rect width="768" height="1024" fill="#f5f5f5"/>
  <g fill="none" stroke="#1a1a1a" stroke-width="12" stroke-linejoin="round">
    <rect x="210" y="180" width="310" height="640" rx="24"/>
    <path d="M520 300 C630 300 655 410 655 490 C655 570 630 680 520 680"/>
    <path d="M250 300 L480 300 M250 420 L480 420 M250 540 L480 540 M250 660 L480 660"/>
  </g>
</svg>`,
  ipa_teku: `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="1024" viewBox="0 0 768 1024">
  <rect width="768" height="1024" fill="#f5f5f5"/>
  <g fill="none" stroke="#1a1a1a" stroke-width="12" stroke-linejoin="round">
    <ellipse cx="384" cy="910" rx="130" ry="28"/>
    <path d="M384 882 L384 560"/>
    <path d="M384 560
      C265 560 210 475 225 365
      C240 255 300 195 345 165
      L345 140 L423 140 L423 165
      C468 195 528 255 543 365
      C558 475 503 560 384 560 Z"/>
  </g>
</svg>`,
  schwenker: `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="1024" viewBox="0 0 768 1024">
  <rect width="768" height="1024" fill="#f5f5f5"/>
  <g fill="none" stroke="#1a1a1a" stroke-width="12" stroke-linejoin="round">
    <ellipse cx="384" cy="900" rx="120" ry="26"/>
    <path d="M384 874 L384 620"/>
    <path d="M384 620
      C245 620 190 490 215 360
      C240 230 310 165 384 145
      C458 165 528 230 553 360
      C578 490 523 620 384 620 Z"/>
  </g>
</svg>`,
  stange: `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="1024" viewBox="0 0 768 1024">
  <rect width="768" height="1024" fill="#f5f5f5"/>
  <g fill="none" stroke="#1a1a1a" stroke-width="12" stroke-linejoin="round">
    <path d="M318 120 L318 880 L450 880 L450 120 Z"/>
    <path d="M318 120 L450 120"/>
    <path d="M318 880 L450 880"/>
  </g>
</svg>`,
};

await mkdir(dir, { recursive: true });
for (const [name, svg] of Object.entries(glasses)) {
  const out = path.join(dir, `${name}.png`);
  await sharp(Buffer.from(svg)).png().toFile(out);
  console.log("wrote", out);
}
