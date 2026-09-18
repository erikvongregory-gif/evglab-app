"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  XAxis,
} from "recharts";
import {
  Coins,
  FolderOpen,
  ImageIcon,
  Palette,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  aggregateTokenUsageFromDays,
  brandStatusLabel,
  formatCompactNumber,
  formatDeNumber,
  formatPeriodEnd,
  formatRelativeTime,
  mediaRowTitle,
  planLabelFromKey,
  TOKEN_RANGE_DAYS,
  TOKEN_RANGE_LABELS,
  tokensAvailablePct,
  tokensUsed,
  type DashboardHomeMediaItem,
  type DashboardHomeSettings,
  type DashboardHomeSummary,
  type TokenRangeKey,
} from "@/components/studio/dashboard/dashboard-home-utils";
import { hasActiveSubscriptionFromState } from "@/lib/billing/access";

type DashboardTab = "dashboard" | "media" | "team" | "brand" | "settings" | "pricing";

export type AdminHomeViewProps = {
  summary: DashboardHomeSummary | null;
  summaryLoaded: boolean;
  summaryError?: string | null;
  media: DashboardHomeMediaItem[];
  mediaLoaded: boolean;
  mediaError?: string | null;
  settings: DashboardHomeSettings | null;
  settingsLoaded: boolean;
  profileName: string;
  breweryName: string;
  brandProfileComplete: boolean;
  brandProfileMode: DashboardHomeSettings["brandProfileMode"];
  onOpenTab: (tab: DashboardTab) => void;
  onOpenBrandSetup: () => void;
  onRetrySummary?: () => void;
  onRetryMedia?: () => void;
};

const chartConfig = {
  tokens: {
    label: "Tokens",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

function MetricCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Skeleton className="size-7 rounded-lg" />
        </CardTitle>
        <CardDescription>
          <Skeleton className="h-4 w-24" />
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-4 w-40" />
      </CardContent>
    </Card>
  );
}

