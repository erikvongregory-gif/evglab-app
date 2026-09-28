import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const dir = path.join(process.cwd(), "assets", "liquid-references");

/** Dense naturtrüb beer body — haze only, no branding, nearly opaque. */
const trueb = `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="1024" viewBox="0 0 768 1024">
  <defs>
    <linearGradient id="haze" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f0d888"/>
      <stop offset="40%" stop-color="#d9b24a"/>
      <stop offset="100%" stop-color="#b8892e"/>
    </linearGradient>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.85
                                          0 0 0 0 0.70
                                          0 0 0 0 0.30
                                          0 0 0 0.35 0"/>
    </filter>
  </defs>
  <rect width="768" height="1024" fill="#ececec"/>
  <path d="M250 160 L220 780 Q220 860 384 860 Q548 860 548 780 L518 160 Z" fill="url(#haze)" stroke="#222" stroke-width="8"/>
  <!-- solid opaque body — no see-through -->
  <path d="M255 200 L228 770 Q228 840 384 840 Q540 840 540 770 L513 200 Z" fill="#d4a84a" opacity="0.92"/>
  <path d="M255 200 L228 770 Q228 840 384 840 Q540 840 540 770 L513 200 Z" filter="url(#grain)"/>
  <ellipse cx="384" cy="190" rx="140" ry="40" fill="#f7f2e6"/>
  <ellipse cx="350" cy="175" rx="40" ry="16" fill="#fff" opacity="0.7"/>
  <ellipse cx="420" cy="182" rx="28" ry="12" fill="#fff" opacity="0.55"/>
</svg>`;

await mkdir(dir, { recursive: true });
const out = path.join(dir, "trueb.png");
await sharp(Buffer.from(trueb)).png().toFile(out);
console.log("wrote", out);
