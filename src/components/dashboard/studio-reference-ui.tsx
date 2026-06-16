"use client";

import Link from "next/link";
import React from "react";
import { cn } from "@/lib/utils";
import { StudioCard, StudioEyebrow, StudioStatCard, StudioStatGrid } from "@/components/studio/ui";
import { StudioIcon } from "@/components/studio/icons";
import { STUDIO_TOKENS, type StudioPalette } from "@/components/ui/dashboard-studio-shell";

export const STUDIO_LAYOUT = {
  padX: 40,
  contentPadding: "var(--gutter)",
  contentMaxWidth: 1180,
  gridMain: "1fr 300px",
  gridGap: 22,
} as const;

const T = STUDIO_TOKENS;

export function StudioPlaceholder({
  label,
  w = "100%",
  h = 180,
  tone = "cream",
  radius = 14,
}: {
  label: string;
  w?: number | string;
  h?: number;
  tone?: "cream" | "ink" | "amber" | "deep";
  radius?: number;
}) {
  const palettes = {
    cream: { bg: "#EAE3D5", line: "#D8CFBC", text: "#6E6557" },
    ink: { bg: "#22201C", line: "#2E2A24", text: "#9B9180" },
    amber: { bg: "#F4D8B4", line: "#ECC692", text: "#8B5A22" },
    deep: { bg: "#2E1F12", line: "#3A2818", text: "#B89572" },
  };
  const p = palettes[tone];
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: radius,
        position: "relative",
        overflow: "hidden",
        background: `repeating-linear-gradient(135deg, ${p.bg} 0 10px, ${p.line} 10px 11px)`,
        flexShrink: 0,
      }}
    >
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", justifyContent: "flex-start", padding: 12 }}>
        <span
          style={{
            fontFamily: T.mono,
            fontSize: 10,
            letterSpacing: 0.4,
            color: p.text,
            textTransform: "uppercase",
            background: "rgba(255,255,255,0.55)",
            padding: "4px 7px",
            borderRadius: 4,
            mixBlendMode: tone === "ink" || tone === "deep" ? "screen" : "normal",
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

export function StudioSectionHeader({
  eyebrow,
  title,
  action,
}: {
  P?: StudioPalette;
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div>
      <StudioEyebrow>{eyebrow}</StudioEyebrow>
      <div className="studio-section-header-wrap" style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16 }}>
        <h2
          className="studio-serif"
          style={{ fontSize: 28, fontWeight: 500, letterSpacing: -0.8, margin: 0, color: "var(--tx-0)", lineHeight: 1.1 }}
        >
          {title}
        </h2>
        {action}
      </div>
    </div>
  );
}

export function StudioMasthead({ P }: { P: StudioPalette }) {
  const now = new Date();
  const week = (() => {
    const date = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  })();
  const dateLabel = now.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const issue = String(now.getMonth() + 1).padStart(2, "0");

  return (
    <div
      className="studio-masthead"
      style={{
        padding: "12px 0 18px",
        borderBottom: `1px solid ${P.rule}`,
        fontFamily: T.mono,
        fontSize: 10.5,
        letterSpacing: 1.4,
        textTransform: "uppercase",
        color: P.ink3,
      }}
    >
      <span>EvGlab · Studio · Ausgabe №{issue}</span>
      <span className="studio-masthead-meta">
        <span>Kalenderwoche {week}</span>
        <span style={{ color: P.muted }}>·</span>
        <span style={{ textTransform: "capitalize" }}>{dateLabel}</span>
      </span>
      <span className="studio-masthead-status" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: T.amber }} />
        Alle Systeme online
      </span>
    </div>
  );
}

