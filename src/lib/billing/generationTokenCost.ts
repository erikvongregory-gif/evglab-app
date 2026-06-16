export type GenerationResolution = "1K" | "2K" | "4K";
export type SeedanceResolution = "480p" | "720p" | "1080p";

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

/** Standard-Video (Seedance 2 · 720p · ~8 s · ohne Audio) — deutlich teurer als Bilder. */
export function calculateSeedanceVideoTokenCost(args: {
  resolution?: SeedanceResolution;
  duration?: number;
  generateAudio?: boolean;
}): number {
  const fromEnv = Number.parseInt(process.env.KIE_SEEDANCE_TOKEN_COST ?? "", 10);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;

  const duration = Math.max(4, Math.min(15, args.duration ?? 8));
  const resolution = args.resolution ?? "720p";
  const base = resolution === "1080p" ? 120 : resolution === "480p" ? 70 : 90;
  const durationFactor = duration > 8 ? Math.ceil((duration - 8) / 2) * 8 : 0;
  const audioFactor = args.generateAudio ? 20 : 0;
  return base + durationFactor + audioFactor;
}

export function formatPlanImageEstimate(monthlyTokens: number): string {
  const min = Math.max(1, Math.floor(monthlyTokens / 35));
  const max = Math.max(min, Math.floor(monthlyTokens / 10));
  return `ca. ${min.toLocaleString("de-DE")}–${max.toLocaleString("de-DE")} Bilder`;
}

export function formatPlanVideoEstimate(monthlyTokens: number): string {
  const standardCost = calculateSeedanceVideoTokenCost({ resolution: "720p", duration: 8 });
  const longCost = calculateSeedanceVideoTokenCost({ resolution: "720p", duration: 12 });
  const maxVideos = Math.max(1, Math.floor(monthlyTokens / standardCost));
  const minVideos = Math.max(1, Math.floor(monthlyTokens / longCost));
  return `ca. ${minVideos.toLocaleString("de-DE")}–${maxVideos.toLocaleString("de-DE")} Videos`;
}
