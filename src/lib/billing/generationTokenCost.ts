export type GenerationResolution = "1K" | "2K" | "4K";

/** Token-Kosten pro einzelner Generierung (gleiche Logik wie Legacy-Kie/OpenAI-Routen). */
export function calculatePerVariantTokenCost(args: {
  resolution: GenerationResolution;
  hasReferenceImage?: boolean;
  strictLabelMode?: boolean;
}): number {
  const base = args.resolution === "4K" ? 35 : args.resolution === "2K" ? 20 : 10;
  return base + (args.hasReferenceImage ? 5 : 0) + (args.strictLabelMode ? 10 : 0);
}

export function calculateGenerationTokenCost(args: {
  resolution: GenerationResolution;
  hasReferenceImage?: boolean;
  strictLabelMode?: boolean;
  variantCount?: number;
}): number {
  const count = Math.max(1, args.variantCount ?? 1);
  return calculatePerVariantTokenCost(args) * count;
}
