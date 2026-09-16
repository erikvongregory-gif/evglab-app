import sharp from "sharp";
import { join } from "node:path";

export type SocialTextOverlayInput = {
  width: number;
  height: number;
  headline: string;
  subline?: string;
  ctaText?: string;
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

export function wrapCampaignText(text: string, preferredChars: number, maxLines: number): string[] {
  let words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lineCount = Math.min(maxLines, Math.max(1, Math.ceil(text.trim().length / preferredChars)));
  const lines: string[] = [];
  while (lines.length < lineCount - 1 && words.length > 1) {
    const remainingLines = lineCount - lines.length;
    const target = words.join(" ").length / remainingLines;
    let bestSplit = 1;
    let bestDelta = Number.POSITIVE_INFINITY;
    for (let split = 1; split <= words.length - (remainingLines - 1); split += 1) {
      const delta = Math.abs(words.slice(0, split).join(" ").length - target);
      if (delta < bestDelta) {
        bestSplit = split;
        bestDelta = delta;
      }
    }
    lines.push(words.slice(0, bestSplit).join(" "));
    words = words.slice(bestSplit);
  }
  lines.push(words.join(" "));
  return lines;
}

type OverlayFont = { name: string; path: string };

function overlayFont(): OverlayFont {
  return {
    name: "Work Sans",
    path: join(
      process.cwd(),
      "public",
      "public",
      "fonts",
      "work-sans-latin-ext-700-normal.woff2",
    ),
  };
}

async function renderText(args: {
  text: string;
  font: OverlayFont;
  size: number;
  weight: string;
  color: string;
  width?: number;
}): Promise<Buffer> {
  const markup = `<span foreground="${escapeXml(args.color)}" weight="${escapeXml(args.weight)}" size="${Math.round(args.size * 1024)}">${escapeXml(args.text)}</span>`;
  return sharp({
    text: {
      text: markup,
      font: args.font.name,
      fontfile: args.font.path,
      width: args.width,
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
    `<stop offset="0%" stop-color="#000000" stop-opacity="0.58"/>`,
    `<stop offset="60%" stop-color="#000000" stop-opacity="0.14"/>`,
    `<stop offset="100%" stop-color="#000000" stop-opacity="0"/>`,
    `</linearGradient>`,
    `<linearGradient id="leftFade" x1="0" y1="0" x2="1" y2="0">`,
    `<stop offset="0%" stop-color="#000000" stop-opacity="0.32"/>`,
    `<stop offset="75%" stop-color="#000000" stop-opacity="0"/>`,
    `</linearGradient>`,
    `</defs>`,
    `<rect width="${args.width}" height="${Math.round(args.height * 0.48)}" fill="url(#topFade)"/>`,
    `<rect width="${Math.round(args.width * 0.78)}" height="${Math.round(args.height * 0.55)}" fill="url(#leftFade)"/>`,
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
  const font = overlayFont();
  const story = height / width >= 1.6;
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const padX = Math.round(width * (story ? 0.07 : 0.075));
  const copyWidth = Math.round(width * (story ? 0.68 : 0.62));
  const headlineSize = Math.round(clamp(width * 0.065, 52, 78));
  const sublineSize = Math.round(clamp(width * 0.032, 28, 42));
  const ctaSize = Math.round(clamp(width * 0.028, 26, 36));
  const headlineLines = wrapCampaignText(args.overlay.headline, story ? 17 : 20, 2);
  const sublineLines = args.overlay.subline ? wrapCampaignText(args.overlay.subline, story ? 25 : 30, 2) : [];
  const textColor = args.overlay.textColor?.trim() || "#FFFFFF";
  const ctaBg = args.overlay.ctaBackground?.trim() || textColor;
  const ctaFg = ["#ffffff", "#fff"].includes(ctaBg.toLowerCase()) ? "#1A1A1A" : "#FFFFFF";
  const cta = args.overlay.ctaText?.trim();
  const ctaPadX = Math.round(ctaSize * 1.4);
  const ctaPadY = Math.round(ctaSize * 0.65);
  const ctaHeight = ctaSize + ctaPadY * 2;
  const ctaX = padX;
  const ctaY = Math.round(height * (story ? 0.62 : 0.9)) - ctaHeight;
  const ctaText = cta
    ? await renderText({ text: cta, font, size: ctaSize, weight: "700", color: ctaFg })
    : null;
  const ctaTextMeta = ctaText ? await sharp(ctaText).metadata() : null;
  const ctaWidth = ctaTextMeta
    ? Math.min(width - padX * 2, (ctaTextMeta.width ?? 0) + ctaPadX * 2)
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

  let y = Math.round(height * (story ? 0.15 : 0.075));
  if (headlineLines.length) {
    const headlineText = await renderText({
      text: headlineLines.join("\n"),
      font,
      size: headlineSize,
      weight: "700",
      color: textColor,
      width: copyWidth,
    });
    layers.push({
      input: headlineText,
      top: y,
      left: padX,
    });
    const headlineMeta = await sharp(headlineText).metadata();
    y += (headlineMeta.height ?? headlineLines.length * headlineSize * 1.15) + sublineSize * 0.65;
  }
  if (sublineLines.length) {
    layers.push({
      input: await renderText({
        text: sublineLines.join("\n"),
        font,
        size: sublineSize,
        weight: "500",
        color: textColor,
        width: copyWidth,
      }),
      top: Math.round(y),
      left: padX,
    });
  }
  if (ctaText && ctaTextMeta) {
    layers.push({
      input: ctaText,
      top: Math.round(ctaY + (ctaHeight - (ctaTextMeta.height ?? ctaSize)) / 2),
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
