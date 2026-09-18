import { signStoragePath } from "./privateAssets";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = process.env.SUPABASE_GENERATED_IMAGES_BUCKET?.trim() || "generated-images";
/** Kachel-Vorschaubilder: max. Kantenlänge, WebP. */
const THUMB_MAX_EDGE = 512;

export async function uploadUserImageToStorage(args: {
  userId: string;
  buffer: Buffer;
  mime: string;
  folder: string;
}): Promise<string> {
  const mime = args.mime.toLowerCase();
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  const contentType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  const path = `${args.folder}/${args.userId}/${Date.now()}-${randomUUID()}.${ext}`;

  const admin = createAdminClient();
  const { error } = await admin.storage.from(BUCKET).upload(path, args.buffer, {
    contentType,
    cacheControl: "3600",
    upsert: false,
  });
  if (error) {
    throw new Error(`Bild-Upload zu Supabase Storage fehlgeschlagen: ${error.message}`);
  }

  return signStoragePath(path);
}

export async function makeWebpThumb(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize(THUMB_MAX_EDGE, THUMB_MAX_EDGE, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 72 })
    .toBuffer();
}

/**
 * Lädt ein generiertes Bild in den privaten Bucket
 * und gibt eine kurzlebige signierte URL zurück. Ersetzt den frueheren Kie-Datei-Upload.
 */
export async function uploadGeneratedImageToStorage(args: {
  userId: string;
  buffer: Buffer;
  outputFormat: "png" | "jpg";
}): Promise<string> {
  return uploadUserImageToStorage({
    userId: args.userId,
    buffer: args.buffer,
    mime: args.outputFormat === "jpg" ? "image/jpeg" : "image/png",
    folder: "generated",
  });
}

/** Original + kleines WebP-Thumb (für Mediathek-Kacheln). Thumb-Fehler lässt das Original durch. */
export async function uploadGeneratedImageWithThumb(args: {
  userId: string;
  buffer: Buffer;
  outputFormat: "png" | "jpg";
}): Promise<{ imageUrl: string; thumbUrl?: string }> {
  const imageUrl = await uploadGeneratedImageToStorage(args);
  try {
    const thumbUrl = await uploadUserImageToStorage({
      userId: args.userId,
      buffer: await makeWebpThumb(args.buffer),
      mime: "image/webp",
      folder: "generated-thumbs",
    });
    return { imageUrl, thumbUrl };
  } catch (error) {
    console.warn("[uploadGeneratedImageWithThumb] thumb failed:", error);
    return { imageUrl };
  }
}

const FONT_MIME: Record<string, string> = {
  woff2: "font/woff2",
  woff: "font/woff",
  ttf: "font/ttf",
  otf: "font/otf",
};

const AVATAR_EDGE = 256;

/** Quadratisches WebP-Profilbild im privaten Bucket. */
export async function uploadProfileAvatarToStorage(args: {
  userId: string;
  buffer: Buffer;
}): Promise<string> {
  const webp = await sharp(args.buffer)
    .rotate()
    .resize(AVATAR_EDGE, AVATAR_EDGE, { fit: "cover", position: "centre" })
    .webp({ quality: 82 })
    .toBuffer();

  return uploadUserImageToStorage({
    userId: args.userId,
    buffer: webp,
    mime: "image/webp",
    folder: "avatars",
  });
}

/** Speichert eine Marken-Schriftdatei im privaten Markenprofil. */
export async function uploadBrandFontToStorage(args: {
  userId: string;
  buffer: Buffer;
  ext: "woff2" | "woff" | "ttf" | "otf";
}): Promise<string> {
  const contentType = FONT_MIME[args.ext] ?? "application/octet-stream";
  const path = `brand-fonts/${args.userId}/${Date.now()}-${randomUUID()}.${args.ext}`;

  const admin = createAdminClient();
  const { error } = await admin.storage.from(BUCKET).upload(path, args.buffer, {
    contentType,
    cacheControl: "3600",
    upsert: false,
  });
  if (error) {
    throw new Error(`Schrift-Upload fehlgeschlagen: ${error.message}`);
  }

  return signStoragePath(path);
}
