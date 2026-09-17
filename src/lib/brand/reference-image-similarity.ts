import sharp from "sharp";

/** Fixed RGB thumbnail: independent of source dimensions, metadata and encoding. */
export async function referenceImageFingerprint(buffer: Buffer): Promise<string> {
  const pixels = await sharp(buffer)
    .rotate()
    .flatten({ background: "#ffffff" })
    .toColourspace("srgb")
    .resize(16, 16, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer();
  return pixels.toString("base64");
}

/** Conservative comparison for resized/recompressed copies, not semantic similarity. */
export function matchingReferenceFingerprints(a: string, b: string): boolean {
  const left = Buffer.from(a, "base64");
  const right = Buffer.from(b, "base64");
  if (left.length !== 768 || right.length !== 768) return false;
  let totalDifference = 0;
  let largeDifferences = 0;
  for (let i = 0; i < left.length; i++) {
    const difference = Math.abs(left[i] - right[i]);
    totalDifference += difference;
    if (difference > 20) largeDifferences++;
  }
  return totalDifference / left.length <= 5 && largeDifferences / left.length <= 0.05;
}
