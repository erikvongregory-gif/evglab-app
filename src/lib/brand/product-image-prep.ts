import sharp from "sharp";

/**
 * Sortenfotos für BrewAI aufbereiten („freistellen“):
 * Packshots mit einfarbigem oder transparentem Hintergrund bekommen reines Weiß,
 * werden eng auf die Flasche zugeschnitten und mit gleichmäßigem Rand versehen.
 * Transparente PNGs würden sonst in manchen Bild-Pipelines schwarz hinterlegt.
 * Fotos mit echtem Hintergrund (Szene, Holz, Theke) bleiben inhaltlich unverändert.
 */

const OUTPUT_EDGE = 1200;
/** Farbabstand (RGB, euklidisch), bis zu dem ein Pixel noch als Hintergrund gilt. */
const BG_TOLERANCE = 34;
/** Anteil der Randpixel, die Hintergrundfarbe haben müssen, damit freigestellt wird. */
const UNIFORM_BORDER_SHARE = 0.82;
const PADDING_SHARE = 0.06;

export type PreparedProductImage = {
  buffer: Buffer;
  mime: "image/jpeg";
  /** true = Hintergrund entfernt und zugeschnitten. */
  cutout: boolean;
  width: number;
  height: number;
};

type Rgb = [number, number, number];

function distance(data: Buffer, offset: number, ref: Rgb): number {
  const dr = data[offset]! - ref[0];
  const dg = data[offset + 1]! - ref[1];
  const db = data[offset + 2]! - ref[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/** Häufigste (quantisierte) Randfarbe, gemittelt — robust gegen einzelne Flaschen-Pixel am Rand. */
function dominantBorderColor(data: Buffer, width: number, height: number): { ref: Rgb | null; border: number[] } {
  const border: number[] = [];
  for (let x = 0; x < width; x++) border.push(x, (height - 1) * width + x);
  for (let y = 1; y < height - 1; y++) border.push(y * width, y * width + width - 1);
  const buckets = new Map<number, { count: number; r: number; g: number; b: number }>();
  for (const pixel of border) {
    const offset = pixel * 4;
    if (data[offset + 3]! < 24) continue;
    const key = ((data[offset]! >> 4) << 8) | ((data[offset + 1]! >> 4) << 4) | (data[offset + 2]! >> 4);
    const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    bucket.count += 1;
    bucket.r += data[offset]!;
    bucket.g += data[offset + 1]!;
    bucket.b += data[offset + 2]!;
    buckets.set(key, bucket);
  }
  let best: { count: number; r: number; g: number; b: number } | null = null;
  for (const bucket of buckets.values()) if (!best || bucket.count > best.count) best = bucket;
  return {
    ref: best ? [best.r / best.count, best.g / best.count, best.b / best.count] : null,
    border,
  };
}

async function flattenOnly(input: Buffer): Promise<PreparedProductImage> {
  const { data, info } = await sharp(input, { failOn: "none" })
    .rotate()
    .resize(OUTPUT_EDGE, OUTPUT_EDGE, { fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  return { buffer: data, mime: "image/jpeg", cutout: false, width: info.width, height: info.height };
}

/** Liefert null, wenn die Datei kein lesbares Bild ist. */
export async function prepareProductImage(input: Buffer): Promise<PreparedProductImage | null> {
  let raw: { data: Buffer; info: { width: number; height: number; channels: number } };
  try {
    raw = await sharp(input, { failOn: "none" })
      .rotate()
      .resize(OUTPUT_EDGE, OUTPUT_EDGE, { fit: "inside", withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
  } catch {
    return null;
  }
  const { data, info } = raw;
  const { width, height } = info;
  if (width < 32 || height < 32 || info.channels !== 4) return flattenOnly(input).catch(() => null);

  const { ref, border } = dominantBorderColor(data, width, height);
  const isBackground = (pixel: number) => {
    const offset = pixel * 4;
    if (data[offset + 3]! < 24) return true;
    return ref !== null && distance(data, offset, ref) <= BG_TOLERANCE;
  };
  const borderBackground = border.filter(isBackground).length;
  if (borderBackground / border.length < UNIFORM_BORDER_SHARE) return flattenOnly(input).catch(() => null);

  // Flood-Fill vom Rand: nur zusammenhängender Hintergrund wird entfernt, helle Etiketten-Flächen bleiben.
  const total = width * height;
  const background = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;
  for (const pixel of border) {
    if (!background[pixel] && isBackground(pixel)) {
      background[pixel] = 1;
      queue[tail++] = pixel;
    }
  }
  while (head < tail) {
    const pixel = queue[head++]!;
    const x = pixel % width;
    const neighbours = [x > 0 ? pixel - 1 : -1, x < width - 1 ? pixel + 1 : -1, pixel - width, pixel + width];
    for (const next of neighbours) {
      if (next < 0 || next >= total || background[next]) continue;
      if (isBackground(next)) {
        background[next] = 1;
        queue[tail++] = next;
      }
    }
  }

  const foreground = total - tail;
  if (foreground / total < 0.03 || foreground / total > 0.97) return flattenOnly(input).catch(() => null);

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  const out = Buffer.alloc(total * 3);
  for (let pixel = 0; pixel < total; pixel++) {
    const offset = pixel * 4;
    const target = pixel * 3;
    if (background[pixel]) {
      out[target] = 255;
      out[target + 1] = 255;
      out[target + 2] = 255;
      continue;
    }
    const x = pixel % width;
    const y = (pixel - x) / width;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    // Halbtransparenz auf Weiß; Kantenpixel nahe der alten Hintergrundfarbe weich ausblenden (kein Farbsaum).
    let keep = data[offset + 3]! / 255;
    const touchesBackground =
      (x > 0 && background[pixel - 1]) ||
      (x < width - 1 && background[pixel + 1]) ||
      (pixel >= width && background[pixel - width]) ||
      (pixel + width < total && background[pixel + width]);
    if (touchesBackground && ref) {
      keep *= Math.min(1, Math.max(0, (distance(data, offset, ref) - BG_TOLERANCE) / BG_TOLERANCE));
    }
    for (let channel = 0; channel < 3; channel++) {
      out[target + channel] = Math.round(255 * (1 - keep) + data[offset + channel]! * keep);
    }
  }
  if (maxX < minX || maxY < minY) return flattenOnly(input).catch(() => null);

  const boxWidth = maxX - minX + 1;
  const boxHeight = maxY - minY + 1;
  const pad = Math.max(8, Math.round(Math.max(boxWidth, boxHeight) * PADDING_SHARE));
  const { data: jpeg, info: outInfo } = await sharp(out, { raw: { width, height, channels: 3 } })
    .extract({ left: minX, top: minY, width: boxWidth, height: boxHeight })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: "#ffffff" })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  return { buffer: jpeg, mime: "image/jpeg", cutout: true, width: outInfo.width, height: outInfo.height };
}
