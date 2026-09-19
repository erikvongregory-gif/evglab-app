import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearActiveGeneration, requestKeyForPayload, payloadHash } from "./active-generation";
import {
  interpretStartGenerationResponse,
  mediaLibraryHref,
  startStudioGeneration,
} from "./start-studio-generation";

const store = new Map<string, string>();

describe("interpretStartGenerationResponse", () => {
  it("opens media after a confirmed 202 start", () => {
    expect(interpretStartGenerationResponse(202, { jobId: "job-1", aspectRatio: "4:5" })).toEqual({
      action: "open_media",
      jobId: "job-1",
      resume: false,
      aspectRatio: "4:5",
      expectedVariants: undefined,
    });
  });

  it("stays in the editor on start errors", () => {
    expect(interpretStartGenerationResponse(400, { error: "Ungültige Anfrage." })).toEqual({
      action: "stay_error",
      error: "Ungültige Anfrage.",
    });
    expect(interpretStartGenerationResponse(402, { error: "Nicht genug Tokens." })).toEqual({
      action: "stay_error",
      error: "Nicht genug Tokens.",
    });
  });

  it("resumes only a matching in-progress job from 409", () => {
    expect(
      interpretStartGenerationResponse(409, { code: "job_in_progress", jobId: "job-9" }),
    ).toEqual({
      action: "open_media",
      jobId: "job-9",
      resume: true,
      aspectRatio: undefined,
      expectedVariants: undefined,
    });
    expect(
      interpretStartGenerationResponse(409, {
        code: "idempotency_key_mismatch",
        error: "Auftragsschlüssel wurde mit anderem Inhalt oder einer anderen Route wiederverwendet.",
      }),
    ).toEqual({
      action: "stay_error",
      error: "Auftragsschlüssel wurde mit anderem Inhalt oder einer anderen Route wiederverwendet.",
    });
    expect(interpretStartGenerationResponse(409, { error: "Guthaben prüfen." })).toEqual({
      action: "stay_error",
      error: "Guthaben prüfen.",
    });
  });

  it("opens media for an already completed idempotent retry", () => {
    expect(interpretStartGenerationResponse(200, { jobId: "job-done", images: [{ imageUrl: "https://cdn/a.png" }] })).toEqual({
      action: "open_media",
      jobId: "job-done",
      resume: true,
      aspectRatio: undefined,
      expectedVariants: undefined,
    });
  });
});

describe("startStudioGeneration", () => {
  beforeEach(() => {
    store.clear();
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
      },
      dispatchEvent: vi.fn(() => true),
    });
    vi.stubGlobal(
      "CustomEvent",
      class CustomEvent {
        type: string;
        detail: unknown;
        constructor(type: string, init?: { detail?: unknown }) {
          this.type = type;
          this.detail = init?.detail;
        }
      },
    );
  });
  afterEach(() => {
    clearActiveGeneration();
    vi.unstubAllGlobals();
  });

  it("reuses the idempotency key when the network is unclear", async () => {
    const payload = { prompt: "Holztisch" };
    const firstKey = requestKeyForPayload(payloadHash(payload));
    const fetchMock = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    const first = await startStudioGeneration({ url: "/api/inhalte-erstellen/create-task", payload, fetch: fetchMock });
    expect(first).toEqual({
      action: "stay_error",
      error: "Netzwerkfehler. Bitte denselben Auftrag erneut senden — es entsteht kein zweites Motiv.",
    });
    const fetchOk = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({ "Idempotency-Key": firstKey });
      return new Response(JSON.stringify({ jobId: "job-1" }), { status: 202 });
    }) as unknown as typeof fetch;
    const second = await startStudioGeneration({ url: "/api/inhalte-erstellen/create-task", payload, fetch: fetchOk });
    expect(second).toEqual({
      action: "open_media",
      jobId: "job-1",
      resume: false,
      aspectRatio: undefined,
      expectedVariants: undefined,
    });
  });

  it("does not treat a 409 without job_in_progress as resume", async () => {
    const payload = { prompt: "Wiese" };
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ error: "Nicht genug Tokens.", code: "reservation_failed" }), { status: 409 }),
    ) as unknown as typeof fetch;
    const outcome = await startStudioGeneration({
      url: "/api/inhalte-erstellen/create-task",
      payload,
      fetch: fetchMock,
    });
    expect(outcome.action).toBe("stay_error");
  });
});

describe("mediaLibraryHref", () => {
  it("addresses the confirmed job in the media tab", () => {
    expect(mediaLibraryHref("abc 1")).toBe("/dashboard/media?job=abc%201");
  });
});
