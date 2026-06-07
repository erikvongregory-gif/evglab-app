import {
  createBrandReferenceUrlResolver,
  isLegacyKieTempUrl,
} from "@/lib/brand/reference-image-store";

export type VisionReferenceImage = { base64: string; mime: string };

const CLAUDE_VISION_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

function detectMimeFromBuffer(buf: Buffer): string {
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return "image/png";
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  if (
    buf.length >= 6 &&
    (buf.toString("ascii", 0, 6) === "GIF87a" || buf.toString("ascii", 0, 6) === "GIF89a")
  ) {
    return "image/gif";
  }
  return "image/png";
}

function normalizeMime(mime: string): string {
  const lower = mime.toLowerCase().trim();
  if (lower === "image/jpg") return "image/jpeg";
  return lower;
}

/**
 * Resolves any reference-image string the dashboard might send (data: URL,
 * internal /api/brand/reference-image/<id>, external https) to a base64+mime
 * pair that can be inlined into Claude vision messages.
 *
 * Returns null when the URL cannot be resolved or the resulting mime is not
 * supported by Claude (vision currently accepts png/jpeg/webp/gif).
 */
export async function resolveReferenceImageForVision(
  rawUrl: string,
  userMetadata: unknown,
): Promise<VisionReferenceImage | null> {
  if (!rawUrl) return null;

  if (rawUrl.startsWith("data:")) {
    const match = rawUrl.match(/^data:([^;]+);base64,(.*)$/);
    if (!match) return null;
    const mime = normalizeMime(match[1] || "image/png");
    if (!CLAUDE_VISION_MIMES.has(mime)) return null;
    const base64 = match[2] || "";
    if (!base64) return null;
    return { mime, base64 };
  }

  const resolver = createBrandReferenceUrlResolver(userMetadata);
  const buffer = await resolver(rawUrl, 0).catch(() => null);
  if (buffer && buffer.byteLength > 0) {
    const mime = normalizeMime(detectMimeFromBuffer(buffer));
    if (!CLAUDE_VISION_MIMES.has(mime)) return null;
    return { mime, base64: buffer.toString("base64") };
  }

  if (/^https?:\/\//i.test(rawUrl) && !isLegacyKieTempUrl(rawUrl)) {
    try {
      const res = await fetch(rawUrl, { cache: "no-store" });
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.byteLength === 0) return null;
      const headerMime = (res.headers.get("content-type") ?? "")
        .split(";")[0]
        ?.trim()
        .toLowerCase();
      const mime = normalizeMime(
        headerMime && headerMime.startsWith("image/") ? headerMime : detectMimeFromBuffer(buf),
      );
      if (!CLAUDE_VISION_MIMES.has(mime)) return null;
      return { mime, base64: buf.toString("base64") };
    } catch {
      return null;
    }
  }

  return null;
}
