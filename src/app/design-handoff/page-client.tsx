"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  DashboardStudioShell,
  STUDIO_TOKENS,
  useStudioPalette,
  type StudioNavKey,
} from "@/components/ui/dashboard-studio-shell";
import { DashboardHomeView } from "@/components/studio/dashboard/dashboard-home-view";
import type { DashboardHomeMediaItem, DashboardHomeSettings, DashboardHomeSummary } from "@/components/studio/dashboard/dashboard-home-utils";
import { StudioButton, StudioPageHeader } from "@/components/studio/ui";
import { StudioPricingView } from "@/components/studio/studio-pricing-view";
import { CreateVideosComingSoonView } from "@/components/studio/create-videos-coming-soon-view";
import { CreateContentLockedView } from "@/components/studio/create-content-locked-view";
import { BrandProfileView } from "@/components/dashboard/BrandProfileView";
import { TokenBadgeStatesDemo } from "@/components/studio/token-badge-states-demo";
import { StudioIcon } from "@/components/studio/icons";

type ScreenId =
  | "dashboard"
  | "dashboard-incomplete"
  | "dashboard-empty"
  | "media"
  | "team"
  | "brand"
  | "settings"
  | "pricing"
  | "create-start"
  | "create-locked"
  | "videos"
  | "brand-empty"
  | "token-badge";

const SCREENS: Record<
  ScreenId,
  { nav: StudioNavKey; breadcrumb: string; title: string }
> = {
  dashboard: { nav: "dashboard", breadcrumb: "Dashboard", title: "Übersicht" },
  "dashboard-incomplete": { nav: "dashboard", breadcrumb: "Dashboard", title: "Dashboard · Markenprofil offen" },
  "dashboard-empty": { nav: "dashboard", breadcrumb: "Dashboard", title: "Dashboard · Leer" },
  media: { nav: "media", breadcrumb: "Mediathek", title: "Mediathek" },
  team: { nav: "team", breadcrumb: "Team", title: "Team" },
  brand: { nav: "brand", breadcrumb: "Markenprofil", title: "Markenprofil" },
  "brand-empty": { nav: "brand", breadcrumb: "Markenprofil", title: "Markenprofil (leer)" },
  settings: { nav: "settings", breadcrumb: "Einstellungen", title: "Einstellungen" },
  pricing: { nav: "pricing", breadcrumb: "Abonnement", title: "Abonnement" },
  "create-start": { nav: "create", breadcrumb: "Bilder Erstellen", title: "Bilder Erstellen · Composer" },
  "create-locked": { nav: "create", breadcrumb: "Bilder Erstellen", title: "Bilder Erstellen · Locked" },
  videos: { nav: "create-video", breadcrumb: "Videos Erstellen", title: "Videos Erstellen" },
  "token-badge": { nav: "dashboard", breadcrumb: "Token-Badge", title: "Token-Badge · Zustände" },
};

const MOCK_DASHBOARD_SUMMARY: DashboardHomeSummary = {
  tokens: { monthly: 1600, used: 360, remaining: 1240 },
  periodEnd: new Date(Date.now() + 1000 * 60 * 60 * 24 * 4).toISOString(),
  postsThisMonth: 12,
  chargesTotal: 8,
  teamMembers: 3,
  openInvites: 1,
  billingStatus: "active",
  plan: "pro",
};

const MOCK_DAILY_TOKEN_COSTS = [45, 30, 60, 25, 50, 35, 55, 40];

const MOCK_DASHBOARD_MEDIA: DashboardHomeMediaItem[] = Array.from({ length: 8 }).map((_, i) => ({
  id: `gen-${i + 1}`,
  imageUrl: "",
  title: ["Sommerfest-Motiv", "Oktoberfest Teaser", "Helles Hero", "Maßkrug Close-up"][i % 4] ?? `Motiv ${i + 1}`,
  prompt: "Prompt",
  createdAt: new Date(Date.now() - i * 1000 * 60 * 60 * 24 * 4).toISOString(),
  aspectRatio: i % 2 === 0 ? "1:1" : "4:5",
  resolution: "2K" as const,
  generation: {
    mode: (["hyperreal", "campaign", "studio", "isolate"] as const)[i % 4],
    tokenCost: MOCK_DAILY_TOKEN_COSTS[i] ?? 35,
    chargeNumber: 8 - i,
  },
}));

