/**
 * Dev-Messpunkte für Dashboard-Ladezeit (Shell / Tokens / erstes Asset).
 * Nur in development — kein Produktions-Overhead.
 */
const PREFIX = "brewai-dash";

export function markDashboardPerf(name: "shell-visible" | "tokens-ready" | "first-asset"): void {
  if (process.env.NODE_ENV !== "development") return;
  if (typeof performance === "undefined") return;

  const mark = `${PREFIX}:${name}`;
  try {
    performance.mark(mark);
  } catch {
    return;
  }

  const nav =
    typeof performance.getEntriesByType === "function"
      ? (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined)
      : undefined;
  const origin = nav?.startTime ?? 0;
  const entry = performance.getEntriesByName(mark).at(-1);
  if (!entry) return;

  const ms = Math.round(entry.startTime - origin);
  console.info(`[dashboard-perf] ${name}: ${ms}ms since navigation start`);
}
