import type { DashboardMediaItem } from "@/lib/dashboard/metadata";
import { writeDashboardMedia } from "@/lib/dashboard/media-store";

/** Speichert fertige Generierungen serverseitig in der Mediathek (Upsert, idempotent). */
export async function persistGeneratedMediaItems(input: {
  userId: string;
  jobId: string;
  images: string[];
  /** Parallel zu images; fehlende Einträge = kein Thumb. */
  thumbs?: Array<string | undefined>;
  title: string;
  prompt: string;
  aspectRatio: string;
  resolution: "1K" | "2K" | "4K";
  outputFormat: "png" | "jpg";
  photoStyle?: DashboardMediaItem["photoStyle"];
  beerName?: string;
  beerId?: string;
}): Promise<DashboardMediaItem[]> {
  if (!input.images.length) return [];
  const createdAt = new Date().toISOString();
  const title = input.title.trim().slice(0, 120) || "Motiv";
  const prompt = input.prompt.trim().slice(0, 240) || title;
  const beerName = input.beerName?.trim().slice(0, 80) || undefined;
  const beerId = input.beerId?.trim().slice(0, 64) || undefined;
  const items: DashboardMediaItem[] = input.images.map((imageUrl, index) => {
    const thumbUrl = input.thumbs?.[index]?.trim() || undefined;
    return {
      id: `gen-${input.jobId}-${index}`,
      imageUrl,
      ...(thumbUrl ? { thumbUrl } : {}),
      title,
      prompt,
      createdAt,
      aspectRatio: input.aspectRatio,
      resolution: input.resolution,
      outputFormat: input.outputFormat,
      ...(input.photoStyle ? { photoStyle: input.photoStyle } : {}),
      ...(beerName ? { beerName } : {}),
      ...(beerId ? { beerId } : {}),
    };
  });
  try {
    await writeDashboardMedia(input.userId, items);
    return items;
  } catch (error) {
    console.warn("[persistGeneratedMediaItems] failed:", error);
    return [];
  }
}
