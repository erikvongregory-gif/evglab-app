/**
 * Kie.ai `gpt-image-2-text-to-image` accepts a limited set of aspect ratios (OpenAPI).
 * @see https://docs.kie.ai/market/gpt/gpt-image-2-text-to-image
 */
export type GptImage2AspectRatio = "auto" | "1:1" | "9:16" | "16:9" | "4:3" | "3:4";

export function mapAspectRatioForGptImage2(aspect: string | undefined): GptImage2AspectRatio {
  const a = (aspect ?? "1:1").trim();
  const table: Record<string, GptImage2AspectRatio> = {
    "1:1": "1:1",
    "3:4": "3:4",
    "4:5": "3:4",
    "9:16": "9:16",
    "16:9": "16:9",
    "4:3": "4:3",
    "3:2": "4:3",
    "2:3": "3:4",
    "5:4": "4:3",
    "21:9": "16:9",
    auto: "auto",
  };
  return table[a] ?? "3:4";
}

/**
 * 1:1 cannot be 4K; aspect "auto" only supports 1K (per Kie docs).
 */
export function normalizeResolutionForGptImage2(
  resolution: "1K" | "2K" | "4K" | undefined,
  mappedAspect: GptImage2AspectRatio,
): "1K" | "2K" | "4K" {
  const r = resolution ?? "1K";
  if (mappedAspect === "1:1" && r === "4K") return "2K";
  if (mappedAspect === "auto" && r !== "1K") return "1K";
  return r;
}
