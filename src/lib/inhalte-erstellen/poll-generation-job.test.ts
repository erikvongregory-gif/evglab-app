import { describe, expect, it } from "vitest";
import { pollGenerationJob } from "./poll-generation-job";

function fakeNow(limit = 10) {
  let t = 0;
  return () => {
    t += 1;
    return t < limit ? t : t + 5 * 60_000;
  };
}

describe("pollGenerationJob", () => {
  it("returns completed images without simulating percent", async () => {
    let calls = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      calls += 1;
      return new Response(
        JSON.stringify({
          job: {
            status: calls === 1 ? "reserved" : "completed",
            result: {
              phase: calls === 1 ? "generating" : "completed",
              completedVariants: calls === 1 ? 1 : 2,
              expectedVariants: 2,
              images: [{ imageUrl: "https://cdn.example/a.png" }, ...(calls > 1 ? [{ imageUrl: "https://cdn.example/b.png" }] : [])],
            },
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;
    const ticks: string[] = [];
    try {
      const result = await pollGenerationJob({
        jobId: "job-1",
        expectedVariants: 2,
        now: fakeNow(),
        sleep: async () => undefined,
        onProgress: (message) => ticks.push(message),
      });
      expect(result.images?.length).toBe(2);
      expect(result.pending).toBeUndefined();
      expect(ticks.some((tick) => tick.includes("Varianten fertig"))).toBe(true);
      expect(ticks.join(" ")).not.toMatch(/%/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("treats a failed generation as failed", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ job: { status: "failed", result: { phase: "failed", error: "Modellfehler" } } }), {
        status: 200,
      })) as typeof fetch;
    try {
      const result = await pollGenerationJob({
        jobId: "job-fail",
        expectedVariants: 1,
        now: fakeNow(),
        sleep: async () => undefined,
      });
      expect(result.error).toBe("Modellfehler");
      expect(result.pending).toBeUndefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("keeps a timed-out poll pending instead of failed", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ job: { status: "reserved", result: { phase: "generating" } } }), {
        status: 200,
      })) as typeof fetch;
    try {
      const result = await pollGenerationJob({
        jobId: "job-slow",
        expectedVariants: 1,
        now: fakeNow(2),
        sleep: async () => undefined,
      });
      expect(result.pending).toBe(true);
      expect(result.error).toBeUndefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("does not treat a connection error as a failed generation", async () => {
    let calls = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      calls += 1;
      if (calls === 1) return new Response("nope", { status: 503 });
      return new Response(
        JSON.stringify({
          job: {
            status: "completed",
            result: { phase: "completed", images: [{ imageUrl: "https://cdn.example/a.png" }] },
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;
    const ticks: string[] = [];
    try {
      const result = await pollGenerationJob({
        jobId: "job-net",
        expectedVariants: 1,
        now: fakeNow(),
        sleep: async () => undefined,
        onProgress: (message) => ticks.push(message),
      });
      expect(result.images?.length).toBe(1);
      expect(ticks.some((tick) => tick.includes("Verbindung"))).toBe(true);
      expect(result.error).toBeUndefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("returns partial images while the job is still open", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          job: {
            status: "reserved",
            result: {
              phase: "generating",
              completedVariants: 1,
              expectedVariants: 3,
              images: [{ imageUrl: "https://cdn.example/a.png" }],
            },
          },
        }),
        { status: 200 },
      )) as typeof fetch;
    try {
      const result = await pollGenerationJob({
        jobId: "job-partial",
        expectedVariants: 3,
        now: fakeNow(2),
        sleep: async () => undefined,
      });
      expect(result.pending).toBe(true);
      expect(result.partial).toBe(true);
      expect(result.images?.length).toBe(1);
      expect(result.error).toBeUndefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