const MOCK_DASHBOARD_SETTINGS_COMPLETE: DashboardHomeSettings = {
  brandProfileMode: "guided",
  breweryName: "Beispielbrauerei",
  brandWebsiteUrl: "https://beispielbrauerei.de",
  brandTone: "handwerklich, warm, modern, regional",
  brandColors: "#C7691E, #1A1816, #F4F1EC",
  brandDos: "Natürliches Licht",
  brandDonts: "Stock-Look",
  brandLockLevel: "balanced",
};

const MOCK_DASHBOARD_SETTINGS_INCOMPLETE: DashboardHomeSettings = {
  brandProfileMode: "guided",
  breweryName: "Beispielbrauerei",
  brandWebsiteUrl: "",
  brandTone: "",
  brandColors: "",
  brandDos: "",
  brandDonts: "",
  brandLockLevel: "balanced",
};

const MOCK_MEDIA = [
  { id: "m1", title: "Helles am Tresen", label: "1:1 · 2K" },
  { id: "m2", title: "Biergarten Abend", label: "4:5 · 2K" },
  { id: "m3", title: "Flaschen-Hero", label: "9:16 · 1K" },
  { id: "m4", title: "Public Viewing", label: "16:9 · 2K" },
  { id: "m5", title: "Winterbier", label: "1:1 · 2K" },
  { id: "m6", title: "Gastro Promo", label: "4:5 · 2K" },
];

const MOCK_BRAND = {
  brandProfileMode: "guided" as const,
  brandInstagramUrl: "https://instagram.com/beispielbrauerei",
  brandWebsiteUrl: "https://beispielbrauerei.de",
  brandProfileSource: "url" as const,
  brandLockLevel: "balanced" as const,
  breweryName: "Beispielbrauerei",
  brandTone: "handwerklich, warm, modern, regional",
  brandColors: "#C7691E, #1A1816, #F4F1EC, #3D5A40",
  brandDos: "Natürliches Licht; Flasche im Fokus; echte Materialien",
  brandDonts: "Stock-Look; Neon; überladene Typografie",
  brandReferenceImageUrls: [] as string[],
  brandAnalyzedAt: new Date().toISOString(),
};

function isScreenId(value: string | null): value is ScreenId {
  return !!value && value in SCREENS;
}

