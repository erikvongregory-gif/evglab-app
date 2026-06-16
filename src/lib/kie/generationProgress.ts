/** Typische Obergrenze bis ein Bild-Task fertig ist (UI-Fortschritt, wenn Kie kein % liefert). */
export const GENERATION_PROGRESS_MAX_WAIT_MS = 180_000;
export const VIDEO_GENERATION_PROGRESS_MAX_WAIT_MS = 8 * 60 * 1000;

export function parseUpstreamProgress(payload: Record<string, unknown>, state: string): number | null {
  const candidates = [payload.progress, payload.percent, payload.completePercent, payload.completion];
  for (const value of candidates) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.max(0, Math.min(100, Math.round(value)));
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number.parseFloat(value);
      if (Number.isFinite(parsed)) return Math.max(0, Math.min(100, Math.round(parsed)));
    }
  }

  const normalized = state.toLowerCase();
  if (["success", "succeeded", "completed", "done"].includes(normalized)) return 100;
  if (["waiting", "pending", "queue", "queued", "submitted"].includes(normalized)) return 12;
  if (["running", "processing", "generating", "in_progress", "inprogress"].includes(normalized)) return null;
  return null;
}

/** Fortschritt: Kie-Wert wenn vorhanden, sonst zeitbasierte Schätzung (monoton, max. 95 % bis fertig). */
export function estimateGenerationProgress(
  elapsedMs: number,
  upstreamProgress?: number | null,
  maxWaitMs: number = GENERATION_PROGRESS_MAX_WAIT_MS,
): number {
  if (typeof upstreamProgress === "number" && Number.isFinite(upstreamProgress)) {
    if (upstreamProgress >= 100) return 100;
    return Math.max(10, Math.min(95, upstreamProgress));
  }
  return Math.min(
    95,
    10 + Math.round((Math.min(Math.max(elapsedMs, 0), maxWaitMs) / maxWaitMs) * 85),
  );
}