function BrewAiMetricCards({
  summary,
  summaryLoaded,
  summaryError,
  settings,
  settingsLoaded,
  brandProfileComplete,
  brandProfileMode,
  onRetrySummary,
}: {
  summary: DashboardHomeSummary | null;
  summaryLoaded: boolean;
  summaryError?: string | null;
  settings: DashboardHomeSettings | null;
  settingsLoaded: boolean;
  brandProfileComplete: boolean;
  brandProfileMode: DashboardHomeSettings["brandProfileMode"];
  onRetrySummary?: () => void;
}) {
  if (!summaryLoaded) {
    return (
      <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs xl:grid-cols-4 dark:*:data-[slot=card]:bg-card">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>
    );
  }

  if (summaryError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="leading-none">Kennzahlen</CardTitle>
          <CardDescription className="text-destructive">{summaryError}</CardDescription>
          {onRetrySummary ? (
            <CardAction>
              <Button variant="outline" size="sm" onClick={onRetrySummary}>
                Erneut laden
              </Button>
            </CardAction>
          ) : null}
        </CardHeader>
      </Card>
    );
  }

  const unlimited = Boolean(summary?.unlimited || summary?.tokens.unlimited);
  const remaining = summary?.tokens.remaining ?? 0;
  const monthly = summary?.tokens.monthly ?? 0;
  const used = tokensUsed(summary, unlimited);
  const availablePct = tokensAvailablePct(remaining, monthly, unlimited);
  const planLabel = planLabelFromKey(summary?.plan ?? null, unlimited);
  const periodEnd = formatPeriodEnd(summary?.periodEnd);
  const hasPlan =
    unlimited ||
    (!summary?.degradedBilling &&
      (hasActiveSubscriptionFromState(summary?.plan, summary?.billingStatus) ||
        (summary?.tokens.remaining ?? 0) > 0));
  const brandLabel = settingsLoaded
    ? brandStatusLabel(brandProfileComplete, settings)
    : "—";

  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:origin-center *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs *:data-[slot=card]:transition-[transform,box-shadow,ring-color] *:data-[slot=card]:duration-700 *:data-[slot=card]:ease-[cubic-bezier(0.22,1,0.36,1)] *:data-[slot=card]:hover:scale-[1.02] *:data-[slot=card]:hover:shadow-sm *:data-[slot=card]:hover:ring-foreground/15 motion-reduce:*:data-[slot=card]:transition-none motion-reduce:*:data-[slot=card]:hover:scale-100 xl:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex size-7 items-center justify-center rounded-lg border bg-muted text-muted-foreground transition-colors duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/card:border-foreground/15 group-hover/card:bg-background group-hover/card:text-foreground">
              <Coins className="size-4" />
            </div>
          </CardTitle>
          <CardDescription>Tokens verfügbar</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-medium text-3xl tabular-nums leading-none tracking-tight">
              {unlimited ? "∞" : formatCompactNumber(remaining)}
            </div>
            {availablePct != null ? <Badge variant="secondary">{Math.round(availablePct)}% frei</Badge> : null}
          </div>
          <p className="text-muted-foreground text-sm">
            {unlimited
              ? "Unbegrenztes Kontingent"
              : `${formatDeNumber(used ?? 0)} von ${formatDeNumber(monthly)} verbraucht`}
            {periodEnd ? ` · bis ${periodEnd}` : ""}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex size-7 items-center justify-center rounded-lg border bg-muted text-muted-foreground transition-colors duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/card:border-foreground/15 group-hover/card:bg-background group-hover/card:text-foreground">
              <FolderOpen className="size-4" />
            </div>
          </CardTitle>
          <CardDescription>Assets diesen Monat</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-medium text-3xl tabular-nums leading-none tracking-tight">
              {summary?.postsThisMonth == null ? "—" : formatDeNumber(summary.postsThisMonth)}
            </div>
          </div>
          <p className="text-muted-foreground text-sm">
            {summary?.chargesTotal != null
              ? `${formatDeNumber(summary.chargesTotal)} Gesamtabbuchungen`
              : "Generierte Motive im laufenden Zeitraum"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex size-7 items-center justify-center rounded-lg border bg-muted text-muted-foreground transition-colors duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/card:border-foreground/15 group-hover/card:bg-background group-hover/card:text-foreground">
              <Users className="size-4" />
            </div>
          </CardTitle>
          <CardDescription>Team</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-medium text-3xl tabular-nums leading-none tracking-tight">
              {formatDeNumber(summary?.teamMembers ?? 0)}
            </div>
            {(summary?.openInvites ?? 0) > 0 ? (
              <Badge variant="secondary">{summary?.openInvites} offen</Badge>
            ) : null}
          </div>
          <p className="text-muted-foreground text-sm">Aktive Mitglieder und Einladungen</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex size-7 items-center justify-center rounded-lg border bg-muted text-muted-foreground transition-colors duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/card:border-foreground/15 group-hover/card:bg-background group-hover/card:text-foreground">
              <Palette className="size-4" />
            </div>
          </CardTitle>
          <CardDescription>Tarif & Marke</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-medium text-3xl leading-none tracking-tight">{planLabel}</div>
            <Badge variant={hasPlan ? "default" : "outline"}>{hasPlan ? "Aktiv" : "Kein Abo"}</Badge>
          </div>
          <p className="text-muted-foreground text-sm">Marke: {brandLabel}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function BrewAiActivityOverview({
  summary,
  summaryLoaded,
  onOpenMedia,
}: {
  summary: DashboardHomeSummary | null;
  summaryLoaded: boolean;
  onOpenMedia: () => void;
}) {
  const [range, setRange] = useState<TokenRangeKey>("7d");
  const rangeDays = TOKEN_RANGE_DAYS[range];

  const chartData = useMemo(() => {
    const days = summary?.tokenUsageByDay ?? [];
    if (days.length === 0) return [];
    return aggregateTokenUsageFromDays(days, range).points;
  }, [summary?.tokenUsageByDay, range]);

  const hasData = chartData.some((point) => point.tokens > 0);

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle className="leading-none">Token-Aktivität</CardTitle>
        <CardDescription>
          <span className="@[540px]/card:block hidden">
            {summary?.unlimited || summary?.tokens.unlimited
              ? `Nominalverbrauch (ohne Abbuchung) · letzte ${rangeDays} Tage`
              : `Verbrauch aus Generierungen der letzten ${rangeDays} Tage`}
          </span>
          <span className="@[540px]/card:hidden">Letzte {rangeDays} Tage</span>
        </CardDescription>
        <CardAction className="flex items-center gap-2">
          <Select value={range} onValueChange={(v) => setRange(v as TokenRangeKey)}>
            <SelectTrigger size="sm" className="w-32">
              <SelectValue placeholder="Zeitraum" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Zeitraum</SelectLabel>
                {(Object.keys(TOKEN_RANGE_LABELS) as TokenRangeKey[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {TOKEN_RANGE_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={onOpenMedia}>
            Zur Mediathek
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent>
        {!summaryLoaded ? (
          <Skeleton className="h-80 w-full rounded-lg" />
        ) : !hasData ? (
          <div className="flex h-80 w-full items-center justify-center rounded-lg bg-muted/40">
            <p className="text-muted-foreground text-sm">
              Noch keine Token-Nutzung in diesem Zeitraum vorhanden.
            </p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-80 w-full">
            <ComposedChart data={chartData} margin={{ top: 0 }}>
              <defs>
                <linearGradient id="fillTokens" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-tokens)" stopOpacity={0.36} />
                  <stop offset="95%" stopColor="var(--color-tokens)" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeOpacity={0.5} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={48}
                tickFormatter={(value) =>
                  parseISO(value).toLocaleDateString("de-DE", {
                    month: "short",
                    day: "numeric",
                  })
                }
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    className="w-50"
                    indicator="line"
                    labelFormatter={(value) => format(parseISO(String(value)), "d. MMMM yyyy", { locale: de })}
                  />
                }
              />
              <ChartLegend verticalAlign="top" content={<ChartLegendContent className="mb-5 justify-end" />} />
              <Area
                dataKey="tokens"
                type="natural"
                fill="url(#fillTokens)"
                stroke="var(--color-tokens)"
                strokeWidth={1.25}
                dot={false}
                fillOpacity={1}
              />
            </ComposedChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

function BrewAiAssetsOverview({
  media,
  mediaLoaded,
  mediaError,
  onRetryMedia,
  onOpenMedia,
}: {
  media: DashboardHomeMediaItem[];
  mediaLoaded: boolean;
  mediaError?: string | null;
  onRetryMedia?: () => void;
  onOpenMedia: () => void;
}) {
  const [query, setQuery] = useState("");
  const [resolution, setResolution] = useState<"all" | "1K" | "2K" | "4K">("all");

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return media.filter((item) => {
      if (resolution !== "all" && item.resolution !== resolution) return false;
      if (!needle) return true;
      return mediaRowTitle(item).toLowerCase().includes(needle) || item.prompt.toLowerCase().includes(needle);
    });
  }, [media, query, resolution]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="leading-none">
          {mediaLoaded ? `${formatDeNumber(media.length)} Assets` : "Assets"}
        </CardTitle>
        <CardDescription>Motive aus der Mediathek mit Format, Auflösung und Erstellungszeit.</CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" onClick={onOpenMedia}>
            Zur Mediathek
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Assets suchen…"
            className="max-w-sm"
          />
          <Select value={resolution} onValueChange={(v) => setResolution(v as typeof resolution)}>
            <SelectTrigger size="sm" className="w-36">
              <SelectValue placeholder="Auflösung" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Auflösung</SelectLabel>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="1K">1K</SelectItem>
                <SelectItem value="2K">2K</SelectItem>
                <SelectItem value="4K">4K</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {!mediaLoaded ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : mediaError ? (
          <div className="flex h-40 flex-col items-center justify-center gap-3 rounded-lg bg-muted/40">
            <p className="text-destructive text-sm">{mediaError}</p>
            {onRetryMedia ? (
              <Button variant="outline" size="sm" onClick={onRetryMedia}>
                Erneut laden
              </Button>
            ) : null}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-lg bg-muted/40">
            <ImageIcon className="size-5 text-muted-foreground" />
            <p className="text-muted-foreground text-sm">
              {media.length === 0 ? "Noch keine Assets vorhanden." : "Keine Assets passen zur Suche."}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden">
            <Table>
              <TableHeader className="[&_tr]:border-0">
                <TableRow className="border-0 hover:bg-transparent">
                  <TableHead>Motiv</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Auflösung</TableHead>
                  <TableHead className="text-right">Erstellt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="[&_tr]:border-0">
                {rows.slice(0, 10).map((item) => (
                  <TableRow key={item.id} className="border-0">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="flex size-8 items-center justify-center overflow-hidden rounded-md bg-muted">
                          {item.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.imageUrl} alt="" className="size-full object-cover" />
                          ) : (
                            <ImageIcon className="size-4 text-muted-foreground" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-sm leading-none">{mediaRowTitle(item)}</div>
                          <div className="truncate text-muted-foreground text-xs leading-none">#{item.id.slice(0, 8)}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{item.aspectRatio}</Badge>
                    </TableCell>
                    <TableCell>{item.resolution}</TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">
                      {formatRelativeTime(item.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AdminHomeView({
  summary,
  summaryLoaded,
  summaryError,
  media,
  mediaLoaded,
  mediaError,
  settings,
  settingsLoaded,
  brandProfileComplete,
  brandProfileMode,
  onOpenTab,
  onRetrySummary,
  onRetryMedia,
}: AdminHomeViewProps) {
  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      <BrewAiMetricCards
        summary={summary}
        summaryLoaded={summaryLoaded}
        summaryError={summaryError}
        settings={settings}
        settingsLoaded={settingsLoaded}
        brandProfileComplete={brandProfileComplete}
        brandProfileMode={brandProfileMode}
        onRetrySummary={onRetrySummary}
      />
      <BrewAiActivityOverview
        summary={summary}
        summaryLoaded={summaryLoaded}
        onOpenMedia={() => onOpenTab("media")}
      />
      <BrewAiAssetsOverview
        media={media}
        mediaLoaded={mediaLoaded}
        mediaError={mediaError}
        onRetryMedia={onRetryMedia}
        onOpenMedia={() => onOpenTab("media")}
      />
    </div>
  );
}
