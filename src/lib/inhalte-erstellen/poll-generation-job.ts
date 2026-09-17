import type { Aspect, GenerationSnapshot } from "./studio-config";

export type PolledJobResult = {
  images?: { imageUrl: string }[];
  backgroundImages?: { imageUrl: string }[];
  snapshot?: GenerationSnapshot;
  error?: string;
  billing?: { remainingTokens?: number };
  aspectRatio?: Aspect;
  resolution?: "1K" | "2K" | "4K";
  overlay?: { headline?: string; subline?: string; ctaText?: string };
  partial?: boolean;
  expectedVariants?: number;
  completedVariants?: number;
  partialErrors?: string[];
  mediaPersisted?: boolean;
  phase?: string;
  jobId?: string;
  status?: string;
  connectionIssue?: boolean;
  pending?: boolean;
};

export function jobProgressMessage(input: {
  phase?: string;
  status?: string;
  completed?: number;
  expected?: number;
  connectionIssue?: boolean;
}) {
  if (input.connectionIssue) return "Verbindung unterbrochen — Status wird erneut geprüft";
  const phase = input.phase || (input.status === "reserved" ? "generating" : "");
  const completed = input.completed ?? 0;
  const expected = input.expected ?? 0;
  if (phase === "queued") return "Auftrag bestätigt — Motiv wird vorbereitet";
  if (phase === "generating") {
    return completed > 0 && expected > 0 ? `${completed} von ${expected} Varianten fertig` : "Motiv wird erzeugt";
  }
  if (phase === "persisting") return "Wird in der Mediathek gespeichert";
  if (phase === "failed" || input.status === "failed") return "Generierung fehlgeschlagen";
  if (phase === "partial") return "Teilweise erstellt";
  if (phase === "completed" || input.status === "completed") return "Fertig";
  return "BrewAI arbeitet am Motiv";
}

export async function pollGenerationJob(args: {
  jobId: string;
  expectedVariants: number;
  onProgress?: (message: string, result: PolledJobResult) => void;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  signal?: AbortSignal;
}): Promise<PolledJobResult> {
  const now = args.now ?? Date.now;
  const sleep = args.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const deadline = now() + 4 * 60_000;
  let lastPartial: PolledJobResult | null = null;
  let attempt = 0;
  while (true) {
    if (args.signal?.aborted) return { ...lastPartial, jobId: args.jobId, pending: true };
    attempt += 1;
    let res: Response;
    try {
      res = await fetch(`/api/dashboard/jobs?id=${encodeURIComponent(args.jobId)}`, {
        credentials: "include",
        cache: "no-store",
        signal: args.signal,
      });
    } catch (error) {
      if (args.signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) {
        return { ...lastPartial, jobId: args.jobId, pending: true };
      }
      const connection = { jobId: args.jobId, connectionIssue: true, pending: true, ...lastPartial };
      args.onProgress?.(jobProgressMessage({ connectionIssue: true }), connection);
      if (now() >= deadline) return { ...connection, pending: true };
      await sleep(Math.min(2000 + attempt * 400, 7000));
      continue;
    }
    if (res.status === 404) return { error: "Auftrag nicht gefunden.", jobId: args.jobId };
    if (res.status === 401 || res.status === 403) {
      return { error: "Bitte erneut anmelden, um den Auftragsstatus zu sehen.", jobId: args.jobId };
    }
    if (!res.ok) {
      const connection = { jobId: args.jobId, connectionIssue: true, pending: true, ...lastPartial };
      args.onProgress?.(jobProgressMessage({ connectionIssue: true }), connection);
      if (now() >= deadline) return { ...connection, pending: true };
      await sleep(Math.min(2000 + attempt * 400, 7000));
      continue;
    }
    const json = (await res.json()) as { job?: { status?: string; result?: Record<string, unknown> | null } };
    const status = json.job?.status;
    const result = (json.job?.result ?? {}) as PolledJobResult;
    const completed = result.completedVariants ?? result.images?.length ?? 0;
    const expected = result.expectedVariants ?? args.expectedVariants;
    const phase = result.phase || (status === "reserved" ? "generating" : "");
    const next: PolledJobResult = { ...result, jobId: args.jobId, status };
    args.onProgress?.(jobProgressMessage({ phase, status, completed, expected }), next);
    if (result.images?.length) lastPartial = next;
    if (status === "completed" && result.images?.length) return next;
    if (status === "failed") return { ...next, error: result.error || "Auftrag fehlgeschlagen." };
    if (now() >= deadline) {
      if (lastPartial?.images?.length) {
        return { ...lastPartial, partial: true, pending: true, jobId: args.jobId };
      }
      return { jobId: args.jobId, pending: true };
    }
    await sleep(Math.min(2000 + attempt * 400, 7000));
  }
}
