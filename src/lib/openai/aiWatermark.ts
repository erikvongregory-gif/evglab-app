import sharp from "sharp";

export type AiWatermarkCorner = "bottom-right" | "bottom-left";

const LABEL = "AI";
const METADATA_DESCRIPTION = "AI-generated image (EU AI Act Art. 50 transparency marking)";

/** Layout fuer sichtbares „AI“-Label — per Art. 50 erkennbar, optisch dezent. */
export function buildAiWatermarkOverlay(width: number, height: number, corner: AiWatermarkCorner = "bottom-right") {
  const scale = Math.min(width, height);
  const fontSize = Math.max(13, Math.round(scale * 0.021));
  const padX = Math.round(fontSize * 0.48);
  const padY = Math.round(fontSize * 0.3);
  const margin = Math.max(8, Math.round(scale * 0.016));
  const boxWidth = Math.round(fontSize * 1.45 + padX * 2);
  const boxHeight = Math.round(fontSize + padY * 2);
  const radius = Math.round(fontSize * 0.22);

  const x = corner === "bottom-right" ? width - boxWidth - margin : margin;
  const y = height - boxHeight - margin;
  const textX = corner === "bottom-right" ? x + boxWidth - padX : x + padX;
  const textAnchor = corner === "bottom-right" ? "end" : "start";
  const textY = y + padY + fontSize * 0.82;

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect x="${x}" y="${y}" width="${boxWidth}" height="${boxHeight}" rx="${radius}"
    fill="rgba(24,20,15,0.42)" stroke="rgba(255,255,255,0.18)" stroke-width="0.75"/>
  <text x="${textX}" y="${textY}" font-family="Inter, Arial, Helvetica, sans-serif"
    font-size="${fontSize}" font-weight="600" letter-spacing="0.05em"
    fill="rgba(255,255,255,0.88)" text-anchor="${textAnchor}">${LABEL}</text>
</svg>`;

  return { svg: Buffer.from(svg), boxWidth, boxHeight, x, y };
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

  const pipeline = image
    .composite([{ input: overlay.svg, top: 0, left: 0 }])
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
