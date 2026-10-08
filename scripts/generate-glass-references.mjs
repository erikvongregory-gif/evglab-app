import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const dir = path.join(process.cwd(), "assets", "glass-references");

/** Neutral side-view silhouettes — geometry only, no lettering. */
const glasses = {
  willibecher: `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="1024" viewBox="0 0 768 1024">
  <rect width="768" height="1024" fill="#f5f5f5"/>
  <g fill="none" stroke="#1a1a1a" stroke-width="12" stroke-linejoin="round">
    <path d="M300 880 L240 360 Q222 250 256 170 L512 170 Q546 250 528 360 L468 880 Z"/>
    <path d="M256 170 L512 170"/>
    <path d="M296 830 L472 830"/>
  </g>
</svg>`,
  pils_tulpe: `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="1024" viewBox="0 0 768 1024">
  <rect width="768" height="1024" fill="#f5f5f5"/>
  <g fill="none" stroke="#1a1a1a" stroke-width="12" stroke-linejoin="round">
    <ellipse cx="384" cy="910" rx="104" ry="24"/>
    <path d="M384 886 L384 640"/>
    <path d="M282 110 C298 160 300 200 296 250 C284 370 258 480 298 565 Q336 640 384 640 Q432 640 470 565 C510 480 484 370 472 250 C468 200 470 160 486 110 Z"/>
    <path d="M282 110 L486 110"/>
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
  seidel: `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="1024" viewBox="0 0 768 1024">
  <rect width="768" height="1024" fill="#f5f5f5"/>
  <g fill="none" stroke="#1a1a1a" stroke-width="12" stroke-linejoin="round">
    <path d="M230 230 L230 800 Q230 840 270 840 L470 840 Q510 840 510 800 L510 230 Z"/>
    <path d="M230 800 L510 800"/>
    <path d="M510 330 C610 330 630 420 630 500 C630 580 610 680 510 680"/>
    <path d="M270 330 L270 760 M330 330 L330 760 M410 330 L410 760 M470 330 L470 760"/>
  </g>
</svg>`,
  steinkrug: `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="1024" viewBox="0 0 768 1024">
  <rect width="768" height="1024" fill="#f5f5f5"/>
  <g fill="#9a958c" stroke="#1a1a1a" stroke-width="12" stroke-linejoin="round">
    <path d="M240 220 C225 420 225 640 250 840 L490 840 C515 640 515 420 500 220 Z"/>
    <path fill="none" d="M500 330 C610 330 630 430 630 520 C630 610 610 700 495 700"/>
  </g>
  <g fill="none" stroke="#1a1a1a" stroke-width="8">
    <path d="M236 300 L504 300 M236 760 L504 760"/>
  </g>
</svg>`,
  pokal: `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="1024" viewBox="0 0 768 1024">
  <rect width="768" height="1024" fill="#f5f5f5"/>
  <g fill="none" stroke="#1a1a1a" stroke-width="12" stroke-linejoin="round">
    <ellipse cx="384" cy="900" rx="125" ry="26"/>
    <path d="M384 874 L384 700"/>
    <path d="M340 874 Q384 840 428 874"/>
    <path d="M384 700 C250 700 215 560 215 420 C215 330 230 240 250 200 L518 200 C538 240 553 330 553 420 C553 560 518 700 384 700 Z"/>
  </g>
</svg>`,
  nonic: `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="1024" viewBox="0 0 768 1024">
  <rect width="768" height="1024" fill="#f5f5f5"/>
  <g fill="none" stroke="#1a1a1a" stroke-width="12" stroke-linejoin="round">
    <path d="M262 140 L266 220 C232 240 232 290 270 310 L300 880 L468 880 L498 310 C536 290 536 240 502 220 L506 140 Z"/>
    <path d="M262 140 L506 140"/>
    <path d="M300 880 L468 880"/>
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
