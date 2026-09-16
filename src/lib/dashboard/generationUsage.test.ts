import { describe, expect, it, vi } from "vitest";
import {
  accumulateTokenUsageByDay,
  loadGenerationUsageStats,
  monthStartIso,
  type GenerationUsageQueries,
} from "./generationUsage";

describe("generationUsage", () => {
  describe("accumulateTokenUsageByDay", () => {
    it("summiert Tokens pro Tag und ignoriert negative charged", () => {
      expect(
        accumulateTokenUsageByDay([
          { created_at: "2026-03-01T10:00:00.000Z", charged: 10 },
          { created_at: "2026-03-01T12:00:00.000Z", charged: 5 },
          { created_at: "2026-03-02T08:00:00.000Z", charged: -3 },
          { created_at: null, charged: 99 },
        ]),
      ).toEqual([
        { date: "2026-03-01", tokens: 15 },
        { date: "2026-03-02", tokens: 0 },
      ]);
    });
  });

  describe("loadGenerationUsageStats", () => {
    const now = new Date("2026-03-15T12:00:00.000Z");

    it("paginiert über 1000er-Seiten und liefert Monats-Count", async () => {
      const page1 = Array.from({ length: 1000 }, (_, i) => ({
        created_at: `2026-03-01T00:00:${String(i % 60).padStart(2, "0")}.000Z`,
        charged: 1,
      }));
      const page2 = [{ created_at: "2026-02-01T00:00:00.000Z", charged: 7 }];
      const listCompletedPage = vi
        .fn()
        .mockResolvedValueOnce({ data: page1, error: null })
        .mockResolvedValueOnce({ data: page2, error: null });
      const queries: GenerationUsageQueries = {
        countCompletedSince: vi.fn().mockResolvedValue({ count: 42, error: null }),
        listCompletedPage,
      };

      const result = await loadGenerationUsageStats(queries, now);

      expect(result.degradedUsage).toBe(false);
      expect(result.postsThisMonth).toBe(42);
      expect(result.tokenUsageByDay).toEqual([
        { date: "2026-02-01", tokens: 7 },
        { date: "2026-03-01", tokens: 1000 },
      ]);
      expect(listCompletedPage).toHaveBeenCalledTimes(2);
      expect(listCompletedPage).toHaveBeenNthCalledWith(1, expect.any(String), 0, 999);
      expect(listCompletedPage).toHaveBeenNthCalledWith(2, expect.any(String), 1000, 1999);
      expect(queries.countCompletedSince).toHaveBeenCalledWith(monthStartIso(now));
    });

    it("fällt bei Count-Fehler nicht auf Mediathek zurück", async () => {
      const queries: GenerationUsageQueries = {
        countCompletedSince: vi.fn().mockResolvedValue({ count: null, error: { message: "boom" } }),
        listCompletedPage: vi.fn(),
      };

      const result = await loadGenerationUsageStats(queries, now);

      expect(result).toEqual({
        postsThisMonth: 0,
        tokenUsageByDay: [],
        degradedUsage: true,
      });
      expect(queries.listCompletedPage).not.toHaveBeenCalled();
    });

    it("markiert degradedUsage bei Seitenfehler und behält Monats-Count", async () => {
      const queries: GenerationUsageQueries = {
        countCompletedSince: vi.fn().mockResolvedValue({ count: 9, error: null }),
        listCompletedPage: vi.fn().mockResolvedValue({ data: null, error: { message: "timeout" } }),
      };

      const result = await loadGenerationUsageStats(queries, now);

      expect(result).toEqual({
        postsThisMonth: 9,
        tokenUsageByDay: [],
        degradedUsage: true,
      });
    });
  });
});
