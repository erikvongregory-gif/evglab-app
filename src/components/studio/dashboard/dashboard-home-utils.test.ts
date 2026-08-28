import { describe, expect, it } from "vitest";
import {
  aggregateTokenUsage,
  buildChartPaths,
  chartHasVariation,
  chartPathsWithinBounds,
  describeChargesTotalKpi,
  formatChartTextAlternative,
  shouldShowTokenChart,
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

    it("aggregiert einen einzelnen Datenpunkt", () => {
      const items = [
        media({
          id: "a",
          createdAt: new Date().toISOString(),
          generation: { tokenCost: 25 },
        }),
      ];
      const result = aggregateTokenUsage(items, "30d");
      expect(result.points).toHaveLength(1);
      expect(result.points[0]!.tokens).toBe(25);
      expect(result.total).toBe(25);
    });

    it("summiert mehrere Einträge am selben Tag", () => {
      const day = "2026-08-20T12:00:00.000Z";
      const items = [
        media({ id: "a", createdAt: day, generation: { tokenCost: 10 } }),
        media({ id: "b", createdAt: day, generation: { tokenCost: 15 } }),
      ];
      const result = aggregateTokenUsage(items, "30d");
      expect(result.points).toHaveLength(1);
      expect(result.points[0]!.tokens).toBe(25);
    });

    it("sortiert unsortierte Einträge chronologisch", () => {
      const items = [
        media({ id: "b", createdAt: "2026-08-22T12:00:00.000Z", generation: { tokenCost: 20 } }),
        media({ id: "a", createdAt: "2026-08-20T12:00:00.000Z", generation: { tokenCost: 10 } }),
      ];
      const result = aggregateTokenUsage(items, "30d");
      expect(result.points.map((p) => p.date)).toEqual(["2026-08-20", "2026-08-22"]);
    });

    it("ignoriert ungültiges oder fehlendes Datum", () => {
      const items = [
        media({ id: "bad", createdAt: "invalid-date", generation: { tokenCost: 99 } }),
        media({ id: "good", createdAt: new Date().toISOString(), generation: { tokenCost: 10 } }),
      ];
      const result = aggregateTokenUsage(items, "30d");
      expect(result.points).toHaveLength(1);
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

    it("behandelt konstante Werte", () => {
      const items = Array.from({ length: 3 }).map((_, i) =>
        media({
          id: `m-${i}`,
          createdAt: new Date(Date.now() - i * 86_400_000).toISOString(),
          generation: { tokenCost: 40 },
        }),
      );
      const result = aggregateTokenUsage(items, "30d");
      expect(result.points.every((p) => p.tokens === 40)).toBe(true);
      expect(chartHasVariation(result.points)).toBe(false);
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
    it("beschreibt eindeutige Chargennummern korrekt", () => {
      const summary = { chargesTotal: 3 } as DashboardHomeSummary;
      const items = [
        media({ id: "a", createdAt: new Date().toISOString(), generation: { chargeNumber: 1 } }),
        media({ id: "b", createdAt: new Date().toISOString(), generation: { chargeNumber: 2 } }),
      ];
      expect(describeChargesTotalKpi(summary, items)).toEqual({
        label: "Generierungen gesamt",
        subtitle: "Eindeutige Chargennummern in der Mediathek",
      });
    });

    it("beschreibt Mediathek-Fallback ohne Brauerei-Metapher", () => {
      const summary = { chargesTotal: 2 } as DashboardHomeSummary;
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
