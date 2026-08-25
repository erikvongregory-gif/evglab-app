import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = process.env.SUPABASE_GENERATED_IMAGES_BUCKET?.trim() || "generated-images";

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
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) {
    throw new Error(`Bild-Upload zu Supabase Storage fehlgeschlagen: ${error.message}`);
  }

  const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) {
    throw new Error("Supabase Storage lieferte keine oeffentliche URL.");
  }
  return data.publicUrl;
}

/**
 * Laedt ein generiertes Bild (Buffer) in den oeffentlichen Supabase-Storage-Bucket
 * und gibt die oeffentliche URL zurueck. Ersetzt den frueheren Kie-Datei-Upload.
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
