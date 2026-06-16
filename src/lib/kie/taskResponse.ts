const VIDEO_EXTENSIONS = [".mp4", ".mov", ".webm", ".m4v"];
const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"];

export type KieMediaKind = "video" | "image" | "unknown";

function mediaKindFromUrl(url: string): KieMediaKind {
  const lower = url.toLowerCase().split("?")[0] ?? url;
  if (VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext))) return "video";
  if (IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext))) return "image";
  return "unknown";
}

export function findFirstUrl(input: unknown): string | null {
  if (typeof input === "string" && /^https?:\/\//i.test(input)) return input;
  if (Array.isArray(input)) {
    for (const item of input) {
      const found = findFirstUrl(item);
      if (found) return found;
    }
    return null;
  }
  if (input && typeof input === "object") {
    const record = input as Record<string, unknown>;
    const preferredKeys = ["resultUrls", "videoUrls", "videoUrl", "outputUrl", "url", "fileUrl", "downloadUrl"];
    for (const key of preferredKeys) {
      const found = findFirstUrl(record[key]);
      if (found) return found;
    }
    for (const value of Object.values(record)) {
      const found = findFirstUrl(value);
      if (found) return found;
    }
  }
  return null;
}

export function extractTaskId(input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  const direct =
    (record.taskId as string | undefined) ||
    (record.recordId as string | undefined) ||
    (record.id as string | undefined);
  if (direct && typeof direct === "string") return direct;
  for (const value of Object.values(record)) {
    const nested = extractTaskId(value);
    if (nested) return nested;
  }
  return null;
}

export function extractTaskMedia(payload: Record<string, unknown>, root?: Record<string, unknown>): {
  mediaUrl: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  mediaKind: KieMediaKind | null;
} {
  let mediaUrl = findFirstUrl(root) ?? findFirstUrl(payload);

  if (!mediaUrl && typeof payload.resultJson === "string") {
    try {
      mediaUrl = findFirstUrl(JSON.parse(payload.resultJson) as unknown);
    } catch {
      // ignore
    }
  }

  if (!mediaUrl) {
    return { mediaUrl: null, imageUrl: null, videoUrl: null, mediaKind: null };
  }

  const kind = mediaKindFromUrl(mediaUrl);
  return {
    mediaUrl,
    imageUrl: kind === "image" ? mediaUrl : null,
    videoUrl: kind === "video" ? mediaUrl : kind === "unknown" ? mediaUrl : null,
    mediaKind: kind === "unknown" ? "video" : kind,
  };
}
