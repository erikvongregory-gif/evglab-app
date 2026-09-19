export type OpenAiImageSize = string;
export type ImageOutputResolution = "1K" | "2K" | "4K";

export type StudioAspectRatio = "1:1" | "4:5" | "3:4" | "9:16" | "4:3" | "16:9";

const MAX_EDGE = 3824;
const MAX_PIXELS = 8_294_400;

function snap16(n: number): number {
  return Math.max(16, Math.round(n / 16) * 16);
}

function parseAspectRatioValue(aspectRatio: string): number {
  const [w, h] = aspectRatio.split(":").map(Number);
  if (!w || !h) return 1;
  return w / h;
}

function parseSize(size: string): { width: number; height: number } {
  const [width, height] = size.split("x").map(Number);
  return { width: width || 1024, height: height || 1024 };
}

/** Long edge for custom gpt-image-2 sizes (2K/4K). 1K keeps the classic three natives. */
function longEdgeForResolution(resolution: ImageOutputResolution): number {
  return resolution === "4K" ? MAX_EDGE : 2560;
}

function sizeForLongEdge(aspectRatio: string, longEdge: number): OpenAiImageSize {
  const ratio = parseAspectRatioValue(aspectRatio);
  let width: number;
  let height: number;
  if (ratio >= 1) {
    width = Math.min(longEdge, MAX_EDGE);
    height = width / ratio;
  } else {
    height = Math.min(longEdge, MAX_EDGE);
    width = height * ratio;
  }
  const scale = Math.min(1, Math.sqrt(MAX_PIXELS / (width * height)));
  width = snap16(Math.min(width * scale, MAX_EDGE));
  height = snap16(Math.min(height * scale, MAX_EDGE));
  while (width * height > MAX_PIXELS) {
    if (width >= height) width -= 16;
    else height -= 16;
  }
  return `${Math.max(16, width)}x${Math.max(16, height)}`;
}

/**
 * OpenAI-Größe für die Images API.
 * 1K: klassische Native-Größen (~1024). 2K/4K: Custom-Size an Aspect (gpt-image-2).
 */
export function mapAspectRatioToOpenAiSize(
  aspectRatio: string | undefined,
  resolution: ImageOutputResolution = "1K",
): OpenAiImageSize {
  if (resolution === "2K" || resolution === "4K") {
    return sizeForLongEdge(aspectRatio ?? "1:1", longEdgeForResolution(resolution));
  }
  if (!aspectRatio) return "1024x1024";
  if (["9:16", "4:5", "3:4", "2:3"].includes(aspectRatio)) return "1024x1536";
  if (["16:9", "21:9", "3:2", "4:3", "5:4"].includes(aspectRatio)) return "1536x1024";
  return "1024x1024";
}

/** Ziel-Ausgabepixel nach Center-Crop aus der Generierungsgröße. */
export function aspectRatioToOutputDimensions(
  aspectRatio: string,
  resolution: ImageOutputResolution = "1K",
): { width: number; height: number } {
  const target = parseAspectRatioValue(aspectRatio);
  const source = parseSize(mapAspectRatioToOpenAiSize(aspectRatio, resolution));
  const sourceRatio = source.width / source.height;

  if (Math.abs(sourceRatio - target) < 0.001) {
    return source;
  }

  if (sourceRatio > target) {
    const height = source.height;
    const width = Math.round(height * target);
    return { width, height };
  }

  const width = source.width;
  const height = Math.round(width / target);
  return { width, height };
}

export function aspectRatioToCropRect(
  aspectRatio: string,
  resolution: ImageOutputResolution = "1K",
): {
  left: number;
  top: number;
  width: number;
  height: number;
} {
  const source = parseSize(mapAspectRatioToOpenAiSize(aspectRatio, resolution));
  const output = aspectRatioToOutputDimensions(aspectRatio, resolution);
  return {
    left: Math.max(0, Math.round((source.width - output.width) / 2)),
    top: Math.max(0, Math.round((source.height - output.height) / 2)),
    width: output.width,
    height: output.height,
  };
}
