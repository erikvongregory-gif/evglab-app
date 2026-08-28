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
  postsThisMonth: number;
  chargesTotal?: number;
  teamMembers: number;
  openInvites: number;
  billingStatus: string;
  plan: string | null;
  degradedBilling?: boolean;
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

export type TokenRangeKey = "30d" | "90d" | "365d";

export const TOKEN_RANGE_DAYS: Record<TokenRangeKey, number> = {
  "30d": 30,
  "90d": 90,
  "365d": 365,
};

export function formatDeNumber(n: number) {
  return n.toLocaleString("de-DE");
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
  if (typeof item.generation?.tokenCost === "number" && Number.isFinite(item.generation.tokenCost)) {
    return item.generation.tokenCost;
  }
  return calculateGenerationTokenCost({ resolution: item.resolution, variantCount: 1 });
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

  const points = [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, tokens]) => ({ date, tokens }));

  const total = points.reduce((sum, p) => sum + p.tokens, 0);
  return { points, total };
}

export function canOfferAllTokenRanges(media: DashboardHomeMediaItem[]) {
  if (media.length === 0) return false;
  const oldest = media.reduce((min, item) => {
    const t = new Date(item.createdAt).getTime();
    return Number.isFinite(t) && t < min ? t : min;
  }, Date.now());
  const spanDays = (Date.now() - oldest) / 86_400_000;
  return spanDays >= TOKEN_RANGE_DAYS["365d"];
}

export function buildChartPaths(points: { date: string; tokens: number }[], width = 720, height = 190) {
  if (points.length === 0) return { linePath: "", areaPath: "", labels: [] as string[] };

  const padX = 8;
  const padY = 12;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const maxTokens = Math.max(...points.map((p) => p.tokens), 1);

  const coords = points.map((p, i) => {
    const x = padX + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
    const y = padY + innerH - (p.tokens / maxTokens) * innerH;
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

  return { linePath, areaPath, labels, maxTokens };
}

export function missingBrandFields(settings: DashboardHomeSettings | null) {
  if (!settings || settings.brandProfileMode === "skip") return [] as string[];
  const missing: string[] = [];
  if (!settings.breweryName?.trim() && !settings.brandWebsiteUrl?.trim()) missing.push("Brauerei / Website");
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
  return Math.round((remaining / monthly) * 100);
}

export function tokensUsed(summary: DashboardHomeSummary | null, unlimited: boolean) {
  if (!summary || unlimited) return null;
  if (typeof summary.tokens.used === "number" && Number.isFinite(summary.tokens.used)) return summary.tokens.used;
  if (summary.tokens.monthly > 0) return Math.max(summary.tokens.monthly - summary.tokens.remaining, 0);
  return null;
}

export type PlanKey = SubscriptionPlanKey;
