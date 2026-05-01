type AuthEventLevel = "info" | "warn" | "error";

type AuthEvent = {
  event: string;
  level?: AuthEventLevel;
  requestId: string;
  userId?: string;
  email?: string;
  status?: number;
  durationMs?: number;
  meta?: Record<string, unknown>;
};

export function getOrCreateRequestId(request: Request): string {
  const incoming = request.headers.get("x-request-id")?.trim();
  if (incoming) return incoming.slice(0, 120);
  return crypto.randomUUID();
}

export function withRequestHeaders(headers: HeadersInit | undefined, requestId: string): Headers {
  const next = new Headers(headers);
  next.set("x-request-id", requestId);
  return next;
}

export function logAuthEvent(payload: AuthEvent): void {
  const record = {
    ts: new Date().toISOString(),
    domain: "auth",
    level: payload.level ?? "info",
    event: payload.event,
    requestId: payload.requestId,
    userId: payload.userId,
    email: payload.email,
    status: payload.status,
    durationMs: payload.durationMs,
    ...payload.meta,
  };
  const line = JSON.stringify(record);
  if (payload.level === "error") {
    console.error(line);
    return;
  }
  if (payload.level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
}

export async function withTimeout<T>(
  task: Promise<T>,
  timeoutMs: number,
  reason: string,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(reason), timeoutMs);
  try {
    return await Promise.race([
      task,
      new Promise<T>((_, reject) => {
        controller.signal.addEventListener("abort", () => {
          reject(new Error(reason));
        });
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}
