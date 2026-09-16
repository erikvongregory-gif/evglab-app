"use client";

import "@/styles/studio-dashboard-home.css";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  StudioUiBadge,
  StudioUiButton,
  StudioUiCard,
  StudioUiSkeleton,
} from "@/components/studio/ui";
import { hasActiveSubscriptionFromState } from "@/lib/billing/access";
import {
  aggregateTokenUsage,
  aggregateTokenUsageFromDays,
  availableTokenRanges,
  brandProfileActiveFromSettings,
  brandStatusLabel,
  buildChartPaths,
  chartHasVariation,
  deriveChargesTotal,
  describeChargesTotalKpi,
  formatChartTextAlternative,
  formatCompactNumber,
  formatDashboardDate,
  formatDeNumber,
  formatPeriodEnd,
  formatRelativeTime,
  generationModeLabel,
  mediaRowTitle,
  missingBrandFields,
  planLabelFromKey,
  shouldShowTokenChart,
  TOKEN_RANGE_DAYS,
  tokenCostForMedia,
  tokensAvailablePct,
  tokensUsed,
  type DashboardHomeMediaItem,
  type DashboardHomeSettings,
  type DashboardHomeSummary,
  type TokenRangeKey,
} from "./dashboard-home-utils";
import { StudioIcon } from "@/components/studio/icons";
import { StudioOnboardingChecklist } from "@/components/studio/onboarding/onboarding-checklist";
import { BrewAiAssistantView } from "@/components/studio/hopfen-hugo-assistant";

type DashboardTab = "dashboard" | "media" | "team" | "brand" | "settings" | "pricing";

