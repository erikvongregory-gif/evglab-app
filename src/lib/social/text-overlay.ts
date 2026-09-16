import sharp from "sharp";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type SocialTextOverlayInput = {
  width: number;
  height: number;
  headline: string;
  subline?: string;
  ctaText?: string;
  fontName: string;
  fontWeight?: string;
  fontBuffer?: Buffer | null;
  fontMime?: string;
  textColor?: string;
  ctaBackground?: string;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapLines(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    if (lines.length >= maxLines - 1) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines.slice(0, maxLines);
}

function fontExtension(mime?: string): string {
  if (mime?.includes("woff2")) return "woff2";
  if (mime?.includes("woff")) return "woff";
  if (mime?.includes("otf")) return "otf";
  return "ttf";
}

async function registerFont(font: string, fontfile: string): Promise<void> {
  await sharp({ text: { text: "x", font: `${font} 12`, fontfile } }).png().toBuffer();
}

async function registerOverlayFonts(input: SocialTextOverlayInput): Promise<string> {
  const fallbackName = "Work Sans";
  const fallbackPath = join(
    process.cwd(),
    "public",
    "public",
    "fonts",
    "work-sans-latin-ext-700-normal.woff2",
  );
  await registerFont(fallbackName, fallbackPath);

  if (!input.fontBuffer?.byteLength) return fallbackName;
  const digest = createHash("sha256").update(input.fontBuffer).digest("hex");
  // ponytail: one deterministic temp file per uploaded font; serverless instance cleanup evicts the cache.
  const fontPath = join(tmpdir(), `brewai-overlay-${digest}.${fontExtension(input.fontMime)}`);
  try {
    await writeFile(fontPath, input.fontBuffer);
    await registerFont(input.fontName, fontPath);
    return input.fontName;
  } catch {
    return fallbackName;
  }
}

export function buildSocialTextOverlaySvg(input: SocialTextOverlayInput): string {
  const { width, height } = input;
  const padX = Math.round(width * 0.08);
  const headlineSize = Math.round(width * 0.085);
  const sublineSize = Math.round(width * 0.042);
  const ctaSize = Math.round(width * 0.034);
  const headlineLines = wrapLines(input.headline, input.width < 900 ? 14 : 18, 3);
  const sublineLines = input.subline ? wrapLines(input.subline, 28, 2) : [];
  const textColor = input.textColor?.trim() || "#FFFFFF";
  const ctaBg = input.ctaBackground?.trim() || textColor;
  const ctaFg = ctaBg.toLowerCase() === "#ffffff" || ctaBg.toLowerCase() === "#fff" ? "#1A1A1A" : "#FFFFFF";
  const fontFamily = escapeXml(input.fontName || "Work Sans");
  const fontWeight = escapeXml(input.fontWeight?.trim() || "700");

  let y = Math.round(height * 0.1);

  let headlineBlock = "";
  if (headlineLines.length > 0) {
    headlineBlock = `<text x="${padX}" y="${y + headlineSize}" fill="${textColor}" font-family="'${fontFamily}', 'Work Sans', sans-serif" font-size="${headlineSize}" font-weight="${fontWeight}">${headlineLines.map((line, i) => `<tspan x="${padX}" dy="${i === 0 ? 0 : headlineSize * 1.08}">${escapeXml(line)}</tspan>`).join("")}</text>`;
    y += headlineLines.length * headlineSize * 1.15 + sublineSize * 0.5;
  }

  let sublineBlock = "";
  if (sublineLines.length > 0) {
    sublineBlock = `<text x="${padX}" y="${y + sublineSize}" fill="${textColor}" opacity="0.92" font-family="'${fontFamily}', 'Work Sans', sans-serif" font-size="${sublineSize}" font-weight="500">${sublineLines.map((line, i) => `<tspan x="${padX}" dy="${i === 0 ? 0 : sublineSize * 1.2}">${escapeXml(line)}</tspan>`).join("")}</text>`;
  }

  let ctaBlock = "";
  const cta = input.ctaText?.trim();
  if (cta) {
    const ctaPadX = Math.round(ctaSize * 1.4);
    const ctaPadY = Math.round(ctaSize * 0.65);
    const ctaTextWidth = Math.min(width - padX * 2, cta.length * ctaSize * 0.62 + ctaPadX * 2);
    const ctaHeight = ctaSize + ctaPadY * 2;
    const ctaX = padX;
    const ctaY = height - Math.round(height * 0.1) - ctaHeight;
    ctaBlock = [
      `<rect x="${ctaX}" y="${ctaY}" rx="${Math.round(ctaHeight / 2)}" ry="${Math.round(ctaHeight / 2)}" width="${Math.round(ctaTextWidth)}" height="${ctaHeight}" fill="${ctaBg}" opacity="0.96"/>`,
      `<text x="${ctaX + ctaPadX}" y="${ctaY + ctaPadY + ctaSize * 0.82}" fill="${ctaFg}" font-family="'${fontFamily}', 'Work Sans', sans-serif" font-size="${ctaSize}" font-weight="700">${escapeXml(cta)}</text>`,
    ].join("");
  }

  const gradient = [
    `<defs>`,
    `<linearGradient id="topFade" x1="0" y1="0" x2="0" y2="1">`,
    `<stop offset="0%" stop-color="#000000" stop-opacity="0.45"/>`,
    `<stop offset="55%" stop-color="#000000" stop-opacity="0.12"/>`,
    `<stop offset="100%" stop-color="#000000" stop-opacity="0"/>`,
    `</linearGradient>`,
    `</defs>`,
    `<rect width="${width}" height="${Math.round(height * 0.42)}" fill="url(#topFade)"/>`,
  ].join("");

  return [
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`,
    gradient,
    headlineBlock,
    sublineBlock,
    ctaBlock,
    `</svg>`,
  ].join("");
}

export async function composeSocialTextOverlay(args: {
  imageBuffer: Buffer;
  overlay: SocialTextOverlayInput;
}): Promise<Buffer> {
  const meta = await sharp(args.imageBuffer).metadata();
  const width = meta.width ?? args.overlay.width;
  const height = meta.height ?? args.overlay.height;
  const fontName = await registerOverlayFonts(args.overlay);
  const svg = buildSocialTextOverlaySvg({ ...args.overlay, fontName, width, height });
  return sharp(args.imageBuffer)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();
}

export function parsePrimaryBrandColor(brandColors: string): string {
  const match = brandColors.match(/#[0-9A-Fa-f]{6}\b/);
  return match?.[0] ?? "#FFFFFF";
}