export function StudioDashboardHeader({
  P,
  greetingEyebrow,
  headline,
  remaining,
  monthly,
}: {
  P: StudioPalette;
  greetingEyebrow: string;
  headline: React.ReactNode;
  remaining: number;
  monthly: number;
}) {
  const tokenPct = monthly > 0 ? Math.min(100, (remaining / monthly) * 100) : 0;

  return (
    <div className="studio-dash-hero">
      <StudioEyebrow>{greetingEyebrow}</StudioEyebrow>
      <div className="studio-dash-hero-row">
        <h1 className="studio-dash-hero-title" style={{ color: P.ink }}>
          {headline}
        </h1>
        <div className="studio-dash-hero-tokens" style={{ flexShrink: 0, textAlign: "right" }}>
          <div
            style={{
              fontFamily: T.mono,
              fontSize: 10,
              letterSpacing: 1,
              textTransform: "uppercase",
              color: P.ink3,
              marginBottom: 6,
            }}
          >
            Tokens diesen Zyklus
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, justifyContent: "flex-end" }}>
            <span style={{ fontFamily: T.sans, fontSize: 36, fontWeight: 700, letterSpacing: -1, color: P.ink }}>
              {remaining.toLocaleString("de-DE")}
            </span>
            <span style={{ fontFamily: T.mono, fontSize: 12, color: P.ink3 }}>/ {monthly.toLocaleString("de-DE")}</span>
          </div>
          <div className="studio-token-bar" style={{ width: 200, height: 3, background: P.rule, borderRadius: 999, marginTop: 8, marginLeft: "auto", overflow: "hidden" }}>
            <div style={{ width: `${tokenPct}%`, height: "100%", background: T.amber }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export type StudioStat = {
  eyebrow: string;
  value: string;
  sub: string;
  delta: string;
  deltaDir: "up" | "down" | "flat";
  spark: number[];
  valueSuffix?: React.ReactNode;
};

function activityTagClass(tag: string): string {
  const t = tag.toLowerCase();
  if (t.includes("kampagne") || t.includes("campaign")) return "campaign";
  if (t.includes("social") || t.includes("post")) return "social";
  if (t.includes("team")) return "team";
  return "product";
}

const STAT_ICONS = ["coins", "image", "rocket", "users"] as const;
const STAT_TONES = ["acc", "ok", "blue", "purple"] as const;

export function StudioStatsRow({ stats }: { P?: StudioPalette; stats: StudioStat[] }) {
  return (
    <StudioStatGrid style={{ marginTop: 22, marginBottom: 22 }}>
      {stats.map((s, i) => (
        <StudioStatCard
          key={s.eyebrow}
          label={s.eyebrow}
          value={s.value}
          valueSuffix={s.valueSuffix}
          delta={s.delta}
          deltaDir={s.deltaDir}
          primary={i === 0}
          icon={<StudioIcon name={STAT_ICONS[i] ?? "coins"} size={16} />}
          iconTone={STAT_TONES[i] ?? "acc"}
        />
      ))}
    </StudioStatGrid>
  );
}

export type StudioActivityItem = {
  id: string;
  kind: "image" | "post" | "campaign" | "team";
  title: string;
  desc: string;
  time: string;
  user: string;
  tag: string;
  imageUrl?: string;
  tone?: "cream" | "ink" | "amber" | "deep";
};

function StudioActivityRow({ item }: { item: StudioActivityItem }) {
  const tagCls = activityTagClass(item.tag);
  return (
    <div className="studio-activity-row-compact">
      <div className="studio-activity-thumb-compact">
        {item.kind === "image" && item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <StudioIcon name={item.kind === "team" ? "users" : item.kind === "campaign" ? "rocket" : "image"} size={16} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="studio-activity-name">{item.title}</div>
        <div className="studio-activity-desc">{item.desc}</div>
      </div>
      <div className="studio-activity-meta">
        <span className="studio-activity-time">{item.time}</span>
        <span className={cn("studio-activity-tag", tagCls)}>{item.tag}</span>
      </div>
    </div>
  );
}

export function StudioActivityColumn({
  items,
  onShowAll,
}: {
  P?: StudioPalette;
  items: StudioActivityItem[];
  onShowAll?: () => void;
}) {
  return (
    <section>
      <div className="studio-section-header">
        <h2 className="studio-section-title">Letzte Aktivität</h2>
        {onShowAll ? (
          <button type="button" className="studio-section-link" onClick={onShowAll}>
            Alle anzeigen
          </button>
        ) : null}
      </div>
      <div className="studio-activity-list" style={{ marginTop: 4 }}>
        {items.length === 0 ? (
          <p className="studio-faint" style={{ padding: "20px 12px", fontSize: 13 }}>
            Noch keine Aktivität — starte in „Bilder Erstellen“.
          </p>
        ) : (
          items.map((it) => <StudioActivityRow key={it.id} item={it} />)
        )}
      </div>
    </section>
  );
}

export function StudioQuickActions({
  onTeam,
  hasActivePlan = true,
}: {
  P?: StudioPalette;
  onTeam: () => void;
  hasActivePlan?: boolean;
}) {
  type QuickAction =
    | { title: string; icon: string; href: string }
    | { title: string; icon: string; onClick: () => void };

  const createHref = hasActivePlan ? "/inhalte-erstellen" : "/inhalte-erstellen";

  const actions: QuickAction[] = [
    { title: "Social-Post erstellen", icon: "spark", href: createHref },
    { title: "Bild generieren", icon: "image", href: createHref },
    { title: "Team einladen", icon: "team", onClick: onTeam },
  ];

  return (
    <div>
      <div className="studio-sidebar-card-title">Schnellstart</div>
      <div className="studio-qa-list">
        {actions.map((a) => {
          const inner = (
            <>
              <span className="studio-qa-left">
                <span className="studio-qa-icon">
                  <StudioIcon name={a.icon} size={16} />
                </span>
                <span className="studio-qa-text">{a.title}</span>
              </span>
              <span className="studio-qa-arrow" aria-hidden="true">
                <StudioIcon name="chevR" size={14} />
              </span>
            </>
          );
          if ("href" in a) {
            return (
              <Link key={a.title} href={a.href} className="studio-qa-btn">
                {inner}
              </Link>
            );
          }
          return (
            <button key={a.title} type="button" className="studio-qa-btn" onClick={a.onClick}>
              {inner}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function StudioActivePlan({
  planLabel,
  hasActivePlan = true,
  remaining,
  monthly,
  onManagePlan,
}: {
  P?: StudioPalette;
  planLabel: string;
  hasActivePlan?: boolean;
  baseTokens: number;
  extraTokens: number;
  remaining: number;
  monthly: number;
  onManagePlan: () => void;
}) {
  const usedPct = monthly > 0 ? Math.min(100, Math.round(((monthly - remaining) / monthly) * 100)) : 0;
  const planTitle = hasActivePlan && planLabel.includes("Pro") ? (
    <>
      Brauerei <em>Pro</em>
    </>
  ) : (
    planLabel
  );

  return (
    <StudioCard pad className="studio-pop">
      <div className="studio-sidebar-card-title" style={{ marginBottom: 8 }}>
        Dein Tarif
      </div>
      <div className="studio-tarif-plan">{planTitle}</div>
      <div className="studio-tarif-tokens">
        {hasActivePlan
          ? `${remaining.toLocaleString("de-DE")} von ${monthly.toLocaleString("de-DE")} Tokens übrig`
          : "Wähle einen Tarif, um Tokens zu erhalten"}
      </div>
      {hasActivePlan ? (
        <>
          <div className="studio-token-bar-bg">
            <div className="studio-token-bar-fill" style={{ width: `${usedPct}%` }} />
          </div>
          <div className="studio-token-label">
            <span>Verbraucht</span>
            <span>{usedPct}%</span>
          </div>
        </>
      ) : null}
      <button type="button" className="studio-upgrade-btn" onClick={onManagePlan}>
        {hasActivePlan ? "Tarif verwalten" : "Tarif wählen"}
      </button>
    </StudioCard>
  );
}

export function StudioSideColumn({
  planLabel,
  hasActivePlan = true,
  baseTokens,
  extraTokens,
  remaining,
  monthly,
  onTeam,
  onManagePlan,
}: {
  P?: StudioPalette;
  planLabel: string;
  hasActivePlan?: boolean;
  baseTokens: number;
  extraTokens: number;
  remaining: number;
  monthly: number;
  onTeam: () => void;
  onManagePlan: () => void;
}) {
  return (
    <aside style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <StudioQuickActions onTeam={onTeam} hasActivePlan={hasActivePlan} />
      <StudioActivePlan
        planLabel={planLabel}
        hasActivePlan={hasActivePlan}
        baseTokens={baseTokens}
        extraTokens={extraTokens}
        remaining={remaining}
        monthly={monthly}
        onManagePlan={onManagePlan}
      />
    </aside>
  );
}