export default function DesignHandoffPage() {
  const searchParams = useSearchParams();
  const screenParam = searchParams.get("screen");
  const screen: ScreenId = isScreenId(screenParam) ? screenParam : "dashboard";
  const meta = SCREENS[screen];
  const P = useStudioPalette();

  const content = useMemo(() => {
    switch (screen) {
      case "dashboard":
      case "dashboard-incomplete":
      case "dashboard-empty":
        return (
          <DashboardHomeView
            summary={
              screen === "dashboard-empty"
                ? {
                    tokens: { monthly: 1600, used: 0, remaining: 1600 },
                    postsThisMonth: 0,
                    chargesTotal: 0,
                    teamMembers: 1,
                    openInvites: 0,
                    billingStatus: "active",
                    plan: "pro",
                  }
                : MOCK_DASHBOARD_SUMMARY
            }
            summaryLoaded
            media={screen === "dashboard-empty" ? [] : MOCK_DASHBOARD_MEDIA}
            mediaLoaded
            settings={
              screen === "dashboard-incomplete"
                ? MOCK_DASHBOARD_SETTINGS_INCOMPLETE
                : screen === "dashboard-empty"
                  ? { ...MOCK_DASHBOARD_SETTINGS_INCOMPLETE, brandProfileMode: "undecided" }
                  : MOCK_DASHBOARD_SETTINGS_COMPLETE
            }
            settingsLoaded
            profileName="Erik"
            breweryName="Beispielbrauerei"
            brandProfileComplete={screen === "dashboard"}
            brandProfileMode={
              screen === "dashboard-incomplete"
                ? "guided"
                : screen === "dashboard-empty"
                  ? "undecided"
                  : "guided"
            }
            onOpenTab={() => undefined}
            onOpenBrandSetup={() => undefined}
          />
        );
      case "media":
        return (
          <>
            <StudioPageHeader
              eyebrow="Mediathek"
              title="Deine Motive"
              subtitle="12 Dateien · Suche, Vorschau und Download"
            />
            <div style={{ marginTop: 18, display: "flex", gap: 10, alignItems: "center" }}>
              <input
                className="studio-field"
                defaultValue=""
                placeholder="Motive durchsuchen…"
                style={{ flex: 1, maxWidth: 360 }}
                readOnly
              />
              <StudioButton href="/inhalte-erstellen" variant="primary" size="sm">
                Neu erstellen
              </StudioButton>
            </div>
            <div className="studio-media-grid" style={{ marginTop: 22 }}>
              {MOCK_MEDIA.map((item) => (
                <div
                  key={item.id}
                  className="studio-media-card"
                  style={{
                    borderRadius: 16,
                    overflow: "hidden",
                    border: "1px solid var(--line)",
                    background: "var(--bg-2)",
                  }}
                >
                  <div
                    style={{
                      aspectRatio: "1 / 1",
                      background:
                        "linear-gradient(145deg, #3a2a1c 0%, #1a1816 55%, #2a2218 100%)",
                      display: "grid",
                      placeItems: "center",
                      color: "var(--fg-5)",
                      fontFamily: "var(--studio-mono)",
                      fontSize: 11,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                    }}
                  >
                    Preview
                  </div>
                  <div style={{ padding: "12px 14px" }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{item.title}</div>
                    <div className="studio-faint" style={{ marginTop: 4, fontSize: 12 }}>
                      {item.label}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        );
      case "team":
        return (
          <>
            <StudioPageHeader
              eyebrow="Team"
              title="Gemeinsam arbeiten"
              subtitle="Lade Kolleg:innen ein und verwalte Rollen."
            />
            <div className="studio-team-invite-grid" style={{ marginTop: 22 }}>
              <input className="studio-field" placeholder="name@brauerei.de" defaultValue="" readOnly />
              <select className="studio-field" defaultValue="editor" disabled>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
                <option value="viewer">Viewer</option>
              </select>
              <button type="button" className="studio-team-invite-submit">
                Einladen
              </button>
            </div>
            <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { name: "Erik von Gregory", email: "erik@beispielbrauerei.de", role: "Owner" },
                { name: "Lisa Müller", email: "lisa@beispielbrauerei.de", role: "Editor" },
                { name: "Tom Weber", email: "tom@beispielbrauerei.de", role: "Viewer" },
              ].map((m) => (
                <div
                  key={m.email}
                  className="studio-team-member-row"
                  style={{
                    background: P.surface2,
                    border: `1px solid ${P.rule}`,
                    borderRadius: 14,
                    padding: 14,
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 650, fontSize: 14 }}>{m.name}</div>
                    <div className="studio-faint" style={{ fontSize: 12.5, marginTop: 2 }}>
                      {m.email}
                    </div>
                  </div>
                  <span className="evg-mono" style={{ fontSize: 11, color: "var(--fg-4)", letterSpacing: "0.06em", textTransform: "uppercase" }}>{m.role}</span>
                </div>
              ))}
            </div>
          </>
        );
      case "brand":
        return (
          <BrandProfileView
            value={MOCK_BRAND}
            loaded
            loadError={null}
            brandProfileComplete
            brandProfileNotice=""
            onOpenBrandSetup={() => undefined}
            onSkipBrandProfile={() => undefined}
            onResetBrandProfile={() => undefined}
            onChange={() => undefined}
            onSave={async () => undefined}
          />
        );
      case "brand-empty":
        return (
          <BrandProfileView
            value={{
              ...MOCK_BRAND,
              brandProfileMode: "undecided",
              brandWebsiteUrl: "",
              brandTone: "",
              brandColors: "",
              brandDos: "",
              brandDonts: "",
            }}
            loaded
            loadError={null}
            brandProfileComplete={false}
            brandProfileNotice=""
            onOpenBrandSetup={() => undefined}
            onSkipBrandProfile={() => undefined}
            onResetBrandProfile={() => undefined}
            onChange={() => undefined}
            onSave={async () => undefined}
          />
        );
      case "settings":
        return (
          <>
            <p className="evg-rubrik">Einstellungen</p>
            <h1 className="studio-dash-page-title" style={{ color: P.ink }}>
              Profil & Marke
            </h1>
            <p style={{ marginTop: 10, fontFamily: STUDIO_TOKENS.sans, fontSize: 14.5, color: P.ink2 }}>
              Diese Angaben erscheinen in der Begrüßung und in Dashboard-Überschriften.
            </p>
            <div className="studio-settings-brand-banner" style={{ marginTop: 22 }}>
              <div className="studio-settings-brand-banner-inner">
                <div className="studio-settings-brand-banner-left">
                  <span className="studio-settings-brand-banner-icon" aria-hidden="true">
                    <StudioIcon name="shield" size={20} />
                  </span>
                  <div>
                    <div className="studio-settings-brand-banner-title">Markenprofil aktiv</div>
                    <div className="studio-settings-brand-banner-sub">
                      beispielbrauerei.de · Brand-Lock auf „Ausgewogen“
                    </div>
                  </div>
                </div>
                <StudioButton type="button" variant="soft" size="sm">
                  Profil verwalten
                </StudioButton>
              </div>
            </div>
            <div className="studio-settings-two-col" style={{ marginTop: 18 }}>
              <div style={{ background: P.surface2, border: `1px solid ${P.rule}`, borderRadius: 16, padding: 18 }}>
                <div style={{ fontWeight: 650, fontSize: 14.5 }}>Dein Name</div>
                <input className="studio-field" style={{ marginTop: 12, width: "100%" }} defaultValue="Erik" readOnly />
              </div>
              <div style={{ background: P.surface2, border: `1px solid ${P.rule}`, borderRadius: 16, padding: 18 }}>
                <div style={{ fontWeight: 650, fontSize: 14.5 }}>Marke</div>
                <input
                  className="studio-field"
                  style={{ marginTop: 12, width: "100%" }}
                  defaultValue="Beispielbrauerei"
                  readOnly
                />
              </div>
            </div>
          </>
        );
      case "pricing":
        return (
          <StudioPricingView
            currentPlan="pro"
            monthlyTokens={1600}
            usedTokens={360}
            remainingTokens={1240}
          />
        );
      case "create-start":
        return (
          <>
            <StudioPageHeader
              eyebrow="Design Handoff"
              title="Bilder Erstellen · Composer"
              subtitle="Der Composer-Mock ist in diesem Branch nicht enthalten. Nutze die produktive Route /inhalte-erstellen."
            />
            <CreateContentLockedView feature="images" />
          </>
        );
      case "token-badge":
        return <TokenBadgeStatesDemo />;
      case "create-locked":
        return <CreateContentLockedView feature="images" />;
      case "videos":
        return <CreateVideosComingSoonView />;
      default:
        return null;
    }
  }, [screen, P]);

  if (screen === "token-badge") {
    return (
      <div
        data-design-handoff-screen={screen}
        data-design-handoff-title={meta.title}
        style={{ minHeight: "100dvh", background: "#0b0a08" }}
      >
        <style>{`html, body { background: #0b0a08 !important; }`}</style>
        <TokenBadgeStatesDemo />
      </div>
    );
  }

  return (
    <div
      data-design-handoff-screen={screen}
      data-design-handoff-title={meta.title}
      style={{ minHeight: "100dvh", background: "#131211" }}
    >
      {/* Root-Layout hat helles body-bg — für echte Studio-Optik überschreiben. */}
      <style>{`
        html, body { background: #131211 !important; }
      `}</style>
      <DashboardStudioShell
        userEmail="erik@beispielbrauerei.de"
        initialProfileName="Erik"
        initialBreweryName="Beispielbrauerei"
        activeNav={meta.nav}
        breadcrumbLabel={meta.breadcrumb}
        brandProfileActive={screen === "brand" || screen === "settings" || screen === "dashboard"}
        hasActivePlan={screen !== "create-locked"}
        tokensRemaining={1240}
        tokensMonthly={1600}
        tokensUnlimited={false}
        billingPlan="start"
        periodEnd={MOCK_DASHBOARD_SUMMARY.periodEnd}
        recentMedia={[]}
        recentCharges={[]}
        contentKey={screen}
      >
        {content}
      </DashboardStudioShell>
    </div>
  );
}
