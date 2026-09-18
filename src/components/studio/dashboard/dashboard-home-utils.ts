import { calculateGenerationTokenCost } from "@/lib/billing/generationTokenCost";
import { STUDIO_PLANS } from "@/lib/billing/planCatalog";
import type { SubscriptionPlanKey } from "@/lib/billing/tokenState";
import { isBrandProfileActive } from "@/lib/dashboard/brandProfile";
import { formatChargeNumber, getMediaDisplayTitle } from "@/lib/dashboard/metadata";

export type DashboardHomeMediaItem = {
  id: string;
  imageUrl: string;
  title?: string;
  prompt: string;
  createdAt: string;
  aspectRatio: string;
  resolution: "1K" | "2K" | "4K";
  generation?: {
    mode?: "hyperreal" | "studio" | "isolate" | "campaign" | null;
    tokenCost?: number | null;
    chargeNumber?: number | null;
    styleLabel?: string | null;
  } | null;
};

export type DashboardHomeSummary = {
  unlimited?: boolean;
  tokens: { monthly: number; used: number; remaining: number; unlimited?: boolean };
  periodEnd?: string | null;
  postsThisMonth: number | null;
  chargesTotal?: number;
  teamMembers: number;
  openInvites: number;
  billingStatus: string;
  plan: string | null;
  degradedBilling?: boolean;
  /** Verbrauchsstatistik aus generation_jobs fehlgeschlagen — kein Mediathek-Fallback. */
  degradedUsage?: boolean;
  /** Dauerhafter Tagesverbrauch aus generation_jobs (überlebt Mediathek-Löschen). */
  tokenUsageByDay?: { date: string; tokens: number }[];
};

export type DashboardHomeSettings = {
  brandProfileMode: "undecided" | "guided" | "skip";
  breweryName: string;
  brandWebsiteUrl: string;
  brandTone: string;
  brandColors: string;
  brandDos: string;
  brandDonts: string;
  brandLockLevel: "strict" | "balanced" | "loose";
};

export type TokenRangeKey = "7d" | "30d" | "90d" | "365d";

export const TOKEN_RANGE_DAYS: Record<TokenRangeKey, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "365d": 365,
};

export const TOKEN_RANGE_LABELS: Record<TokenRangeKey, string> = {
  "7d": "7 Tage",
  "30d": "30 Tage",
  "90d": "90 Tage",
  "365d": "365 Tage",
};

export function formatDeNumber(n: number) {
  return n.toLocaleString("de-DE");
}

/** Kompakte Anzeige für große KPI-/Tokenwerte (de-DE), z. B. 12,4k · 1,2 Mio. */
export function formatCompactNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs < 1000) return formatDeNumber(Math.round(n));
  if (abs < 1_000_000) {
    const value = n / 1000;
    const digits = abs < 10_000 ? 1 : 0;
    return `${value.toLocaleString("de-DE", {
      maximumFractionDigits: digits,
      minimumFractionDigits: 0,
    })}k`;
  }
  const value = n / 1_000_000;
  return `${value.toLocaleString("de-DE", {
    maximumFractionDigits: abs < 10_000_000 ? 1 : 0,
    minimumFractionDigits: 0,
  })} Mio.`;
}

