import type { GenerationStatus, StatusResult } from "./types";

const TERMINAL = new Set(["completed", "failed", "nsfw", "canceled"]);

export const POLL_INTERVAL_MS = 4000;
export const POLL_DEADLINE_MS = 10 * 60_000;
const MAX_MISSES = 3;

type Waiter = {
  deadline: number;
  resolve: (status: GenerationStatus) => void;
  reject: (reason: Error) => void;
};

const waiting = new Map<string, Waiter>();
const inflight = new Map<string, Promise<GenerationStatus>>();
let timer: ReturnType<typeof setTimeout> | null = null;
let polling = false;
let misses = 0;

async function fetchStatuses(requestIds: string[]): Promise<StatusResult[]> {
  const res = await fetch("/api/generation/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ requestIds }),
  });
  const data = (await res.json()) as { results?: StatusResult[]; error?: string };
  if (!res.ok) throw new Error(data.error ?? "Statusabfrage fehlgeschlagen.");
  return data.results ?? [];
}

/** Resolves when ModelArk reports a terminal status. Batches all in-flight ids. */
export function watchRequest(
  requestId: string,
  opts?: { deadline?: number },
): Promise<GenerationStatus> {
  const existing = inflight.get(requestId);
  if (existing) return existing;
  const promise = new Promise<GenerationStatus>((resolve, reject) => {
    waiting.set(requestId, {
      deadline: opts?.deadline ?? Date.now() + POLL_DEADLINE_MS,
      resolve: (status) => {
        inflight.delete(requestId);
        resolve(status);
      },
      reject: (reason) => {
        inflight.delete(requestId);
        reject(reason);
      },
    });
    schedule();
  });
  inflight.set(requestId, promise);
  return promise;
}

export function stopWatching(): void {
  if (timer !== null) clearTimeout(timer);
  timer = null;
  misses = 0;
  waiting.clear();
  inflight.clear();
}

function schedule(): void {
  if (timer !== null || polling || waiting.size === 0) return;
  timer = setTimeout(() => void round(), POLL_INTERVAL_MS);
}

async function round(): Promise<void> {
  timer = null;
  polling = true;
  try {
    const results = await fetchStatuses([...waiting.keys()]);
    misses = 0;
    for (const result of results) deliver(result);
    sweep();
  } catch (caught) {
    if (++misses < MAX_MISSES) return;
    settleAll(caught instanceof Error ? caught : new Error(String(caught)));
  } finally {
    polling = false;
    schedule();
  }
}

function deliver(result: StatusResult): void {
  const waiter = waiting.get(result.requestId);
  if (!waiter) return;
  if ("error" in result) {
    waiting.delete(result.requestId);
    waiter.reject(new Error(result.error));
    return;
  }
  if (!TERMINAL.has(result.status.status)) return;
  waiting.delete(result.requestId);
  waiter.resolve(result.status);
}

function sweep(): void {
  const now = Date.now();
  for (const [requestId, waiter] of [...waiting]) {
    if (now <= waiter.deadline) continue;
    waiting.delete(requestId);
    waiter.reject(new Error("Zeitüberschreitung bei der Statusabfrage."));
  }
}

function settleAll(reason: Error): void {
  const waiters = [...waiting.values()];
  waiting.clear();
  misses = 0;
  for (const waiter of waiters) waiter.reject(reason);
}
