import type { VideoPresetId } from "@/lib/video-studio/options";
import { calculateSeedanceVideoTokenCost } from "@/lib/billing/generationTokenCost";

export const KIE_SEEDANCE_MODEL =
  process.env.KIE_SEEDANCE_MODEL?.trim() || "bytedance/seedance-2";

export type SeedanceAspectRatio = "1:1" | "9:16" | "16:9" | "4:3" | "3:4" | "21:9" | "adaptive";
export type SeedanceResolution = "480p" | "720p" | "1080p";

export function mapAspectRatioForSeedance(aspectRatio?: string): SeedanceAspectRatio {
  if (aspectRatio === "9:16" || aspectRatio === "1:1" || aspectRatio === "16:9") {
    return aspectRatio;
  }
  return "9:16";
}

export function durationForPreset(presetId?: VideoPresetId): number {
  switch (presetId) {
    case "tutorial":
    case "tv_spot":
      return 12;
    case "review":
      return 10;
    case "unboxing":
      return 8;
    default:
      return 8;
  }
}

export { calculateSeedanceVideoTokenCost };
