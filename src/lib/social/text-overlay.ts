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

type OverlayFont = { name: string; path: string };

async function resolveOverlayFont(input: SocialTextOverlayInput): Promise<OverlayFont> {
  const fallbackName = "Work Sans";
  const fallbackPath = join(
    process.cwd(),
    "public",
    "public",
    "fonts",
    "work-sans-latin-ext-700-normal.woff2",
  );
  const fallback = { name: fallbackName, path: fallbackPath };

  if (!input.fontBuffer?.byteLength) return fallback;
  const digest = createHash("sha256").update(input.fontBuffer).digest("hex");
  // ponytail: one deterministic temp file per uploaded font; serverless instance cleanup evicts the cache.
  const fontPath = join(tmpdir(), `brewai-overlay-${digest}.${fontExtension(input.fontMime)}`);
  try {
    await writeFile(fontPath, input.fontBuffer);
    await sharp({
      text: { text: "x", font: input.fontName, fontfile: fontPath, rgba: true },
    }).png().toBuffer();
    return { name: input.fontName, path: fontPath };
  } catch {
    return fallback;
  }
}

async function renderText(args: {
  text: string;
  font: OverlayFont;
  size: number;
  weight: string;
  color: string;
  width?: number;
  spacing?: number;
}): Promise<Buffer> {
  const markup = `<span foreground="${escapeXml(args.color)}" weight="${escapeXml(args.weight)}" size="${Math.round(args.size * 1024)}">${escapeXml(args.text)}</span>`;
  return sharp({
    text: {
      text: markup,
      font: args.font.name,
      fontfile: args.font.path,
      width: args.width,
      spacing: args.spacing === undefined ? undefined : Math.round(args.spacing),
      rgba: true,
    },
  }).png().toBuffer();
}

function buildDecorationsSvg(args: {
  width: number;
  height: number;
  cta?: { x: number; y: number; width: number; height: number; color: string };
}): Buffer {
  const cta = args.cta
    ? `<rect x="${args.cta.x}" y="${args.cta.y}" rx="${Math.round(args.cta.height / 2)}" ry="${Math.round(args.cta.height / 2)}" width="${args.cta.width}" height="${args.cta.height}" fill="${escapeXml(args.cta.color)}" opacity="0.96"/>`
    : "";
  return Buffer.from([
    `<svg width="${args.width}" height="${args.height}" xmlns="http://www.w3.org/2000/svg">`,
    `<defs>`,
    `<linearGradient id="topFade" x1="0" y1="0" x2="0" y2="1">`,
    `<stop offset="0%" stop-color="#000000" stop-opacity="0.45"/>`,
    `<stop offset="55%" stop-color="#000000" stop-opacity="0.12"/>`,
    `<stop offset="100%" stop-color="#000000" stop-opacity="0"/>`,
    `</linearGradient>`,
    `</defs>`,
    `<rect width="${args.width}" height="${Math.round(args.height * 0.42)}" fill="url(#topFade)"/>`,
    cta,
    `</svg>`,
  ].join(""));
}

export async function composeSocialTextOverlay(args: {
  imageBuffer: Buffer;
  overlay: SocialTextOverlayInput;
}): Promise<Buffer> {
  const meta = await sharp(args.imageBuffer).metadata();
  const width = meta.width ?? args.overlay.width;
  const height = meta.height ?? args.overlay.height;
  const font = await resolveOverlayFont(args.overlay);
  const padX = Math.round(width * 0.08);
  const headlineSize = Math.round(width * 0.085);
  const sublineSize = Math.round(width * 0.042);
  const ctaSize = Math.round(width * 0.034);
  const headlineLines = wrapLines(args.overlay.headline, width < 900 ? 14 : 18, 3);
  const sublineLines = args.overlay.subline ? wrapLines(args.overlay.subline, 28, 2) : [];
  const textColor = args.overlay.textColor?.trim() || "#FFFFFF";
  const ctaBg = args.overlay.ctaBackground?.trim() || textColor;
  const ctaFg = ["#ffffff", "#fff"].includes(ctaBg.toLowerCase()) ? "#1A1A1A" : "#FFFFFF";
  const cta = args.overlay.ctaText?.trim();
  const ctaPadX = Math.round(ctaSize * 1.4);
  const ctaPadY = Math.round(ctaSize * 0.65);
  const ctaHeight = ctaSize + ctaPadY * 2;
  const ctaX = padX;
  const ctaY = height - Math.round(height * 0.1) - ctaHeight;
  const ctaWidth = cta
    ? Math.round(Math.min(width - padX * 2, cta.length * ctaSize * 0.62 + ctaPadX * 2))
    : 0;
  const layers: Array<{ input: Buffer; top: number; left: number }> = [{
    input: buildDecorationsSvg({
      width,
      height,
      cta: cta ? { x: ctaX, y: ctaY, width: ctaWidth, height: ctaHeight, color: ctaBg } : undefined,
    }),
    top: 0,
    left: 0,
  }];

  let y = Math.round(height * 0.1);
  if (headlineLines.length) {
    const headlineText = await renderText({
      text: headlineLines.join("\n"),
      font,
      size: headlineSize,
      weight: args.overlay.fontWeight?.trim() || "700",
      color: textColor,
      width: width - padX * 2,
      spacing: headlineSize * 1.08,
    });
    layers.push({
      input: headlineText,
      top: y,
      left: padX,
    });
    const headlineMeta = await sharp(headlineText).metadata();
    y += (headlineMeta.height ?? headlineLines.length * headlineSize * 1.15) + sublineSize * 0.5;
  }
  if (sublineLines.length) {
    layers.push({
      input: await renderText({
        text: sublineLines.join("\n"),
        font,
        size: sublineSize,
        weight: "500",
        color: textColor,
        width: width - padX * 2,
        spacing: sublineSize * 1.2,
      }),
      top: Math.round(y),
      left: padX,
    });
  }
  if (cta) {
    const ctaText = await renderText({
      text: cta,
      font,
      size: ctaSize,
      weight: "700",
      color: ctaFg,
      width: Math.max(1, ctaWidth - ctaPadX * 2),
    });
    const ctaMeta = await sharp(ctaText).metadata();
    layers.push({
      input: ctaText,
      top: Math.round(ctaY + (ctaHeight - (ctaMeta.height ?? ctaSize)) / 2),
      left: ctaX + ctaPadX,
    });
  }

  return sharp(args.imageBuffer)
    .composite(layers)
    .png()
    .toBuffer();
}

export function parsePrimaryBrandColor(brandColors: string): string {
  const match = brandColors.match(/#[0-9A-Fa-f]{6}\b/);
  return match?.[0] ?? "#FFFFFF";
}
