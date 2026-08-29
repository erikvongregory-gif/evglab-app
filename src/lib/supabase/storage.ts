import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = process.env.SUPABASE_GENERATED_IMAGES_BUCKET?.trim() || "generated-images";
const PUBLIC_PROBE_TIMEOUT_MS = 4_000;

/** Definitive "not publicly readable" statuses — safe to treat as config/contract failure. */
const DEFINITIVE_PUBLIC_DENY = new Set([400, 401, 403, 404]);

async function assertPublicUrlReachable(publicUrl: string): Promise<{ ok: true } | { ok: false; status: number; definitive: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PUBLIC_PROBE_TIMEOUT_MS);
  try {
    let res = await fetch(publicUrl, {
      method: "HEAD",
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
    });

    // Some CDNs/Storage stacks reject HEAD — fall back to a ranged GET and cancel the body.
    if (res.status === 405 || res.status === 501) {
      res = await fetch(publicUrl, {
        method: "GET",
        cache: "no-store",
        redirect: "follow",
        signal: controller.signal,
        headers: { Range: "bytes=0-0" },
      });
      try {
        await res.body?.cancel();
      } catch {
        /* ignore */
      }
    }

    if (res.ok || res.status === 206) return { ok: true };
    return {
      ok: false,
      status: res.status,
      definitive: DEFINITIVE_PUBLIC_DENY.has(res.status),
    };
  } catch {
    // Timeout / network — do not treat as proof the object must be deleted.
    return { ok: false, status: 0, definitive: false };
  } finally {
    clearTimeout(timer);
  }
}

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
    await admin.storage.from(BUCKET).remove([path]).catch(() => undefined);
    throw new Error("Supabase Storage lieferte keine oeffentliche URL.");
  }

  // getPublicUrl only constructs a URL. Probe public readability so callers never
  // persist a broken public URL (e.g. private bucket while product expects public).
  const probe = await assertPublicUrlReachable(data.publicUrl);
  if (!probe.ok) {
    // Only delete on definitive public-access denial. Transient/network failures
    // leave the object (orphan) rather than racing CDN visibility.
    if (probe.definitive) {
      await admin.storage.from(BUCKET).remove([path]).catch(() => undefined);
    }
    throw new Error(
      `Oeffentliche Bild-URL nicht erreichbar (HTTP ${probe.status || "timeout"}). Bucket „${BUCKET}“ muss oeffentlich sein.`,
    );
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
