type JobRow = { created_at: string | null; charged: number | null };

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

export function accumulateTokenUsageByDay(jobs: JobRow[]) {
  const buckets = new Map<string, number>();
  for (const job of jobs) {
    const created = typeof job.created_at === "string" ? job.created_at : "";
    if (!created) continue;
    const day = created.slice(0, 10);
    const tokens = typeof job.charged === "number" && job.charged >= 0 ? job.charged : 0;
    buckets.set(day, (buckets.get(day) ?? 0) + tokens);
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
