import type { DashboardMediaItem } from "@/lib/dashboard/metadata";
import { writeDashboardMedia } from "@/lib/dashboard/media-store";

/** Speichert fertige Generierungen serverseitig in der Mediathek (Upsert, idempotent). */
export async function persistGeneratedMediaItems(input: {
  userId: string;
  jobId: string;
  images: string[];
  title: string;
  prompt: string;
  aspectRatio: string;
  resolution: "1K" | "2K" | "4K";
  outputFormat: "png" | "jpg";
}): Promise<DashboardMediaItem[]> {
  if (!input.images.length) return [];
  const createdAt = new Date().toISOString();
  const title = input.title.trim().slice(0, 120) || "Motiv";
  const prompt = input.prompt.trim().slice(0, 240) || title;
  const items: DashboardMediaItem[] = input.images.map((imageUrl, index) => ({
    id: `gen-${input.jobId}-${index}`,
    imageUrl,
    title,
    prompt,
    createdAt,
    aspectRatio: input.aspectRatio,
    resolution: input.resolution,
    outputFormat: input.outputFormat,
  }));
  try {
    await writeDashboardMedia(input.userId, items);
    return items;
  } catch (error) {
    console.warn("[persistGeneratedMediaItems] failed:", error);
    return [];
  }
}
