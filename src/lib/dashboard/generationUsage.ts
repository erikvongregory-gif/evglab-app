import { calculateGenerationTokenCost } from "@/lib/billing/generationTokenCost";

type JobRow = {
  created_at: string | null;
  charged: number | null;
  result?: Record<string, unknown> | null;
};

export type GenerationUsageStats = {
  /** null wenn die Monatszählung fehlgeschlagen ist (nicht mit 0 verwechseln). */
  postsThisMonth: number | null;
  tokenUsageByDay: { date: string; tokens: number }[];
  degradedUsage: boolean;
};

export type GenerationUsageQueries = {
  countCompletedSince: (iso: string) => Promise<{ count: number | null; error: { message: string } | null }>;
  listCompletedPage: (
    cutoffIso: string,
    from: number,
    to: number,
  ) => Promise<{ data: JobRow[] | null; error: { message: string } | null }>;
};

const PAGE = 1000;
const USAGE_WINDOW_MS = 365 * 86_400_000;

export function monthStartIso(now = new Date()) {
  const d = new Date(now);
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Abgerechnete Tokens; bei Owner/charged=0 Nominalkosten aus Result
 * (perVariant × Varianten), sonst Standardkosten — damit die Aktivitätskurve
 * Generierungen sichtbar macht, auch wenn nichts vom Kontingent abgezogen wurde.
 */
export function resolveJobTokenUsage(job: JobRow): number {
  if (typeof job.charged === "number" && job.charged > 0) return job.charged;
  if (typeof job.charged === "number" && job.charged < 0) return 0;

  const result = job.result && typeof job.result === "object" ? job.result : null;
  if (result) {
    const billing =
      result.billing && typeof result.billing === "object"
        ? (result.billing as Record<string, unknown>)
        : null;
    const perVariant =
      billing && typeof billing.perVariant === "number" && Number.isFinite(billing.perVariant)
        ? billing.perVariant
        : null;
    const variantsRaw =
      typeof result.completedVariants === "number"
        ? result.completedVariants
        : typeof result.variantCount === "number"
          ? result.variantCount
          : 1;
    const variants = Math.max(1, Math.floor(variantsRaw));
    if (perVariant != null && perVariant > 0) return perVariant * variants;

    const resolution =
      result.resolution === "2K" || result.resolution === "4K" || result.resolution === "1K"
        ? result.resolution
        : "1K";
    return calculateGenerationTokenCost({ resolution, variantCount: variants });
  }

  // Abgeschlossener Job ohne Result-Details (z. B. Owner mit charged=0)
  if (job.charged === 0 || job.charged == null) {
    return calculateGenerationTokenCost({ resolution: "1K", variantCount: 1 });
  }
  return 0;
}

export function accumulateTokenUsageByDay(jobs: JobRow[]) {
  const buckets = new Map<string, number>();
  for (const job of jobs) {
    const created = typeof job.created_at === "string" ? job.created_at : "";
    if (!created) continue;
    const day = created.slice(0, 10);
    buckets.set(day, (buckets.get(day) ?? 0) + resolveJobTokenUsage(job));
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, tokens]) => ({ date, tokens }));
}

/**
 * Monatsgenerierungen per Count + Tagesverbrauch paginiert.
 * Bei Fehler kein Mediathek-Fallback: degradedUsage + leere Buckets.
 */
export async function loadGenerationUsageStats(
  queries: GenerationUsageQueries,
  now = new Date(),
): Promise<GenerationUsageStats> {
  const empty: GenerationUsageStats = {
    postsThisMonth: null,
    tokenUsageByDay: [],
    degradedUsage: true,
  };

  const monthStart = monthStartIso(now);
  const usageCutoff = new Date(now.getTime() - USAGE_WINDOW_MS).toISOString();

  const monthCount = await queries.countCompletedSince(monthStart);
  if (monthCount.error) return empty;

  const jobs: JobRow[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const page = await queries.listCompletedPage(usageCutoff, offset, offset + PAGE - 1);
    if (page.error) {
      return {
        postsThisMonth: monthCount.count ?? 0,
        tokenUsageByDay: [],
        degradedUsage: true,
      };
    }
    const rows = page.data ?? [];
    jobs.push(...rows);
    if (rows.length < PAGE) break;
  }

  return {
    postsThisMonth: monthCount.count ?? 0,
    tokenUsageByDay: accumulateTokenUsageByDay(jobs),
    degradedUsage: false,
  };
}