export type DashboardHomeViewProps = {
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

function KpiSkeleton() {
  return (
    <StudioUiCard padding="sm" className="stu-dash-home__enter stu-dash-home__kpi">
      <StudioUiSkeleton style={{ width: "56%", height: 9 }} />
      <StudioUiSkeleton style={{ width: "44%", height: 18, marginTop: 10 }} />
    </StudioUiCard>
  );
}

function BudgetRing({ pct }: { pct: number | null }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const dash = pct == null ? 0 : (pct / 100) * c;
  return (
    <div className="stu-dash-home__budget-ring" aria-hidden="true">
      <svg viewBox="0 0 104 104">
        <circle cx="52" cy="52" r={r} fill="none" stroke="var(--s3)" strokeWidth="8" />
        <circle
          cx="52"
          cy="52"
          r={r}
          fill="none"
          stroke="var(--ac)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
        />
      </svg>
      <div className="stu-dash-home__budget-ring-label">{pct == null ? "—" : `${pct}%`}</div>
    </div>
  );
}

export function DashboardHomeView({
  summary,
  summaryLoaded,
  summaryError,
  media,
  mediaLoaded,
  mediaError,
  settings,
  settingsLoaded,
  profileName,
  breweryName,
  brandProfileComplete,
  brandProfileMode,
  onOpenTab,
  onOpenBrandSetup,
  onRetrySummary,
  onRetryMedia,
}: DashboardHomeViewProps) {
  const [tokenRange, setTokenRange] = useState<TokenRangeKey>("30d");

  const brewery = breweryName || profileName || "deine Marke";
  const unlimited = Boolean(summary?.unlimited || summary?.tokens.unlimited);
  const billingDegraded = Boolean(summary?.degradedBilling);
  const billingUnknown = Boolean(summaryError) || billingDegraded;
  const usageDegraded = Boolean(summary?.degradedUsage);
  const remaining = billingUnknown ? null : (summary?.tokens.remaining ?? null);
  const monthly = summary?.tokens.monthly ?? 0;
  const hasActivePlan =
    unlimited ||
    (!billingUnknown && hasActiveSubscriptionFromState(summary?.plan, summary?.billingStatus));
  const createHref = billingUnknown
    ? null
    : hasActivePlan
      ? "/inhalte-erstellen"
      : "/dashboard?tab=pricing";
  const planLabel = billingUnknown
    ? "Abo-Status unbekannt"
    : planLabelFromKey(summary?.plan ?? null, unlimited);
  const periodEndLabel = formatPeriodEnd(summary?.periodEnd);
  const showBrandCallout =
    hasActivePlan && settingsLoaded && !brandProfileComplete && brandProfileMode !== "skip";

  /* One dominant primary CTA for the view */
  const primaryHref = billingUnknown
    ? null
    : !hasActivePlan
      ? "/dashboard?tab=pricing"
      : !brandProfileComplete && brandProfileMode !== "skip"
        ? null
        : "/inhalte-erstellen";
  const primaryLabel = billingUnknown
    ? null
    : !hasActivePlan
      ? "Tarif wählen"
      : !brandProfileComplete && brandProfileMode !== "skip"
        ? null
        : "Motiv generieren";

  const motifsThisMonth = summary?.postsThisMonth;
  const chargesTotal = summaryLoaded ? deriveChargesTotal(summary, media) : null;
  const chargesKpi = useMemo(() => describeChargesTotalKpi(summary, media), [summary, media]);
  const teamMembers = summary?.teamMembers;
  const openInvites = summary?.openInvites ?? 0;
  const availPct = remaining != null ? tokensAvailablePct(remaining, monthly, unlimited) : null;
  const usedTokens = tokensUsed(summary, unlimited);

  const sortedMedia = useMemo(
    () => [...media].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [media],
  );
  const recentGenerations = sortedMedia.slice(0, 8);

  const rangeKeys = availableTokenRanges(sortedMedia, summary?.tokenUsageByDay);
  const showRangeTabs = rangeKeys.length > 1;
  const activeRange = rangeKeys.includes(tokenRange) ? tokenRange : (rangeKeys[0] ?? "30d");
  const usageFromJobs = Array.isArray(summary?.tokenUsageByDay);
  const tokenSeries = useMemo(
    () =>
      usageFromJobs
        ? aggregateTokenUsageFromDays(summary?.tokenUsageByDay ?? [], activeRange)
        : aggregateTokenUsage(sortedMedia, activeRange),
    [usageFromJobs, summary?.tokenUsageByDay, sortedMedia, activeRange],
  );
  const chart = useMemo(() => buildChartPaths(tokenSeries.points), [tokenSeries.points]);
  const showChart = shouldShowTokenChart(tokenSeries.points);
  const chartAlt = formatChartTextAlternative(tokenSeries.points, tokenSeries.total, TOKEN_RANGE_DAYS[activeRange]);

  const brandMissing = missingBrandFields(settings);
  const brandActive = brandProfileActiveFromSettings(settings);
  const brandColors = settings?.brandColors
    ?.split(/[,;\n]+/)
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 6);

  const loadingKpis = !summaryLoaded;
  const loadingChart = usageFromJobs || usageDegraded ? !summaryLoaded : !mediaLoaded;
  const billingError =
    summaryError ||
    (billingDegraded ? "Abodaten konnten nicht geladen werden. Tarif und Tokens sind vorübergehend unbekannt." : null);

  return (
    <div className="stu-dash-home">
      <header className="stu-dash-home__head stu-dash-home__enter">
        <div style={{ minWidth: 0 }}>
          <h1 className="stu-dash-home__title">Dashboard</h1>
          <p className="stu-dash-home__sub" title={`${brewery} · ${formatDashboardDate()}`}>
            {brewery} · {formatDashboardDate()}
          </p>
        </div>
        <div className="stu-dash-home__actions">
          <StudioUiButton variant="secondary" size="sm" onClick={() => onOpenTab("media")} className="stu-dash-home__actions-secondary">
            Mediathek
          </StudioUiButton>
          {primaryHref && primaryLabel ? (
            <Link href={primaryHref} className="stu-btn stu-btn--primary stu-btn--sm" style={{ textDecoration: "none" }}>
              {primaryLabel}
            </Link>
          ) : showBrandCallout ? (
            <StudioUiButton type="button" variant="primary" size="sm" onClick={onOpenBrandSetup}>
              Markenprofil starten
            </StudioUiButton>
          ) : null}
        </div>
      </header>

      {showBrandCallout ? (
        <div className="stu-dash-home__callout stu-dash-home__enter" role="status">
          <div style={{ minWidth: 0 }}>
            <div className="stu-dash-home__callout-title">Nächster Schritt: Markenprofil</div>
            <p className="stu-dash-home__callout-sub">
              Website, Tonalität und Farben steuern alle Generierungen.
            </p>
          </div>
        </div>
      ) : null}

      {billingError ? (
        <StudioUiCard padding="md" className="stu-dash-home__enter">
          <p style={{ margin: 0, color: "var(--t2)", fontSize: 13 }}>{billingError}</p>
          {onRetrySummary ? (
            <StudioUiButton type="button" variant="secondary" size="sm" style={{ marginTop: 12 }} onClick={onRetrySummary}>
              Erneut laden
            </StudioUiButton>
          ) : null}
        </StudioUiCard>
      ) : null}

      <div className="stu-dash-home__kpi-grid" aria-busy={loadingKpis}>
        {loadingKpis ? (
          <>
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
          </>
        ) : (
          <>
            <StudioUiCard padding="sm" className="stu-dash-home__enter stu-dash-home__kpi">
              <div className="stu-dash-home__kpi-head">
                <span className="stu-dash-home__kpi-label">Tokens übrig</span>
                <span className="stu-dash-home__kpi-icon stu-dash-home__kpi-icon--accent" aria-hidden="true">
                  <StudioIcon name="bolt" size={13} />
                </span>
              </div>
              {unlimited ? (
                <>
                  <div className="stu-dash-home__kpi-value">∞</div>
                  <p className="stu-dash-home__kpi-meta">{planLabel}</p>
                </>
              ) : remaining != null && monthly > 0 ? (
                <>
                  <div className="stu-dash-home__kpi-value" title={`${formatDeNumber(remaining)} / ${formatDeNumber(monthly)}`}>
                    {formatCompactNumber(remaining)}
                    <span className="stu-dash-home__kpi-unit"> / {formatCompactNumber(monthly)}</span>
                  </div>
                  {availPct != null ? (
                    <span
                      className={`stu-dash-home__kpi-trend ${
                        availPct >= 40
                          ? "stu-dash-home__kpi-trend--up"
                          : availPct >= 15
                            ? "stu-dash-home__kpi-trend--neutral"
                            : "stu-dash-home__kpi-trend--down"
                      }`}
                    >
                      {availPct} % verfügbar
                    </span>
                  ) : null}
                  <p className="stu-dash-home__kpi-meta">
                    {periodEndLabel ? `Reset ${periodEndLabel}` : planLabel}
                  </p>
                </>
              ) : remaining != null ? (
                <>
                  <div className="stu-dash-home__kpi-value" title={formatDeNumber(remaining)}>
                    {formatCompactNumber(remaining)}
                  </div>
                  <p className="stu-dash-home__kpi-meta">{planLabel}</p>
                </>
              ) : (
                <>
                  <div className="stu-dash-home__kpi-value">—</div>
                  <p className="stu-dash-home__kpi-meta">Keine Daten</p>
                </>
              )}
            </StudioUiCard>

            <StudioUiCard padding="sm" className="stu-dash-home__enter stu-dash-home__kpi">
              <div className="stu-dash-home__kpi-head">
                <span className="stu-dash-home__kpi-label">Generierungen</span>
                <span className="stu-dash-home__kpi-icon" aria-hidden="true">
                  <StudioIcon name="sparkles" size={13} />
                </span>
              </div>
              <div
                className="stu-dash-home__kpi-value"
                title={motifsThisMonth != null ? formatDeNumber(motifsThisMonth) : undefined}
              >
                {motifsThisMonth != null ? formatCompactNumber(motifsThisMonth) : "—"}
              </div>
              <p className="stu-dash-home__kpi-meta">
                {motifsThisMonth == null && summaryLoaded ? "Nicht verfügbar" : "Dieser Monat"}
              </p>
            </StudioUiCard>

            <StudioUiCard padding="sm" className="stu-dash-home__enter stu-dash-home__kpi">
              <div className="stu-dash-home__kpi-head">
                <span className="stu-dash-home__kpi-label">{chargesKpi.label}</span>
                <span className="stu-dash-home__kpi-icon" aria-hidden="true">
                  <StudioIcon name="grid" size={13} />
                </span>
              </div>
              <div
                className="stu-dash-home__kpi-value"
                title={chargesTotal != null ? formatDeNumber(chargesTotal) : undefined}
              >
                {chargesTotal != null ? formatCompactNumber(chargesTotal) : "—"}
              </div>
              <p className="stu-dash-home__kpi-meta">{chargesKpi.subtitle}</p>
            </StudioUiCard>

            <StudioUiCard padding="sm" className="stu-dash-home__enter stu-dash-home__kpi">
              <div className="stu-dash-home__kpi-head">
                <span className="stu-dash-home__kpi-label">Teammitglieder</span>
                <span className="stu-dash-home__kpi-icon" aria-hidden="true">
                  <StudioIcon name="users" size={13} />
                </span>
              </div>
              <div
                className="stu-dash-home__kpi-value"
                title={teamMembers != null ? formatDeNumber(teamMembers) : undefined}
              >
                {teamMembers != null ? formatCompactNumber(teamMembers) : "—"}
              </div>
              <p className="stu-dash-home__kpi-meta">
                {openInvites > 0 ? `${openInvites} Einladung${openInvites === 1 ? "" : "en"} offen` : "Aktives Team"}
              </p>
            </StudioUiCard>
          </>
        )}
      </div>

      <div className="stu-dash-home__main-grid">
        <div className="stu-dash-home__stack">
          <StudioUiCard padding="md" className="stu-dash-home__enter stu-dash-home__chart-card">
            <div className="stu-dash-home__card-head">
              <div>
                <h2 className="stu-dash-home__card-title">Tokens pro Tag</h2>
                <p className="stu-dash-home__card-sub">
                  {usageDegraded
                    ? "Verbrauchsstatistik vorübergehend nicht verfügbar"
                    : usageFromJobs
                      ? "Täglicher Token-Verbrauch aus dem Generierungsverlauf"
                      : "Täglicher Token-Verbrauch aus der Mediathek"}
                </p>
              </div>
              {showRangeTabs ? (
                <div className="stu-dash-home__range-tabs" role="group" aria-label="Zeitraum">
                  {rangeKeys.map((key) => (
                    <button
                      key={key}
                      type="button"
                      className="stu-dash-home__range-btn"
                      aria-pressed={activeRange === key}
                      onClick={() => setTokenRange(key)}
                    >
                      {key === "30d" ? "30 Tage" : key === "90d" ? "3 Monate" : "12 Monate"}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="stu-dash-home__chart-legend">
              <div className="stu-dash-home__chart-legend-item">
                <span className="stu-dash-home__chart-legend-dot" />
                Tokens pro Tag
              </div>
              <div className="stu-dash-home__chart-total" aria-live="polite">
                {loadingChart
                  ? "…"
                  : usageDegraded
                    ? "Summe nicht verfügbar"
                    : `Summe: ${formatDeNumber(tokenSeries.total)} Tokens (${TOKEN_RANGE_DAYS[activeRange]} Tage)`}
              </div>
            </div>

            {loadingChart ? (
              <div className="stu-dash-home__chart-empty">
                <StudioUiSkeleton style={{ width: "100%", height: 160, borderRadius: 8 }} />
              </div>
            ) : usageDegraded ? (
              <div className="stu-dash-home__chart-empty" role="alert">
                <div>
                  <strong style={{ color: "var(--t1)", display: "block", marginBottom: 4, fontSize: 13 }}>
                    Verbrauch konnte nicht geladen werden
                  </strong>
                  <p style={{ margin: 0, color: "var(--t2)", fontSize: 12.5, lineHeight: 1.45 }}>
                    Die Generierungsstatistik ist vorübergehend nicht verfügbar. Gelöschte Motive bleiben
                    trotzdem in der Auswertung, sobald die Daten wieder geladen werden können.
                  </p>
                  {onRetrySummary ? (
                    <StudioUiButton type="button" variant="secondary" size="sm" style={{ marginTop: 12 }} onClick={onRetrySummary}>
                      Erneut laden
                    </StudioUiButton>
                  ) : null}
                </div>
              </div>
            ) : mediaError && !usageFromJobs ? (
              <div className="stu-dash-home__chart-empty" role="alert">
                <div>
                  <strong style={{ color: "var(--t1)", display: "block", marginBottom: 4, fontSize: 13 }}>
                    Verlauf konnte nicht geladen werden
                  </strong>
                  <p style={{ margin: 0, color: "var(--t2)", fontSize: 12.5, lineHeight: 1.45 }}>{mediaError}</p>
                  {onRetryMedia ? (
                    <StudioUiButton type="button" variant="secondary" size="sm" style={{ marginTop: 12 }} onClick={onRetryMedia}>
                      Erneut laden
                    </StudioUiButton>
                  ) : null}
                </div>
              </div>
            ) : !showChart ? (
              <div className="stu-dash-home__chart-empty" role="status">
                <div>
                  <strong style={{ color: "var(--t1)", display: "block", marginBottom: 4, fontSize: 13 }}>Noch kein Verlauf</strong>
                  <p style={{ margin: 0, color: "var(--t2)", fontSize: 12.5, lineHeight: 1.45 }}>
                    {billingUnknown
                      ? "Sobald die Abodaten wieder verfügbar sind, erscheint hier der Token-Verbrauch."
                      : hasActivePlan
                        ? "Nach der ersten Generierung erscheint hier der tägliche Token-Verbrauch."
                        : "Mit einem Tarif kannst du Motive erzeugen — danach siehst du hier den Verbrauch."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="stu-dash-home__chart-wrap">
                <svg
                  viewBox="0 0 720 190"
                  role="img"
                  aria-label={chartAlt}
                  style={{ width: "100%", height: "auto", display: "block" }}
                >
                  <defs>
                    <linearGradient id="stu-dash-area" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--ac)" stopOpacity="0.18" />
                      <stop offset="100%" stopColor="var(--ac)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {[12, 56, 100, 144].map((y) => (
                    <line key={y} x1="0" y1={y} x2="720" y2={y} stroke="var(--line)" strokeWidth="1" />
                  ))}
                  {tokenSeries.points.length === 1 ? (
                    <>
                      <rect
                        x={chart.coords[0]!.x - 6}
                        y={chart.coords[0]!.y}
                        width={12}
                        height={190 - 12 - chart.coords[0]!.y}
                        rx={3}
                        fill="url(#stu-dash-area)"
                      />
                      <circle cx={chart.coords[0]!.x} cy={chart.coords[0]!.y} r={4.5} fill="var(--ac)" />
                    </>
                  ) : (
                    <>
                      <path d={chart.areaPath} fill="url(#stu-dash-area)" />
                      <path
                        d={chart.linePath}
                        fill="none"
                        stroke="var(--ac)"
                        strokeWidth="2.2"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    </>
                  )}
                </svg>
                <div className="stu-dash-home__chart-axis" aria-hidden="true">
                  {chart.labels.map((label) => (
                    <span key={label}>{label}</span>
                  ))}
                </div>
                <p className="sr-only">{chartAlt}</p>
                {!chartHasVariation(tokenSeries.points) && tokenSeries.points.length > 1 ? (
                  <p className="stu-dash-home__chart-note" role="note">
                    Gleichbleibender Tagesverbrauch in diesem Zeitraum.
                  </p>
                ) : null}
              </div>
            )}
          </StudioUiCard>

          <StudioUiCard padding="none" className="stu-dash-home__enter">
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
              <div className="stu-dash-home__card-head">
                <div>
                  <h2 className="stu-dash-home__card-title">Letzte Generierungen</h2>
                  <p className="stu-dash-home__card-sub">
                    {mediaLoaded
                      ? `${recentGenerations.length} von ${sortedMedia.length} Einträgen`
                      : "Wird geladen …"}
                  </p>
                </div>
                <StudioUiButton variant="secondary" size="sm" onClick={() => onOpenTab("media")}>
                  Mediathek öffnen
                </StudioUiButton>
              </div>
            </div>

            {!mediaLoaded ? (
              <div style={{ padding: 20 }}>
                <StudioUiSkeleton style={{ width: "100%", height: 48, marginBottom: 8 }} />
                <StudioUiSkeleton style={{ width: "100%", height: 48, marginBottom: 8 }} />
                <StudioUiSkeleton style={{ width: "100%", height: 48 }} />
              </div>
            ) : mediaError ? (
              <div className="stu-dash-home__chart-empty" style={{ margin: 12 }} role="alert">
                <p style={{ margin: 0 }}>{mediaError}</p>
                {onRetryMedia ? (
                  <StudioUiButton type="button" variant="secondary" size="sm" style={{ marginTop: 12 }} onClick={onRetryMedia}>
                    Erneut laden
                  </StudioUiButton>
                ) : null}
              </div>
            ) : recentGenerations.length === 0 ? (
              <div className="stu-dash-home__chart-empty" style={{ margin: 12 }}>
                {createHref ? (
                  <>
                    Noch keine Generierungen.{" "}
                    <Link href={createHref} style={{ color: "var(--ac)" }}>
                      Erstes Motiv erstellen
                    </Link>
                  </>
                ) : (
                  <>Noch keine Generierungen. Tarifstatus konnte nicht geladen werden.</>
                )}
              </div>
            ) : (
              <>
                <div className="stu-dash-home__table-wrap">
                  <table className="stu-dash-home__table">
                    <caption className="sr-only">Letzte Generierungen</caption>
                    <thead>
                      <tr>
                        <th scope="col">Motiv</th>
                        <th scope="col">Typ</th>
                        <th scope="col">Format</th>
                        <th scope="col" style={{ textAlign: "right" }}>
                          Tokens
                        </th>
                        <th scope="col">Zeit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentGenerations.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <Link href={`/dashboard?tab=media`} style={{ color: "inherit", textDecoration: "none" }}>
                              {mediaRowTitle(item)}
                            </Link>
                          </td>
                          <td>{generationModeLabel(item.generation?.mode ?? null)}</td>
                          <td>
                            {item.resolution} · {item.aspectRatio}
                          </td>
                          <td style={{ textAlign: "right", fontFamily: "var(--f-mono)", fontSize: 12 }}>
                            {formatDeNumber(tokenCostForMedia(item))}
                          </td>
                          <td>{formatRelativeTime(item.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="stu-dash-home__mobile-list">
                  {recentGenerations.map((item) => (
                    <Link
                      key={item.id}
                      href="/dashboard?tab=media"
                      className="stu-dash-home__mobile-row"
                    >
                      <span className="stu-dash-home__mobile-row-title">{mediaRowTitle(item)}</span>
                      <span className="stu-dash-home__mobile-row-meta">
                        {generationModeLabel(item.generation?.mode ?? null)} · {item.resolution} ·{" "}
                        {formatDeNumber(tokenCostForMedia(item))} Tokens · {formatRelativeTime(item.createdAt)}
                      </span>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </StudioUiCard>
        </div>

        <div className="stu-dash-home__stack">
          <StudioUiCard padding="md" className="stu-dash-home__enter">
            <h2 className="stu-dash-home__card-title">Token-Budget</h2>
            <p className="stu-dash-home__card-sub">{planLabel}</p>
            {!summaryLoaded ? (
              <div style={{ marginTop: 18 }}>
                <StudioUiSkeleton style={{ width: 104, height: 104, borderRadius: "50%", margin: "0 auto" }} />
              </div>
            ) : unlimited ? (
              <>
                <BudgetRing pct={100} />
                <p className="stu-dash-home__kpi-meta" style={{ textAlign: "center", marginTop: 16 }}>
                  Unbegrenzte Tokens
                </p>
              </>
            ) : billingUnknown ? (
              <>
                <BudgetRing pct={null} />
                <p className="stu-dash-home__kpi-meta" style={{ textAlign: "center", marginTop: 16 }}>
                  Abodaten vorübergehend nicht verfügbar
                </p>
              </>
            ) : monthly > 0 && remaining != null ? (
              <>
                <BudgetRing pct={availPct} />
                <p className="stu-dash-home__kpi-meta" style={{ textAlign: "center", marginTop: 16 }}>
                  {formatDeNumber(remaining)} von {formatDeNumber(monthly)} übrig
                  {usedTokens != null ? ` · ${formatDeNumber(usedTokens)} verbraucht` : ""}
                </p>
              </>
            ) : (
              <>
                <BudgetRing pct={null} />
                <p className="stu-dash-home__kpi-meta" style={{ textAlign: "center", marginTop: 16 }}>
                  {hasActivePlan ? "Keine Planlimits verfügbar" : "Wähle einen Tarif für Tokens"}
                </p>
              </>
            )}
            <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
              {billingUnknown ? (
                <p className="stu-dash-home__kpi-meta" style={{ margin: 0, textAlign: "center" }}>
                  Tarifstatus konnte nicht geladen werden.
                </p>
              ) : hasActivePlan ? (
                <StudioUiButton variant="secondary" size="sm" onClick={() => onOpenTab("pricing")}>
                  Tarif verwalten
                </StudioUiButton>
              ) : (
                <p className="stu-dash-home__kpi-meta" style={{ margin: 0, textAlign: "center" }}>
                  Tarif oben wählen, um Tokens freizuschalten.
                </p>
              )}
            </div>
          </StudioUiCard>

          <StudioOnboardingChecklist placement="inline" />

          <StudioUiCard padding="md" className="stu-dash-home__enter">
            <div className="stu-dash-home__card-head">
              <div>
                <h2 className="stu-dash-home__card-title">Markenprofil</h2>
                <p className="stu-dash-home__card-sub">Status und Stilmerkmale</p>
              </div>
              <StudioUiBadge tone={brandActive ? "success" : brandProfileComplete ? "neutral" : "warning"}>
                {settingsLoaded ? brandStatusLabel(brandProfileComplete, settings) : "…"}
              </StudioUiBadge>
            </div>
            {!settingsLoaded ? (
              <div style={{ marginTop: 12 }}>
                <StudioUiSkeleton style={{ width: "80%", height: 12 }} />
                <StudioUiSkeleton style={{ width: "60%", height: 12, marginTop: 8 }} />
              </div>
            ) : brandProfileMode === "skip" ? (
              <p className="stu-dash-home__kpi-meta" style={{ marginTop: 12 }}>
                Markenprofil bewusst deaktiviert.
              </p>
            ) : brandProfileComplete ? (
              <>
                {settings?.brandTone ? (
                  <p className="stu-dash-home__kpi-meta" style={{ marginTop: 12 }}>
                    Tonalität: {settings.brandTone}
                  </p>
                ) : null}
                {brandColors && brandColors.length > 0 ? (
                  <div className="stu-dash-home__brand-colors" aria-label="Markenfarben">
                    {brandColors.map((color) => (
                      <span
                        key={color}
                        className="stu-dash-home__brand-swatch"
                        style={{ background: color.startsWith("#") || color.startsWith("rgb") ? color : undefined }}
                        title={color}
                      />
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <p className="stu-dash-home__kpi-meta" style={{ marginTop: 12 }}>
                {brandMissing.length > 0
                  ? `Fehlt: ${brandMissing.join(", ")}`
                  : "Profil noch nicht vollständig"}
              </p>
            )}
            {showBrandCallout ? null : (
              <div style={{ marginTop: 16 }}>
                <StudioUiButton
                  variant={brandProfileComplete ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => onOpenTab("brand")}
                >
                  Markenprofil öffnen
                </StudioUiButton>
              </div>
            )}
          </StudioUiCard>

          {teamMembers != null && teamMembers > 0 ? (
            <StudioUiCard padding="md" className="stu-dash-home__enter">
              <h2 className="stu-dash-home__card-title">Team</h2>
              <p className="stu-dash-home__kpi-meta" style={{ marginTop: 8 }}>
                {formatDeNumber(teamMembers)} Mitglieder
                {openInvites > 0 ? ` · ${openInvites} Einladung${openInvites === 1 ? "" : "en"} offen` : ""}
              </p>
              <div style={{ marginTop: 16 }}>
                <StudioUiButton variant="secondary" size="sm" onClick={() => onOpenTab("team")}>
                  Team verwalten
                </StudioUiButton>
              </div>
            </StudioUiCard>
          ) : null}

          <StudioUiCard padding="md" className="stu-dash-home__enter">
            <h2 className="stu-dash-home__card-title">Schnellaktionen</h2>
            <div className="stu-dash-home__quick-list" style={{ marginTop: 10 }}>
              {hasActivePlan ? (
                <Link href="/inhalte-erstellen" className="stu-dash-home__quick-item">
                  Motiv generieren
                </Link>
              ) : null}
              <button type="button" className="stu-dash-home__quick-item" onClick={() => onOpenTab("media")}>
                Mediathek öffnen
              </button>
              <button type="button" className="stu-dash-home__quick-item" onClick={() => onOpenTab("brand")}>
                Markenprofil bearbeiten
              </button>
              {teamMembers != null ? (
                <button type="button" className="stu-dash-home__quick-item" onClick={() => onOpenTab("team")}>
                  Team verwalten
                </button>
              ) : null}
            </div>
          </StudioUiCard>
        </div>

        <aside className="stu-dash-home__assistant stu-dash-home__enter" aria-label="BrewAI Assistent">
          <BrewAiAssistantView variant="column" />
        </aside>
      </div>
    </div>
  );
}
