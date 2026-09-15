export type OpenAiImageSize = "1024x1024" | "1024x1536" | "1536x1024";

export type StudioAspectRatio = "1:1" | "4:5" | "3:4" | "9:16" | "4:3" | "16:9";

/** OpenAI GPT-Image unterstützt nur diese drei Native-Groessen. */
export function mapAspectRatioToOpenAiSize(aspectRatio: string | undefined): OpenAiImageSize {
  if (!aspectRatio) return "1024x1024";
  if (["9:16", "4:5", "3:4", "2:3"].includes(aspectRatio)) return "1024x1536";
  if (["16:9", "21:9", "3:2", "4:3", "5:4"].includes(aspectRatio)) return "1536x1024";
  return "1024x1024";
}

function parseAspectRatioValue(aspectRatio: string): number {
  const [w, h] = aspectRatio.split(":").map(Number);
  if (!w || !h) return 1;
  return w / h;
}

function parseOpenAiSize(size: OpenAiImageSize): { width: number; height: number } {
  const [width, height] = size.split("x").map(Number);
  return { width, height };
}

/** Ziel-Ausgabepixel nach Center-Crop aus der OpenAI-Native-Groesse. */
export function aspectRatioToOutputDimensions(aspectRatio: string): { width: number; height: number } {
  const target = parseAspectRatioValue(aspectRatio);
  const source = parseOpenAiSize(mapAspectRatioToOpenAiSize(aspectRatio));
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

export function aspectRatioToCropRect(aspectRatio: string): {
  left: number;
  top: number;
  width: number;
  height: number;
} {
  const source = parseOpenAiSize(mapAspectRatioToOpenAiSize(aspectRatio));
  const output = aspectRatioToOutputDimensions(aspectRatio);
  return {
    left: Math.max(0, Math.round((source.width - output.width) / 2)),
    top: Math.max(0, Math.round((source.height - output.height) / 2)),
    width: output.width,
    height: output.height,
  };
}
