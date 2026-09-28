import sharp from "sharp";

/** Sharp look stills imprint faces and brands. Blur keeps light, crop, and energy only. */
export async function blurLookReference(raw: Buffer): Promise<Buffer | null> {
  if (!raw.byteLength) return null;
  return sharp(raw).rotate().resize({ width: 768, height: 768, fit: "inside" }).blur(22).jpeg({ quality: 75 }).toBuffer();
}
