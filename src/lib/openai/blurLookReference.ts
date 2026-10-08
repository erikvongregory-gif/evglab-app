import sharp from "sharp";

/** Starker Weichzeichner für fremde Fotos: echte Gesichter und Marken dürfen nicht durchkommen. */
export const STRONG_LOOK_BLUR = 22;
/** Leichter Weichzeichner für eigene KI-Referenzen: Blitz, Raum und Ausschnitt bleiben lesbar. */
export const LIGHT_LOOK_BLUR = 4;
/** Gesichter in leicht weichgezeichneten Referenzen: so stark, dass das Modell keine Person übernehmen kann. */
export const FACE_BLUR = 48;

/** Gesichtsbereich in Prozent des Bildes: [links, oben, rechts, unten]. */
export type FaceBox = readonly [number, number, number, number];

/** Weiche Oval-Maske — harte Kästen würde das Modell als graue Zensurbalken ins Bild übernehmen. */
function faceMaskSvg(width: number, height: number, faces: readonly FaceBox[]): Buffer {
  const feather = Math.round(Math.min(width, height) * 0.025);
  const ellipses = faces
    .map(([x0, y0, x1, y1]) => {
      const cx = (((x0 + x1) / 2) / 100) * width;
      const cy = (((y0 + y1) / 2) / 100) * height;
      const rx = (((x1 - x0) / 2) / 100) * width;
      const ry = (((y1 - y0) / 2) / 100) * height;
      return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="white"/>`;
    })
    .join("");
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<defs><filter id="f"><feGaussianBlur stdDeviation="${feather}"/></filter></defs>` +
      `<rect width="100%" height="100%" fill="black"/><g filter="url(#f)">${ellipses}</g></svg>`,
  );
}

/**
 * Look-Bilder auf 768 px verkleinern und weichzeichnen — übrig bleiben Licht, Ausschnitt und Energie.
 * `faces` werden zusätzlich stark verwischt: Bei leichtem Weichzeichner kopierte das Modell sonst
 * dieselben Gesichter in jedes Kundenbild.
 */
export async function blurLookReference(
  raw: Buffer,
  sigma = STRONG_LOOK_BLUR,
  faces: readonly FaceBox[] = [],
): Promise<Buffer | null> {
  if (!raw.byteLength) return null;
  const resized = await sharp(raw)
    .rotate()
    .resize({ width: 768, height: 768, fit: "inside" })
    .removeAlpha()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = resized.info;
  const base = sigma > 0 ? await sharp(resized.data).blur(sigma).toBuffer() : resized.data;
  if (!faces.length) return sharp(base).jpeg({ quality: 80 }).toBuffer();

  const mask = await sharp(faceMaskSvg(width, height, faces)).resize(width, height).greyscale().toColourspace("b-w").raw().toBuffer();
  const smeared = await sharp(base)
    .blur(FACE_BLUR)
    .joinChannel(mask, { raw: { width, height, channels: 1 } })
    .png()
    .toBuffer();
  return sharp(base).composite([{ input: smeared }]).jpeg({ quality: 80 }).toBuffer();
}