export function formatDashboardDate(d = new Date()) {
  return d.toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatShortDashboardDate(d = new Date()) {
  return d.toLocaleDateString("de-DE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatPeriodEnd(iso: string | null | undefined) {
  if (!iso) return null;
  const t = new Date(iso);
  if (!Number.isFinite(t.getTime())) return null;
  return t.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

export function formatRelativeTime(iso: string) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diffMs = Date.now() - t;
  if (diffMs < 60_000) return "gerade eben";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `vor ${mins} Min.`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "gestern";
  return `vor ${days} Tagen`;
}

export function planLabelFromKey(plan: string | null, unlimited: boolean) {
  if (unlimited) return "Owner";
  if (!plan) return "Noch kein Tarif";
  return STUDIO_PLANS.find((p) => p.id === plan)?.name ?? plan;
}

export function tokenCostForMedia(item: DashboardHomeMediaItem) {
  const stored = item.generation?.tokenCost;
  if (typeof stored === "number" && Number.isFinite(stored) && stored >= 0) {
    return stored;
  }
  return calculateGenerationTokenCost({ resolution: item.resolution, variantCount: 1 });
}

export type ChargesTotalSource = "summary-total" | "unique-charge-numbers" | "mediathek-entries" | "estimated-from-counter";

export function chargesTotalSource(
  summary: DashboardHomeSummary | null,
  media: DashboardHomeMediaItem[],
): ChargesTotalSource {
  if (typeof summary?.chargesTotal === "number") return "summary-total";

  const chargeNumbers = media
    .map((m) => m.generation?.chargeNumber)
    .filter((n): n is number => typeof n === "number" && n >= 1);
  if (chargeNumbers.length > 0) return "unique-charge-numbers";

  const total = deriveChargesTotal(summary, media);
  if (media.length > 0 && total === media.length) return "mediathek-entries";
  return "estimated-from-counter";
}

export function describeChargesTotalKpi(summary: DashboardHomeSummary | null, media: DashboardHomeMediaItem[]) {
  switch (chargesTotalSource(summary, media)) {
    case "summary-total":
      return {
        label: "Generierungen gesamt",
        subtitle: "Abgeschlossene Generierungen",
      };
    case "unique-charge-numbers":
      return {
        label: "Generierungen gesamt",
        subtitle: "Eindeutige Chargennummern in der Mediathek",
      };
    case "mediathek-entries":
      return {
        label: "Motive gesamt",
        subtitle: "Einträge in der Mediathek",
      };
    default:
      return {
        label: "Generierungen gesamt",
        subtitle: "Geschätzt aus internem Zähler",
      };
  }
}

export function deriveChargesTotal(summary: DashboardHomeSummary | null, media: DashboardHomeMediaItem[]) {
  if (typeof summary?.chargesTotal === "number") return summary.chargesTotal;
  const nums = media
    .map((m) => m.generation?.chargeNumber)
    .filter((n): n is number => typeof n === "number" && n >= 1);
  if (nums.length) return new Set(nums).size;
  return media.length;
}

export function generationModeLabel(
  mode: "hyperreal" | "studio" | "isolate" | "campaign" | null | undefined,
) {
  switch (mode) {
    case "hyperreal":
      return "Szene";
    case "studio":
      return "Produktbild";
    case "isolate":
      return "Freisteller";
    case "campaign":
      return "Kampagne";
    default:
      return "—";
  }
}

function utcDayKey(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

function fillDailyBuckets(buckets: Map<string, number>, range: TokenRangeKey) {
  if (buckets.size === 0) return { points: [] as { date: string; tokens: number }[], total: 0 };
  const days = TOKEN_RANGE_DAYS[range];
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  const points: { date: string; tokens: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const ms = end.getTime() - i * 86_400_000;
    const date = utcDayKey(ms);
    points.push({ date, tokens: buckets.get(date) ?? 0 });
  }
  const total = points.reduce((sum, p) => sum + p.tokens, 0);
  return { points, total };
}

export function aggregateTokenUsage(media: DashboardHomeMediaItem[], range: TokenRangeKey) {
  const days = TOKEN_RANGE_DAYS[range];
  const cutoff = Date.now() - days * 86_400_000;
  const buckets = new Map<string, number>();

  for (const item of media) {
    const created = new Date(item.createdAt).getTime();
    if (!Number.isFinite(created) || created < cutoff) continue;
    const key = item.createdAt.slice(0, 10);
    buckets.set(key, (buckets.get(key) ?? 0) + tokenCostForMedia(item));
  }

  return fillDailyBuckets(buckets, range);
}

/** Aggregiert serverseitigen Tagesverbrauch (generation_jobs) und füllt Lücken mit 0. */
export function aggregateTokenUsageFromDays(
  usageByDay: { date: string; tokens: number }[],
  range: TokenRangeKey,
) {
  const days = TOKEN_RANGE_DAYS[range];
  const cutoffKey = utcDayKey(Date.now() - days * 86_400_000);
  const buckets = new Map<string, number>();
  for (const row of usageByDay) {
    if (!row.date || row.date < cutoffKey) continue;
    buckets.set(row.date, (buckets.get(row.date) ?? 0) + (Number.isFinite(row.tokens) ? row.tokens : 0));
  }
  return fillDailyBuckets(buckets, range);
}

function historySpanDays(timestamps: number[]) {
  if (timestamps.length === 0) return 0;
  const oldest = Math.min(...timestamps);
  return (Date.now() - oldest) / 86_400_000;
}

/** Freischaltung: 7d+30d immer bei Historie, 90d ab ~1 Monat, 365d ab ~3 Monaten. */
export function availableTokenRanges(media: DashboardHomeMediaItem[], usageByDay?: { date: string; tokens: number }[]) {
  const fromJobs = (usageByDay ?? [])
    .filter((r) => r.tokens > 0)
    .map((r) => new Date(r.date).getTime())
    .filter(Number.isFinite);
  const fromMedia = media
    .map((item) => new Date(item.createdAt).getTime())
    .filter(Number.isFinite);
  const spanDays = historySpanDays(fromJobs.length ? fromJobs : fromMedia);
  if (spanDays <= 0 && fromJobs.length === 0 && fromMedia.length === 0) return [] as TokenRangeKey[];
  const keys: TokenRangeKey[] = ["7d", "30d"];
  if (spanDays >= TOKEN_RANGE_DAYS["30d"]) keys.push("90d");
  if (spanDays >= TOKEN_RANGE_DAYS["90d"]) keys.push("365d");
  return keys;
}

/** @deprecated use availableTokenRanges */
export function canOfferAllTokenRanges(media: DashboardHomeMediaItem[]) {
  return availableTokenRanges(media).length > 1;
}

export function shouldShowTokenChart(points: { date: string; tokens: number }[]) {
  if (points.length === 0) return false;
  return points.some((p) => p.tokens > 0);
}

export function chartHasVariation(points: { date: string; tokens: number }[]) {
  if (points.length <= 1) return false;
  const first = points[0]!.tokens;
  return points.some((p) => p.tokens !== first);
}

export function formatChartTextAlternative(
  points: { date: string; tokens: number }[],
  total: number,
  rangeDays: number,
) {
  if (points.length === 0) {
    return `Kein Token-Verbrauch in den letzten ${rangeDays} Tagen.`;
  }
  const peak = points.reduce((best, p) => (p.tokens > best.tokens ? p : best), points[0]!);
  const peakDate = new Date(peak.date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  return `Tokens pro Tag: ${formatDeNumber(total)} Tokens gesamt in ${rangeDays} Tagen. Höchster Tagesverbrauch ${formatDeNumber(peak.tokens)} am ${peakDate}.`;
}

function safeChartCoord(value: number, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

export function buildChartPaths(points: { date: string; tokens: number }[], width = 720, height = 190) {
  if (points.length === 0) {
    return { linePath: "", areaPath: "", labels: [] as string[], maxTokens: 0, coords: [] as { x: number; y: number }[] };
  }

  const padX = 8;
  const padY = 12;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const sanitized = points.map((p) => ({
    date: p.date,
    tokens: safeChartCoord(p.tokens, 0),
  }));
  const maxTokens = Math.max(...sanitized.map((p) => p.tokens), 1);

  const coords = sanitized.map((p, i) => {
    const x = safeChartCoord(
      padX + (sanitized.length === 1 ? innerW / 2 : (i / (sanitized.length - 1)) * innerW),
    );
    const y = safeChartCoord(padY + innerH - (p.tokens / maxTokens) * innerH, padY + innerH);
    return { x, y, date: p.date, tokens: p.tokens };
  });

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${coords[coords.length - 1]!.x.toFixed(1)} ${(padY + innerH).toFixed(1)} L ${coords[0]!.x.toFixed(1)} ${(padY + innerH).toFixed(1)} Z`;

  const labelCount = Math.min(6, coords.length);
  const step = Math.max(1, Math.floor((coords.length - 1) / Math.max(labelCount - 1, 1)));
  const labels = coords
    .filter((_, i) => i % step === 0 || i === coords.length - 1)
    .map((c) =>
      new Date(c.date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }),
    );

  return { linePath, areaPath, labels, maxTokens, coords };
}

export function chartPathsWithinBounds(
  paths: Pick<ReturnType<typeof buildChartPaths>, "coords">,
  width = 720,
  height = 190,
) {
  return paths.coords.every(
    (c) => c.x >= 0 && c.x <= width && c.y >= 0 && c.y <= height && Number.isFinite(c.x) && Number.isFinite(c.y),
  );
}

export function missingBrandFields(settings: DashboardHomeSettings | null) {
  if (!settings || settings.brandProfileMode === "skip") return [] as string[];
  const missing: string[] = [];
  if (!settings.breweryName?.trim()) missing.push("Brauereiname");
  if (!settings.brandTone?.trim()) missing.push("Tonalität");
  if (!settings.brandColors?.trim()) missing.push("Markenfarben");
  if (!settings.brandDos?.trim()) missing.push("Dos");
  if (!settings.brandDonts?.trim()) missing.push("Don'ts");
  return missing;
}

export function brandStatusLabel(complete: boolean, settings: DashboardHomeSettings | null) {
  if (!settings) return "Unbekannt";
  if (settings.brandProfileMode === "skip") return "Deaktiviert";
  if (complete) return "Aktiv";
  if (settings.brandProfileMode === "undecided") return "Noch nicht eingerichtet";
  return "Unvollständig";
}

export function brandProfileActiveFromSettings(settings: DashboardHomeSettings | null) {
  if (!settings) return false;
  return isBrandProfileActive({
    brandProfileMode: settings.brandProfileMode,
    brandInstagramUrl: "",
    brandWebsiteUrl: settings.brandWebsiteUrl,
    brandProfileSource: "manual",
    brandLockLevel: settings.brandLockLevel,
    breweryName: settings.breweryName,
    brandTone: settings.brandTone,
    brandColors: settings.brandColors,
    brandDos: settings.brandDos,
    brandDonts: settings.brandDonts,
    brandReferenceImageUrls: [],
    brandLabelReferenceUrl: "",
    brandHeadlineFontName: "",
    brandFontFileUrl: "",
    brandFontWeight: "700",
  });
}

export function mediaRowTitle(item: DashboardHomeMediaItem) {
  return getMediaDisplayTitle(item);
}

export function mediaChargeLabel(item: DashboardHomeMediaItem) {
  const charge = formatChargeNumber(item.generation?.chargeNumber ?? null);
  return charge ? `C-${charge}` : null;
}

export function tokensAvailablePct(remaining: number, monthly: number, unlimited: boolean) {
  if (unlimited) return null;
  if (monthly <= 0) return null;
  const pct = Math.round((remaining / monthly) * 100);
  if (!Number.isFinite(pct)) return null;
  return Math.max(0, Math.min(100, pct));
}

export function tokensUsed(summary: DashboardHomeSummary | null, unlimited: boolean) {
  if (!summary || unlimited) return null;
  if (typeof summary.tokens.used === "number" && Number.isFinite(summary.tokens.used)) return summary.tokens.used;
  if (summary.tokens.monthly > 0) return Math.max(summary.tokens.monthly - summary.tokens.remaining, 0);
  return null;
}

export type PlanKey = SubscriptionPlanKey;
