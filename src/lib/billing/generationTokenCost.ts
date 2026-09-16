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

/**
 * Gleiche Qualitäts→Abrechnungs-Auflösung wie create-task / social-post.
 * Env überschreibt; sonst Produktfoto ⇒ high; sonst Compiler/Request-Qualität.
 */
export function resolveImageBillingResolution(args: {
  hasProductPhoto: boolean;
  qualityEnv?: string | null;
  compiledOrRequestedQuality?: "low" | "medium" | "high" | null;
}): "1K" | "2K" {
  const env = args.qualityEnv?.trim().toLowerCase();
  const openAiQuality: "low" | "medium" | "high" =
    env === "low" || env === "medium" || env === "high"
      ? env
      : args.hasProductPhoto
        ? "high"
        : args.compiledOrRequestedQuality === "high"
          ? "high"
          : "medium";
  return openAiQuality === "high" ? "2K" : "1K";
}

/**
 * Client-Vorschau der create-task / social-post Kosten.
 * Für OPENAI_IMAGE_QUALITY die öffentliche Spiegel-Variable NEXT_PUBLIC_OPENAI_IMAGE_QUALITY setzen.
 */
export function estimateStudioImageTokenCost(args: {
  /** Produktfoto wird tatsächlich als Image-1-Referenz genutzt (Markenmodus). */
  usesProductPhoto: boolean;
  extraReferenceCount?: number;
  /** Form-Referenz ohne Produktfoto (Flaschen-Silhouette). */
  hasShapeReference?: boolean;
  etikettModus: "marke" | "generisch";
  variantCount?: number;
  /** Request-/Compiler-Qualität (ohne Env-Override). */
  requestedQuality?: "low" | "medium" | "high" | null;
  /** Optional explizites Env; sonst NEXT_PUBLIC_OPENAI_IMAGE_QUALITY. */
  qualityEnv?: string | null;
}): number {
  const qualityEnv =
    args.qualityEnv ??
    (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_OPENAI_IMAGE_QUALITY : undefined);
  const resolution = resolveImageBillingResolution({
    hasProductPhoto: args.usesProductPhoto,
    qualityEnv,
    compiledOrRequestedQuality: args.requestedQuality,
  });
  const hasReferenceImage =
    args.usesProductPhoto ||
    (args.extraReferenceCount ?? 0) > 0 ||
    Boolean(args.hasShapeReference);
  const strictLabelMode = args.etikettModus === "marke" && args.usesProductPhoto;
  return calculateGenerationTokenCost({
    resolution,
    hasReferenceImage,
    strictLabelMode,
    variantCount: args.variantCount,
  });
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