import sharp from "sharp";

export type AiWatermarkCorner = "bottom-right" | "bottom-left";

const METADATA_DESCRIPTION = "AI-generated image (EU AI Act Art. 50 transparency marking)";

/**
 * „AI“ als Pfade — kein System-Font (librsvg rendert `<text>` auf Serverless oft als leeren Kasten).
 * viewBox 0 0 100 56.
 */
function aiLabelGlyphPaths(): string {
  return `
  <g fill="none" stroke="#ffffff" stroke-linecap="round" stroke-linejoin="round">
    <path stroke-width="7.5" d="M14 46 L32 10 L50 46"/>
    <path stroke-width="6" d="M21 32 H43"/>
    <path stroke-width="8" d="M70 12 V44"/>
    <path stroke-width="6" d="M60 12 H80"/>
    <path stroke-width="6" d="M60 44 H80"/>
  </g>`;
}

/** Layout fuer sichtbares „AI“-Label — per Art. 50 erkennbar. */
export function buildAiWatermarkOverlay(width: number, height: number, corner: AiWatermarkCorner = "bottom-right") {
  const scale = Math.min(width, height);
  // ~3.2% der kürzeren Kante, mind. 22px — vorher ~2.1%/13px war zu dezent
  const fontSize = Math.max(22, Math.round(scale * 0.032));
  const padX = Math.round(fontSize * 0.55);
  const padY = Math.round(fontSize * 0.38);
  const margin = Math.max(12, Math.round(scale * 0.018));
  const glyphW = Math.round(fontSize * 2.15);
  const glyphH = Math.round(fontSize * 1.2);
  const boxWidth = glyphW + padX * 2;
  const boxHeight = glyphH + padY * 2;
  const radius = Math.round(fontSize * 0.28);

  const x = corner === "bottom-right" ? width - boxWidth - margin : margin;
  const y = height - boxHeight - margin;

  // Nur Badge-SVG — wird an (x,y) compositet
  const svg = `<svg width="${boxWidth}" height="${boxHeight}" viewBox="0 0 ${boxWidth} ${boxHeight}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="${boxWidth}" height="${boxHeight}" rx="${radius}"
    fill="rgba(0,0,0,0.72)" stroke="rgba(255,255,255,0.35)" stroke-width="1"/>
  <svg x="${padX}" y="${padY}" width="${glyphW}" height="${glyphH}" viewBox="0 0 100 56" preserveAspectRatio="xMidYMid meet">
    ${aiLabelGlyphPaths()}
  </svg>
</svg>`;

  return { svg: Buffer.from(svg), boxWidth, boxHeight, x, y, fontSize };
}

/** Sichtbares AI-Label + maschinenlesbare Metadaten (EXIF-Beschreibung). */
export async function applyAiWatermark(
  buffer: Buffer,
  outputFormat: "png" | "jpg" = "png",
  corner: AiWatermarkCorner = "bottom-right",
): Promise<Buffer> {
  const image = sharp(buffer);
  const meta = await image.metadata();
  const width = meta.width ?? 1024;
  const height = meta.height ?? 1024;
  const overlay = buildAiWatermarkOverlay(width, height, corner);

  // Badge zuerst zu PNG — garantiert sichtbare Pixel, kein Font-Fallback
  const badgePng = await sharp(overlay.svg).png().toBuffer();

  const pipeline = image
    .composite([{ input: badgePng, top: overlay.y, left: overlay.x }])
    .withMetadata({
      exif: {
        IFD0: {
          ImageDescription: METADATA_DESCRIPTION,
          Copyright: "AI-generated",
        },
      },
    });

  return outputFormat === "jpg" ? pipeline.jpeg({ quality: 92 }).toBuffer() : pipeline.png().toBuffer();
}
