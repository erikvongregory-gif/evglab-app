export class ModelArkError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(messageFromBody(status, body));
    this.name = "ModelArkError";
    this.status = status;
    this.body = body;
  }
}

export type QueuedGeneration = {
  status: string;
  requestId: string;
  statusUrl: string;
};

export type GenerationStatus = {
  status: string;
  requestId: string;
  video?: { url: string };
  error?: unknown;
};

export type StatusResult =
  | { requestId: string; status: GenerationStatus }
  | { requestId: string; error: string };

function messageFromBody(status: number, body: unknown): string {
  if (typeof body === "string" && body.trim()) return body;
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    for (const key of ["detail", "message", "error", "msg"]) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value;
      if (value && typeof value === "object") {
        const nested = (value as Record<string, unknown>).message;
        if (typeof nested === "string" && nested.trim()) return nested;
      }
    }
  }
  return `ModelArk error (${status})`;
}
