import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearActiveGeneration,
  payloadHash,
  readActiveGeneration,
  requestKeyForPayload,
  writeActiveGeneration,
} from "./active-generation";

const store = new Map<string, string>();

describe("active generation keys", () => {
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
    });
  });
  afterEach(() => {
    clearActiveGeneration();
    vi.unstubAllGlobals();
  });

  it("reuses the key for the same payload and issues a new one after a change", () => {
    const first = requestKeyForPayload(payloadHash({ a: 1 }));
    expect(requestKeyForPayload(payloadHash({ a: 1 }))).toBe(first);
    expect(requestKeyForPayload(payloadHash({ a: 2 }))).not.toBe(first);
  });

  it("restores a stored job id", () => {
    writeActiveGeneration({ requestKey: "k", hash: "h", jobId: "job-1", startedAt: Date.now() });
    expect(readActiveGeneration()?.jobId).toBe("job-1");
  });
});
