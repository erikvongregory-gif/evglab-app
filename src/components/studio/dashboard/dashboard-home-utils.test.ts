import { describe, expect, it } from "vitest";
import {
  aggregateTokenUsage,
  aggregateTokenUsageFromDays,
  availableTokenRanges,
  buildChartPaths,
  chartHasVariation,
  chartPathsWithinBounds,
  describeChargesTotalKpi,
  formatChartTextAlternative,
  shouldShowTokenChart,
  TOKEN_RANGE_DAYS,
  tokenCostForMedia,
  tokensAvailablePct,
  type DashboardHomeMediaItem,
  type DashboardHomeSummary,
} from "./dashboard-home-utils";

function media(partial: Partial<DashboardHomeMediaItem> & Pick<DashboardHomeMediaItem, "id" | "createdAt">): DashboardHomeMediaItem {
  return {
    imageUrl: "",
    prompt: "test",
    aspectRatio: "1:1",
    resolution: "2K",
    ...partial,
  };
}

describe("dashboard-home-utils", () => {
  describe("aggregateTokenUsage", () => {
    it("liefert leere Punkte für leere Medienliste", () => {
      const result = aggregateTokenUsage([], "30d");
      expect(result.points).toEqual([]);
      expect(result.total).toBe(0);
    });

    it("füllt Lücken mit Nullen über den gesamten Zeitraum", () => {
      const items = [
        media({
          id: "a",
          createdAt: new Date().toISOString(),
          generation: { tokenCost: 25 },
        }),
      ];
      const result = aggregateTokenUsage(items, "30d");
      expect(result.points).toHaveLength(TOKEN_RANGE_DAYS["30d"]);
      expect(result.total).toBe(25);
      expect(result.points.some((p) => p.tokens === 25)).toBe(true);
      expect(result.points.filter((p) => p.tokens === 0).length).toBe(TOKEN_RANGE_DAYS["30d"] - 1);
    });

    it("summiert mehrere Einträge am selben Tag", () => {
      const day = new Date().toISOString();
      const items = [
        media({ id: "a", createdAt: day, generation: { tokenCost: 10 } }),
        media({ id: "b", createdAt: day, generation: { tokenCost: 15 } }),
      ];
      const result = aggregateTokenUsage(items, "30d");
      expect(result.total).toBe(25);
      expect(result.points.filter((p) => p.tokens > 0)).toHaveLength(1);
    });

    it("erhält chronologische Tagesreihenfolge mit Abstand", () => {
      const recent = new Date();
      const older = new Date(Date.now() - 2 * 86_400_000);
      const items = [
        media({ id: "b", createdAt: recent.toISOString(), generation: { tokenCost: 20 } }),
        media({ id: "a", createdAt: older.toISOString(), generation: { tokenCost: 10 } }),
      ];
      const result = aggregateTokenUsage(items, "30d");
      const active = result.points.filter((p) => p.tokens > 0);
      expect(active).toHaveLength(2);
      expect(active[0]!.tokens).toBe(10);
      expect(active[1]!.tokens).toBe(20);
      // Zwei Tage Abstand → ein Null-Tag dazwischen
      const i0 = result.points.findIndex((p) => p.date === active[0]!.date);
      const i1 = result.points.findIndex((p) => p.date === active[1]!.date);
      expect(i1 - i0).toBe(2);
    });

    it("ignoriert ungültiges oder fehlendes Datum", () => {
      const items = [
        media({ id: "bad", createdAt: "invalid-date", generation: { tokenCost: 99 } }),
        media({ id: "good", createdAt: new Date().toISOString(), generation: { tokenCost: 10 } }),
      ];
      const result = aggregateTokenUsage(items, "30d");
      expect(result.total).toBe(10);
    });

    it("wendet echte 30-Tage-Grenze an", () => {
      const old = new Date(Date.now() - 31 * 86_400_000).toISOString();
      const recent = new Date().toISOString();
      const items = [
        media({ id: "old", createdAt: old, generation: { tokenCost: 100 } }),
        media({ id: "new", createdAt: recent, generation: { tokenCost: 5 } }),
      ];
      const result = aggregateTokenUsage(items, "30d");
      expect(result.total).toBe(5);
    });

    it("erkennt konstante Werte über alle Tage", () => {
      const flat = Array.from({ length: 30 }, () => ({ date: "x", tokens: 40 }));
      expect(chartHasVariation(flat)).toBe(false);
    });

    it("summiert sehr große Werte ohne NaN", () => {
      const items = [
        media({ id: "a", createdAt: new Date().toISOString(), generation: { tokenCost: 1_000_000 } }),
        media({ id: "b", createdAt: new Date().toISOString(), generation: { tokenCost: 2_000_000 } }),
      ];
      const result = aggregateTokenUsage(items, "30d");
      expect(result.total).toBe(3_000_000);
      expect(Number.isFinite(result.total)).toBe(true);
    });
  });

  describe("aggregateTokenUsageFromDays", () => {
    it("füllt Lücken aus Job-Buckets", () => {
      const today = new Date().toISOString().slice(0, 10);
      const result = aggregateTokenUsageFromDays([{ date: today, tokens: 12 }], "30d");
      expect(result.points).toHaveLength(30);
      expect(result.total).toBe(12);
    });
  });

  describe("availableTokenRanges", () => {
    it("bietet 7d und 30d bei kurzer Historie", () => {
      const items = [media({ id: "new", createdAt: new Date().toISOString() })];
      expect(availableTokenRanges(items)).toEqual(["7d", "30d"]);
    });

    it("schaltet 90d frei ab 30 Tagen Historie", () => {
      const items = [
        media({ id: "old", createdAt: new Date(Date.now() - 40 * 86_400_000).toISOString() }),
        media({ id: "new", createdAt: new Date().toISOString() }),
      ];
      expect(availableTokenRanges(items)).toEqual(["7d", "30d", "90d"]);
    });

    it("schaltet 365d frei ab 90 Tagen Historie", () => {
      const items = [
        media({ id: "old", createdAt: new Date(Date.now() - 100 * 86_400_000).toISOString() }),
        media({ id: "new", createdAt: new Date().toISOString() }),
      ];
      expect(availableTokenRanges(items)).toEqual(["7d", "30d", "90d", "365d"]);
    });
  });

  describe("tokenCostForMedia", () => {
    it("nutzt Fallback bei fehlender Tokenkosten-Angabe", () => {
      const cost = tokenCostForMedia(media({ id: "a", createdAt: new Date().toISOString() }));
      expect(cost).toBeGreaterThan(0);
      expect(Number.isFinite(cost)).toBe(true);
    });

    it("behandelt negative Tokenkosten nicht als normalen Verbrauch", () => {
      const cost = tokenCostForMedia(
        media({
          id: "a",
          createdAt: new Date().toISOString(),
          generation: { tokenCost: -50 },
        }),
      );
      expect(cost).toBeGreaterThanOrEqual(0);
      expect(cost).not.toBe(-50);
    });

    it("behandelt unbekannte Tokenkosten (NaN) wie fehlend", () => {
      const cost = tokenCostForMedia(
        media({
          id: "a",
          createdAt: new Date().toISOString(),
          generation: { tokenCost: Number.NaN },
        }),
      );
      expect(Number.isFinite(cost)).toBe(true);
      expect(cost).toBeGreaterThan(0);
    });
  });

  describe("buildChartPaths", () => {
    it("liefert leere Pfade ohne Punkte", () => {
      const chart = buildChartPaths([]);
      expect(chart.linePath).toBe("");
      expect(chart.areaPath).toBe("");
    });

    it("hält Chart-Pfad innerhalb der SVG-Grenzen", () => {
      const points = [
        { date: "2026-08-01", tokens: 10 },
        { date: "2026-08-02", tokens: 50 },
        { date: "2026-08-03", tokens: 30 },
      ];
      const chart = buildChartPaths(points);
      expect(chartPathsWithinBounds(chart)).toBe(true);
      expect(chart.linePath).not.toMatch(/NaN|Infinity/);
      expect(chart.areaPath).not.toMatch(/NaN|Infinity/);
    });

    it("produziert keine NaN/Infinity bei extremen Eingaben", () => {
      const chart = buildChartPaths([
        { date: "2026-08-01", tokens: Number.NaN },
        { date: "2026-08-02", tokens: Number.POSITIVE_INFINITY },
      ]);
      expect(chart.linePath).not.toMatch(/NaN|Infinity/);
      expect(chart.coords.every((c) => Number.isFinite(c.x) && Number.isFinite(c.y))).toBe(true);
    });
  });

  describe("shouldShowTokenChart", () => {
    it("blendet leere oder Null-Verbräuche aus", () => {
      expect(shouldShowTokenChart([])).toBe(false);
      expect(shouldShowTokenChart([{ date: "2026-08-01", tokens: 0 }])).toBe(false);
      expect(shouldShowTokenChart([{ date: "2026-08-01", tokens: 5 }])).toBe(true);
    });
  });

  describe("formatChartTextAlternative", () => {
    it("beschreibt Tagesverbrauch verständlich", () => {
      const alt = formatChartTextAlternative(
        [
          { date: "2026-08-01", tokens: 10 },
          { date: "2026-08-02", tokens: 40 },
        ],
        50,
        30,
      );
      expect(alt).toContain("Tokens pro Tag");
      expect(alt).toContain("50");
    });
  });

  describe("tokensAvailablePct", () => {
    it("liefert null bei 0 Planlimit", () => {
      expect(tokensAvailablePct(100, 0, false)).toBeNull();
    });

    it("liefert 100 bei vollständig verfügbarem Budget", () => {
      expect(tokensAvailablePct(1600, 1600, false)).toBe(100);
    });

    it("begrenzt überzogenes Budget auf 0 %", () => {
      expect(tokensAvailablePct(-200, 1600, false)).toBe(0);
    });

    it("begrenzt Prozentwerte auf 0–100", () => {
      expect(tokensAvailablePct(2000, 1600, false)).toBe(100);
      expect(tokensAvailablePct(800, 1600, false)).toBe(50);
    });

    it("liefert null bei unbekanntem oder unbegrenztem Planlimit", () => {
      expect(tokensAvailablePct(500, 1600, true)).toBeNull();
      expect(tokensAvailablePct(500, -1, false)).toBeNull();
    });
  });

  describe("describeChargesTotalKpi", () => {
    it("bevorzugt Summary-Gesamtzahl aus Jobs", () => {
      const summary = { chargesTotal: 3 } as DashboardHomeSummary;
      const items = [
        media({ id: "a", createdAt: new Date().toISOString(), generation: { chargeNumber: 1 } }),
        media({ id: "b", createdAt: new Date().toISOString(), generation: { chargeNumber: 2 } }),
      ];
      expect(describeChargesTotalKpi(summary, items)).toEqual({
        label: "Generierungen gesamt",
        subtitle: "Abgeschlossene Generierungen",
      });
    });

    it("beschreibt Mediathek-Fallback ohne Brauerei-Metapher", () => {
      const summary = {} as DashboardHomeSummary;
      const items = [
        media({ id: "a", createdAt: new Date().toISOString() }),
        media({ id: "b", createdAt: new Date().toISOString() }),
      ];
      expect(describeChargesTotalKpi(summary, items)).toEqual({
        label: "Motive gesamt",
        subtitle: "Einträge in der Mediathek",
      });
    });
  });
});
