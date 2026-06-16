"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StudioViewTransition } from "@/components/studio/studio-view-transition";
import { MARKETING_SITE_URL } from "@/lib/siteConfig";
import { useStudioShell } from "@/components/studio/studio-workspace-shell";
import {
  STUDIO_ON_ACCENT,
  STUDIO_PAD_X,
  STUDIO_TOKENS,
  useStudioPalette,
  type StudioPalette,
} from "@/components/ui/dashboard-studio-shell";
import {
  StudioActivityColumn,
  StudioSideColumn,
  StudioStatsRow,
  type StudioActivityItem,
  type StudioStat,
} from "@/components/dashboard/studio-reference-ui";
import { StudioPricingView } from "@/components/studio/studio-pricing-view";
import { StudioButton, StudioPageHeader } from "@/components/studio/ui";
import { StudioIcon } from "@/components/studio/icons";
import { brandLockLabel, formatDomain } from "@/lib/brand/brand-profile-display";
import { BrandProfileView } from "@/components/dashboard/BrandProfileView";
import { BrandProfileSetupModal, type BrandScanSuggestion } from "@/components/dashboard/BrandProfileSetupModal";
import { SUBSCRIPTION_PLAN_TOKENS, type SubscriptionPlanKey } from "@/lib/billing/tokenState";
import { hasActiveSubscriptionFromState } from "@/lib/billing/access";
import {
  clearHomepageCheckoutParams,
  getHomepageCheckoutPlan,
  startBillingCheckout,
} from "@/lib/billing/checkoutClient";
import { buildGenericBrandProfilePatch, isBrandProfileCompleteFromSettings } from "@/lib/dashboard/brandProfile";
import { mergeDashboardSettings, sanitizeDashboardSettings } from "@/lib/dashboard/settingsPayload";
import { fetchWithRetry } from "@/lib/http/fetchWithRetry";
import { signOutAndRedirect } from "@/lib/auth/signOutClient";

type DashboardTab = "dashboard" | "media" | "team" | "brand" | "settings" | "pricing";

type DashboardSummary = {
  tokens: { monthly: number; used: number; remaining: number };
  postsThisMonth: number;
  activeCampaigns: number;
  teamMembers: number;
  openInvites: number;
  billingStatus: string;
  plan: string | null;
  degradedBilling?: boolean;
};

type ActivityItem = {
  id: string;
  type: "media" | "team" | "billing";
  title: string;
  desc: string;
  time: string;
  color: "orange" | "blue" | "purple" | "green";
};

type MediaItem = {
  id: string;
  imageUrl: string;
  prompt: string;
  createdAt: string;
  aspectRatio: string;
  resolution: "1K" | "2K" | "4K";
  outputFormat: "png" | "jpg";
};

type TeamMember = {
  id: string;
  email: string;
  name: string;
  role: "owner" | "admin" | "editor" | "viewer";
  status: "active" | "invited";
  invitedAt: string;
};

type SettingsPayload = {
  profileName: string;
  breweryName: string;
  profilePhone: string;
  emailNotifications: boolean;
  weeklySummary: boolean;
  brandProfileMode: "undecided" | "guided" | "skip";
  brandInstagramUrl: string;
  brandWebsiteUrl: string;
  brandProfileSource: "url" | "instagram" | "manual" | "skip";
  brandLockLevel: "strict" | "balanced" | "loose";
  brandTone: string;
  brandColors: string;
  brandDos: string;
  brandDonts: string;
  brandReferenceImageUrls: string[];
  brandAnalyzedAt?: string;
};

const TOKENS = STUDIO_TOKENS;

const PLAN_LABELS: Record<string, string> = {
  start: "Brauerei Start",
  growth: "Brauerei Wachstum",
  pro: "Brauerei Pro",
};

const isBrandProfileComplete = isBrandProfileCompleteFromSettings;

function normalizeSettings(raw: Partial<SettingsPayload> | SettingsPayload): SettingsPayload {
  return sanitizeDashboardSettings(raw);
}

function clampText(v: string, max: number) {
  const s = (v ?? "").trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "?";
  const b = parts.length > 1 ? parts[1]?.[0] : parts[0]?.[1];
  return (a + (b ?? "")).toUpperCase();
}

function formatDeNumber(n: number) {
  return n.toLocaleString("de-DE");
}

function formatRelativeTime(iso: string) {
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

function greetingForNow() {
  const h = new Date().getHours();
  if (h < 11) return "Guten Morgen";
  if (h < 17) return "Guten Tag";
  return "Guten Abend";
}

function getCalendarWeek(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

function formatNewMotifs(count: number) {
  if (count === 1) return "1 neues Motiv";
  return `${count} neue Motive`;
}

function sparkFromValue(n: number) {
  const base = Math.max(1, n);
  return Array.from({ length: 10 }, (_, i) => Math.max(0, Math.round(base * (0.45 + i / 18))));
}

function buildStudioActivities(
  media: MediaItem[],
  activities: ActivityItem[],
  profileName: string,
): StudioActivityItem[] {
  const user = profileName.split(/\s+/)[0] || profileName || "Studio";
  const fromMedia: StudioActivityItem[] = media.map((m, i) => ({
    id: m.id,
    kind: "image" as const,
    title: clampText(m.prompt, 48) || "Bild generiert",
    desc: `${m.resolution} · ${m.aspectRatio} · Markenstil`,
    time: formatRelativeTime(m.createdAt),
    user,
    tag: "Produktfoto",
    imageUrl: m.imageUrl,
    tone: i % 3 === 0 ? "amber" : i % 3 === 1 ? "deep" : "cream",
  }));

  const fromApi: StudioActivityItem[] = activities
    .filter((a) => a.type !== "media")
    .map((a) => ({
      id: a.id,
      kind: (a.type === "team" ? "team" : "campaign") as "team" | "campaign",
      title: a.title,
      desc: a.desc,
      time: formatRelativeTime(a.time),
      user,
      tag: a.type === "team" ? "Team" : "Kampagne",
    }));

  return [...fromMedia, ...fromApi].slice(0, 6);
}

function WaveMark({ size = 28, color = TOKENS.ink }: { size?: number; color?: string }) {
  const h = (size * 20) / 28;
  return (
    <svg width={size} height={h} viewBox="0 0 28 20" fill="none" aria-hidden="true">
      <path d="M2 5 C6 1, 10 9, 14 5 S22 1, 26 5" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M2 11 C6 7, 10 15, 14 11 S22 7, 26 11" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M2 17 C6 13, 10 21, 14 17 S22 13, 26 17" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function Eyebrow({
  children,
  color = TOKENS.ink3,
  dot = TOKENS.amber,
}: {
  children: React.ReactNode;
  color?: string;
  dot?: string;
}) {
  return (
    <div
      style={{
        fontFamily: TOKENS.mono,
        fontSize: 11,
        letterSpacing: 1.2,
        textTransform: "uppercase",
        color,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 999, background: dot, display: "inline-block" }} />
      {children}
    </div>
  );
}

function Placeholder({
  label,
  w = "100%",
  h = 64,
  tone = "cream",
  radius = 6,
}: {
  label: string;
  w?: number | string;
  h?: number;
  tone?: "cream" | "deep" | "amber";
  radius?: number;
}) {
  const palettes = {
    cream: { bg: "#EAE3D5", line: "#D8CFBC", text: "#6E6557" },
    deep: { bg: "#2E1F12", line: "#3A2818", text: "#B89572" },
    amber: { bg: "#F4D8B4", line: "#ECC692", text: "#8B5A22" },
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
      <span
        style={{
          position: "absolute",
          bottom: 6,
          left: 6,
          fontFamily: TOKENS.mono,
          fontSize: 9,
          letterSpacing: 0.4,
          color: p.text,
          textTransform: "uppercase",
          background: "rgba(255,255,255,0.55)",
          padding: "2px 6px",
          borderRadius: 4,
        }}
      >
        {label}
      </span>
    </div>
  );
}

function Sparkline({ data, color, width = 64, height = 22 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const lastY = height - ((data[data.length - 1] - min) / range) * height;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" aria-hidden="true">
      <polyline points={pts} stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={width} cy={lastY} r="2" fill={color} />
    </svg>
  );
}

function SidebarIcon({ name, color = "currentColor" }: { name: string; color?: string }) {
  const s = 18;
  const sw = 1.6;
  const map: Record<string, React.ReactNode> = {
    home: (
      <>
        <path d="M3 9 L10 3 L17 9 V16 H3 Z" />
        <path d="M8 16 V12 H12 V16" />
      </>
    ),
    dash: (
      <>
        <rect x="3" y="3" width="6" height="6" rx="1.2" />
        <rect x="11" y="3" width="6" height="4" rx="1.2" />
        <rect x="11" y="9" width="6" height="8" rx="1.2" />
        <rect x="3" y="11" width="6" height="6" rx="1.2" />
      </>
    ),
    spark: <path d="M10 3 L11.5 8 L16.5 9.5 L11.5 11 L10 16 L8.5 11 L3.5 9.5 L8.5 8 Z" />,
    media: (
      <>
        <rect x="3" y="3" width="14" height="14" rx="2" />
        <path d="M3 13 L7 9 L11 13 L14 10 L17 13" />
        <circle cx="13.5" cy="6.5" r="1.3" />
      </>
    ),
    team: (
      <>
        <circle cx="7" cy="8" r="2.6" />
        <circle cx="13" cy="8" r="2.6" />
        <path d="M3 16 C3 13.5 5 12 7 12 C9 12 11 13.5 11 16 M9 16 C9 13.5 11 12 13 12 C15 12 17 13.5 17 16" />
      </>
    ),
    gear: (
      <>
        <circle cx="10" cy="10" r="3" />
        <path d="M10 2 V4 M10 16 V18 M2 10 H4 M16 10 H18 M4.3 4.3 L5.7 5.7 M14.3 14.3 L15.7 15.7 M4.3 15.7 L5.7 14.3 M14.3 5.7 L15.7 4.3" />
      </>
    ),
    help: (
      <>
        <circle cx="10" cy="10" r="7.5" />
        <path d="M7.8 8 C7.8 6.6 8.8 5.8 10 5.8 C11.2 5.8 12.2 6.6 12.2 7.8 C12.2 9 10 9.5 10 11" />
        <circle cx="10" cy="13.5" r="0.6" fill={color} stroke="none" />
      </>
    ),
  };
  return (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true">
      {map[name]}
    </svg>
  );
}

export function DashboardRedesignShell(props: {
  userEmail?: string;
  initialProfileName?: string;
  initialBreweryName?: string;
  isAdmin?: boolean;
}) {
  const { userEmail, initialProfileName, initialBreweryName, isAdmin } = props;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tabParam = (searchParams.get("tab") ?? "dashboard").toLowerCase();
  const initialTab: DashboardTab =
    tabParam === "media" || tabParam === "team" || tabParam === "brand" || tabParam === "settings" || tabParam === "pricing"
      ? (tabParam as DashboardTab)
      : "dashboard";
  const [tab, setTab] = useState<DashboardTab>(initialTab);

  const changeTab = useCallback((next: DashboardTab) => {
    setTab(next);
  }, []);

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [brandProfileSetupOpen, setBrandProfileSetupOpen] = useState(false);
  const [showBrandProfileChoice, setShowBrandProfileChoice] = useState(false);
  const [brandProfileNotice, setBrandProfileNotice] = useState("");
  const [pricingCheckoutError, setPricingCheckoutError] = useState<string | null>(null);
  const homepageCheckoutStartedRef = useRef(false);

  const profileName = settings?.profileName?.trim() || initialProfileName?.trim() || "";
  const breweryName = settings?.breweryName?.trim() || initialBreweryName?.trim() || "";
  const accountName = breweryName || profileName || "EvGlab";
  const initials = initialsFromName(accountName);
  const brandProfileComplete = isBrandProfileComplete(settings);
  const brandProfileMode = settings?.brandProfileMode ?? "undecided";

  useEffect(() => {
    const p = new URLSearchParams(searchParams.toString());
    if (tab === "dashboard") p.delete("tab");
    else p.set("tab", tab);
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Externe URL-Aenderungen (Sidebar-Links, Browser Back/Forward) -> Tab updaten.
  useEffect(() => {
    const next = (searchParams.get("tab") ?? "dashboard").toLowerCase();
    const resolved: DashboardTab =
      next === "media" || next === "team" || next === "brand" || next === "settings" || next === "pricing"
        ? (next as DashboardTab)
        : "dashboard";
    if (resolved !== tab) {
      setTab(resolved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    let ignore = false;

    (async () => {
      try {
        const [summaryRes, mediaRes, teamRes, settingsRes] = await Promise.all([
          fetch("/api/dashboard/summary", { cache: "no-store", credentials: "include" }),
          fetch("/api/dashboard/media", { cache: "no-store" }),
          fetch("/api/dashboard/team", { cache: "no-store" }),
          fetch("/api/dashboard/settings", { cache: "no-store", credentials: "include" }),
        ]);
        if (ignore) return;
        if (summaryRes.ok) {
          const json = (await summaryRes.json()) as { summary?: DashboardSummary; activities?: ActivityItem[] };
          if (json.summary) setSummary(json.summary);
          if (Array.isArray(json.activities)) setActivities(json.activities);
        }
        if (mediaRes.ok) {
          const json = (await mediaRes.json()) as { items?: MediaItem[] };
          if (Array.isArray(json.items)) setMedia(json.items);
        }
        if (teamRes.ok) {
          const json = (await teamRes.json()) as { members?: TeamMember[] };
          if (Array.isArray(json.members)) setTeam(json.members);
        }
        if (settingsRes.ok) {
          const json = (await settingsRes.json()) as { settings?: SettingsPayload };
          if (json.settings) {
            setSettings(normalizeSettings(json.settings));
            setSettingsError(null);
          }
        } else if (settingsRes.status === 401) {
          if (!ignore) window.location.href = "/anmelden";
          return;
        } else {
          const fallback = (await settingsRes.json().catch(() => null)) as { error?: string } | null;
          setSettingsError(fallback?.error ?? "Einstellungen konnten nicht geladen werden.");
        }
      } catch {
        if (!ignore) setSettingsError("Netzwerkfehler beim Laden des Dashboards.");
      } finally {
        if (!ignore) setSettingsLoaded(true);
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (homepageCheckoutStartedRef.current || !settingsLoaded) return;

    const params = new URLSearchParams(searchParams.toString());
    const homepagePlan = getHomepageCheckoutPlan(params);
    if (!homepagePlan) return;

    homepageCheckoutStartedRef.current = true;
    setShowBrandProfileChoice(false);

    const hasActivePlan = hasActiveSubscriptionFromState(summary?.plan, summary?.billingStatus);
    if (hasActivePlan) {
      clearHomepageCheckoutParams(params);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      return;
    }

    changeTab("pricing");
    void (async () => {
      const result = await startBillingCheckout({ plan: homepagePlan });
      if (!result.ok && !result.redirected) {
        setPricingCheckoutError(result.error);
      }
      clearHomepageCheckoutParams(params);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsLoaded, summary, searchParams]);

  useEffect(() => {
    const onBillingUpdated = () => {
      void (async () => {
        try {
          const res = await fetch("/api/dashboard/summary", { cache: "no-store", credentials: "include" });
          if (!res.ok) return;
          const json = (await res.json()) as { summary?: DashboardSummary; activities?: ActivityItem[] };
          if (json.summary) setSummary(json.summary);
          if (Array.isArray(json.activities)) setActivities(json.activities);
        } catch {
          /* ignore */
        }
      })();
    };
    window.addEventListener("evglab-billing-updated", onBillingUpdated);
    return () => window.removeEventListener("evglab-billing-updated", onBillingUpdated);
  }, []);

  const P = useStudioPalette();
  const { setBrandProfileActive } = useStudioShell();

  useEffect(() => {
    setBrandProfileActive(brandProfileSetupOpen || tab === "brand");
  }, [brandProfileSetupOpen, setBrandProfileActive, tab]);

  const saveProfileSettings = useCallback(
    async (overrides: Partial<SettingsPayload>): Promise<SettingsPayload> => {
      let base = settings;
      if (!base) {
        const settingsRes = await fetch("/api/dashboard/settings", { cache: "no-store", credentials: "include" });
        if (!settingsRes.ok) throw new Error("Einstellungen konnten nicht geladen werden.");
        const json = (await settingsRes.json()) as { settings?: SettingsPayload };
        if (!json.settings) throw new Error("Einstellungen konnten nicht geladen werden.");
        base = normalizeSettings(json.settings);
      }
      const payload = mergeDashboardSettings(base, overrides);
      const res = await fetchWithRetry(
        "/api/dashboard/settings",
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          credentials: "include",
          cache: "no-store",
          body: JSON.stringify(payload),
        },
        { retries: 2, baseDelayMs: 1200 },
      );
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; settings?: SettingsPayload } | null;
      if (!res.ok) throw new Error(json?.error ?? "Einstellungen konnten nicht gespeichert werden.");
      const saved = normalizeSettings(json?.settings ?? payload);
      setSettings(saved);
      return saved;
    },
    [settings],
  );

  const applyBrandScanAndPersist = useCallback(
    async (suggestion: BrandScanSuggestion) => {
      const analyzedAt = new Date().toISOString();
      const patch: Partial<SettingsPayload> = {
        brandProfileMode: "guided",
        breweryName: suggestion.breweryName,
        brandTone: suggestion.brandTone,
        brandColors: suggestion.brandColors,
        brandDos: suggestion.brandDos,
        brandDonts: suggestion.brandDonts,
        brandInstagramUrl: suggestion.brandInstagramUrl,
        brandWebsiteUrl: suggestion.brandWebsiteUrl,
        brandProfileSource: suggestion.brandProfileSource,
        brandReferenceImageUrls: suggestion.referenceImageUrls,
        brandAnalyzedAt: analyzedAt,
      };

      setSettings((prev) => (prev ? mergeDashboardSettings(prev, patch) : normalizeSettings(patch)));
      changeTab("brand");
      setBrandProfileNotice("Markenprofil gespeichert und aktiviert.");
      window.setTimeout(() => router.refresh(), 300);
    },
    [changeTab, router],
  );

  const handleChooseBrandProfileGuided = useCallback(() => {
    // Wichtig: KEIN lokaler State-Wechsel vor Server-Save — das fuehrt sonst zu Drift,
    // wenn der User die Setup-Modal ohne Speichern schliesst. Der Modus wird erst durch
    // `applyBrandScanAndPersist` (saveProfileSettings) auf "guided" gesetzt.
    setShowBrandProfileChoice(false);
    setBrandProfileSetupOpen(true);
  }, []);

  const handleSkipBrandProfile = useCallback(async () => {
    setShowBrandProfileChoice(false);
    try {
      await saveProfileSettings(buildGenericBrandProfilePatch());
      setBrandProfileNotice("Markenprofil deaktiviert — du generierst jetzt generisch.");
    } catch {
      setBrandProfileNotice("Zurücksetzen konnte nicht gespeichert werden.");
    }
  }, [saveProfileSettings]);

  const handleResetBrandProfile = handleSkipBrandProfile;

  useEffect(() => {
    if (!settingsLoaded) return;
    if (brandProfileMode !== "undecided") return;
    // Nur einmal pro Browser-Session anzeigen — wenn der User die Modal ohne
    // explizite Entscheidung schliesst, faellt er ueber die Banner zurueck und
    // wird beim naechsten Login erneut sanft erinnert.
    if (typeof window !== "undefined") {
      const shownThisSession = window.sessionStorage.getItem("evglab:brandChoiceShown");
      if (shownThisSession === "1") return;
      window.sessionStorage.setItem("evglab:brandChoiceShown", "1");
    }
    setShowBrandProfileChoice(true);
  }, [brandProfileMode, settingsLoaded]);

  useEffect(() => {
    if (searchParams.get("openBrand") !== "1") return;
    changeTab("brand");
    setBrandProfileSetupOpen(true);
    const p = new URLSearchParams(searchParams.toString());
    p.delete("openBrand");
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Hinweis: Wir oeffnen das Setup-Modal NICHT mehr automatisch bei `guided + incomplete`.
  // Stattdessen wird der User ueber die Banner (Dashboard-Overview + Inhalte-erstellen)
  // sanft erinnert und kann selbst entscheiden, wann er das Markenprofil anlegt.

  const hasActivePlan = hasActiveSubscriptionFromState(summary?.plan, summary?.billingStatus);

  return (
    <>
      <StudioViewTransition viewKey={tab} variant="tab">
      {tab === "dashboard" ? (
        <DashboardOverview
          P={P}
          summary={summary}
          media={media}
          activities={activities}
          profileName={profileName}
          breweryName={breweryName}
          brandProfileComplete={brandProfileComplete}
          brandProfileMode={brandProfileMode}
          onOpenTab={changeTab}
          onOpenBrandSetup={() => {
            changeTab("brand");
            setBrandProfileSetupOpen(true);
          }}
        />
      ) : null}
      {tab === "media" ? <MediaView P={P} items={media} hasActivePlan={hasActivePlan} /> : null}
      {tab === "team" ? <TeamView P={P} members={team} onMembersChange={setTeam} /> : null}
      {tab === "brand" ? (
        <BrandProfileView
          value={settings}
          loaded={settingsLoaded}
          loadError={settingsError}
          brandProfileComplete={brandProfileComplete}
          brandProfileNotice={brandProfileNotice}
          onOpenBrandSetup={() => setBrandProfileSetupOpen(true)}
          onSkipBrandProfile={() => void handleSkipBrandProfile()}
          onResetBrandProfile={handleResetBrandProfile}
          onChange={(patch) => setSettings((s) => (s ? { ...s, ...patch } : s))}
          onSave={async (patch) => {
            if (!settings) throw new Error("Einstellungen noch nicht geladen.");
            await saveProfileSettings(patch ?? {});
          }}
        />
      ) : null}
      {tab === "settings" ? (
        <SettingsView
          P={P}
          value={settings}
          onChange={setSettings}
          loaded={settingsLoaded}
          loadError={settingsError}
          brandProfileComplete={brandProfileComplete}
          brandProfileNotice={brandProfileNotice}
          onOpenBrandTab={() => changeTab("brand")}
          onOpenBrandSetup={() => {
            changeTab("brand");
            setBrandProfileSetupOpen(true);
          }}
          onSkipBrandProfile={() => void handleSkipBrandProfile()}
          onResetBrandProfile={handleResetBrandProfile}
        />
      ) : null}
      {tab === "pricing" ? (
        <StudioPricingView
          currentPlan={(summary?.plan ?? null) as SubscriptionPlanKey | null}
          monthlyTokens={summary?.tokens.monthly ?? 0}
          usedTokens={summary?.tokens.used ?? 0}
          remainingTokens={summary?.tokens.remaining ?? 0}
          initialCheckoutError={pricingCheckoutError}
        />
      ) : null}
      </StudioViewTransition>

    <BrandProfileSetupModal
      open={brandProfileSetupOpen}
      onOpenChange={setBrandProfileSetupOpen}
      title="Marke einlesen"
      onSaved={applyBrandScanAndPersist}
    />

    {showBrandProfileChoice ? (
      <div
        className="fixed inset-0 z-[126] flex items-center justify-center px-4"
        style={{ background: "rgba(19,18,17,0.72)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}
        onClick={() => setShowBrandProfileChoice(false)}
      >
        <div
          className="studio-brand-choice-modal relative w-full max-w-lg rounded-2xl p-7 shadow-2xl"
          style={{
            background: "var(--bg-2)",
            border: "1px solid var(--line-strong)",
            color: "var(--tx-0)",
            boxShadow: "var(--sh-pop)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div aria-hidden style={{ position: "absolute", top: -1, left: -1, right: -1, height: 1, background: TOKENS.amber, borderRadius: "16px 16px 0 0", opacity: 0.5 }} />
          <button
            type="button"
            aria-label="Schliessen"
            onClick={() => setShowBrandProfileChoice(false)}
            className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full transition"
            style={{ color: TOKENS.ink3, background: "transparent" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = P.surface)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            ×
          </button>
          <h3 className="text-xl font-semibold" style={{ color: TOKENS.ink, fontFamily: TOKENS.sans }}>Willst du deinen Markenstil fixieren?</h3>
          <p className="mt-2 text-sm" style={{ color: TOKENS.ink2 }}>
            Gib einfach die Website deiner Marke ein — die KI erkennt Tonality, Farben und Bildsprache und erstellt
            dein Markenprofil. Du kannst das später unter Einstellungen jederzeit ändern.
          </p>
          <div className="studio-brand-choice-actions mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleChooseBrandProfileGuided}
              className="evg-cta inline-flex h-11 items-center rounded-lg px-5 text-sm font-semibold"
              style={{
                background: TOKENS.amber,
                color: STUDIO_ON_ACCENT,
                border: "none",
              }}
            >
              Ja, Markenprofil anlegen
            </button>
            <button
              type="button"
              onClick={() => void handleSkipBrandProfile()}
              className="inline-flex h-11 items-center rounded-lg px-5 text-sm transition"
              style={{
                background: "transparent",
                color: TOKENS.ink2,
                border: `1px solid ${P.ruleStrong}`,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = P.surface)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              Ohne Profil starten (dauerhaft)
            </button>
          </div>
          <p className="mt-4 text-xs" style={{ color: TOKENS.ink3 }}>
            Beim X-Schließen wirst du in dieser Sitzung nicht erneut gefragt — beim nächsten Login erscheint die
            Auswahl wieder. „Ohne Profil starten" speichert deine Wahl dauerhaft.
          </p>
        </div>
      </div>
    ) : null}
    </>
  );
}

function DashboardOverview({
  P,
  summary,
  media,
  activities,
  profileName,
  breweryName,
  brandProfileComplete,
  brandProfileMode,
  onOpenTab,
  onOpenBrandSetup,
}: {
  P: StudioPalette;
  summary: DashboardSummary | null;
  media: MediaItem[];
  activities: ActivityItem[];
  profileName: string;
  breweryName: string;
  brandProfileComplete: boolean;
  brandProfileMode: SettingsPayload["brandProfileMode"];
  onOpenTab: (tab: DashboardTab) => void;
  onOpenBrandSetup: () => void;
}) {
  const firstName = profileName.split(/\s+/)[0] || profileName;
  const greeting = greetingForNow();
  const postsCount = summary?.postsThisMonth ?? 0;
  const headlineBrewery = breweryName || "deine Marke";
  const remaining = summary?.tokens.remaining ?? 0;
  const monthly = summary?.tokens.monthly ?? 0;
  const used = summary?.tokens.used ?? 0;
  const studioActivities = buildStudioActivities(media, activities, profileName);
  const planKey = (summary?.plan ?? null) as SubscriptionPlanKey | null;
  const hasActivePlan = hasActiveSubscriptionFromState(summary?.plan, summary?.billingStatus);
  const planLabel = planKey ? (PLAN_LABELS[planKey] ?? planKey) : "Noch kein Tarif";
  const baseTokens = planKey ? SUBSCRIPTION_PLAN_TOKENS[planKey] : 0;
  const extraTokens = Math.max(monthly - baseTokens, 0);

  async function openBillingPortal() {
    if (!hasActivePlan) {
      onOpenTab("pricing");
      return;
    }
    try {
      const res = await fetch("/api/billing/portal", { method: "POST", credentials: "same-origin" });
      const json = (await res.json().catch(() => null)) as { url?: string } | null;
      if (json?.url) window.location.href = json.url;
    } catch {
      onOpenTab("settings");
    }
  }

  const stats: StudioStat[] = [
    {
      eyebrow: "Tokens übrig",
      value: formatDeNumber(remaining),
      sub: `${formatDeNumber(used)} verbraucht`,
      delta: monthly > 0 ? `${Math.round((remaining / monthly) * 100)}% verfügbar` : "—",
      deltaDir: "flat" as const,
      spark: sparkFromValue(remaining),
    },
    {
      eyebrow: "Posts diesen Monat",
      value: formatDeNumber(postsCount),
      sub: "aus deiner Mediathek",
      delta: postsCount > 0 ? `↗ ${formatDeNumber(postsCount)} neu` : "Noch keine Posts",
      deltaDir: postsCount > 0 ? ("up" as const) : ("flat" as const),
      spark: sparkFromValue(postsCount),
    },
    {
      eyebrow: "Kampagnen aktiv",
      value: formatDeNumber(summary?.activeCampaigns ?? 0),
      sub: (summary?.activeCampaigns ?? 0) > 0 ? "Aktive Kampagne" : "Noch keine Kampagne",
      delta: (summary?.activeCampaigns ?? 0) > 0 ? "↗ aktiv" : "—",
      deltaDir: (summary?.activeCampaigns ?? 0) > 0 ? ("up" as const) : ("flat" as const),
      spark: sparkFromValue(summary?.activeCampaigns ?? 0),
    },
    {
      eyebrow: "Teammitglieder",
      value: formatDeNumber(summary?.teamMembers ?? 0),
      sub: `${formatDeNumber(summary?.openInvites ?? 0)} Einladungen offen`,
      delta: (summary?.openInvites ?? 0) > 0 ? `${summary?.openInvites} offen` : "Alle aktiv",
      deltaDir: "flat" as const,
      spark: sparkFromValue(summary?.teamMembers ?? 0),
    },
  ];

  return (
    <>
      <StudioPageHeader
        eyebrow="Übersicht"
        title={
          <>
            Dein <em>Dashboard</em>.
          </>
        }
        subtitle={`${greeting}${firstName ? `, ${firstName}` : ""} · ${formatNewMotifs(postsCount)} für ${headlineBrewery}`}
        action={
          <StudioButton
            href={hasActivePlan ? "/inhalte-erstellen" : "/dashboard?tab=pricing"}
            variant="primary"
            size="sm"
          >
            {hasActivePlan ? "Neu erstellen" : "Tarif wählen"}
          </StudioButton>
        }
      />

      {!brandProfileComplete && brandProfileMode !== "skip" ? (
        <div className="studio-alert" style={{ marginTop: 22 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: "var(--tx-0)" }}>Markenprofil anlegen — ein Link genügt</div>
            <div style={{ marginTop: 4, fontSize: 13, color: "var(--tx-2)" }}>
              Website eingeben, Tonality und Farben werden für alle Generierungen übernommen.
            </div>
          </div>
          <StudioButton type="button" onClick={onOpenBrandSetup} variant="primary" size="sm">
            Jetzt starten
          </StudioButton>
        </div>
      ) : null}

      <StudioStatsRow stats={stats} />

      <div className="studio-dash-grid" style={{ marginTop: 22 }}>
        <StudioActivityColumn items={studioActivities} onShowAll={() => onOpenTab("media")} />
        <StudioSideColumn
          planLabel={planLabel}
          hasActivePlan={hasActivePlan}
          baseTokens={baseTokens}
          extraTokens={extraTokens}
          remaining={remaining}
          monthly={monthly}
          onTeam={() => onOpenTab("team")}
          onManagePlan={() => void openBillingPortal()}
        />
      </div>
    </>
  );
}

function MediaView({ P, items, hasActivePlan = true }: { P: StudioPalette; items: MediaItem[]; hasActivePlan?: boolean }) {
  return (
    <>
      <Eyebrow>Mediathek</Eyebrow>
      <h1 className="studio-dash-page-title" style={{ color: P.ink }}>
        Deine Motive
      </h1>
      <p style={{ marginTop: 10, fontFamily: TOKENS.sans, fontSize: 14.5, color: P.ink2 }}>
        Alle generierten Bilder deiner Marke — sortiert nach Datum.
      </p>
      <div className="studio-media-grid">
        {items.length === 0 ? (
          <div
            style={{
              gridColumn: "1 / -1",
              background: P.surface,
              border: `1px solid ${P.rule}`,
              borderRadius: 16,
              padding: 28,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div aria-hidden style={{ position: "absolute", top: -60, right: -40, width: 220, height: 220, background: `radial-gradient(circle, ${TOKENS.amber}18 0%, transparent 65%)`, pointerEvents: "none" }} />
            <p style={{ fontFamily: TOKENS.sans, fontSize: 14, color: P.ink2, position: "relative" }}>Noch keine Motive in der Mediathek.</p>
            <Link
              href={hasActivePlan ? "/inhalte-erstellen" : "/dashboard?tab=pricing"}
              className="evg-cta"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                marginTop: 14,
                padding: "10px 18px",
                borderRadius: 10,
                background: TOKENS.amber,
                color: STUDIO_ON_ACCENT,
                fontFamily: TOKENS.sans,
                fontSize: 13,
                fontWeight: 650,
                textDecoration: "none",
                position: "relative",
              }}
            >
              {hasActivePlan ? "Jetzt erstellen →" : "Tarif wählen →"}
            </Link>
          </div>
        ) : (
          items.map((it) => (
            <div
              key={it.id}
              className="evg-card"
              style={{
                background: P.surface2,
                border: `1px solid ${P.rule}`,
                borderRadius: 16,
                overflow: "hidden",
                cursor: "pointer",
              }}
            >
              <div style={{ aspectRatio: "4 / 3", background: P.surface }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </div>
              <div style={{ padding: 14 }}>
                <div style={{ fontFamily: TOKENS.mono, fontSize: 10.5, letterSpacing: 1.1, textTransform: "uppercase", color: P.ink3 }}>
                  {it.resolution} · {it.aspectRatio}
                </div>
                <div style={{ marginTop: 6, fontFamily: TOKENS.sans, fontSize: 13.5, color: P.ink2 }}>{clampText(it.prompt, 140)}</div>
                <div style={{ marginTop: 8, fontFamily: TOKENS.mono, fontSize: 10.5, color: P.ink3 }}>{formatRelativeTime(it.createdAt)}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}

function TeamView({
  P,
  members,
  onMembersChange,
}: {
  P: StudioPalette;
  members: TeamMember[];
  onMembersChange: (next: TeamMember[]) => void;
}) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "editor" | "viewer">("editor");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function sendInvite() {
    setError(null);
    setNotice(null);
    const email = inviteEmail.trim();
    if (!email) {
      setError("Bitte eine E-Mail eingeben.");
      return;
    }
    setInviting(true);
    try {
      const res = await fetch("/api/dashboard/team", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: inviteName.trim() || undefined, role: inviteRole }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; members?: TeamMember[] } | null;
      if (!res.ok) {
        setError(json?.error || "Einladung fehlgeschlagen.");
        return;
      }
      if (Array.isArray(json?.members)) onMembersChange(json.members);
      setNotice(`Einladung an ${email} verschickt.`);
      setInviteEmail("");
      setInviteName("");
      setInviteRole("editor");
    } catch {
      setError("Einladung konnte nicht gesendet werden.");
    } finally {
      setInviting(false);
    }
  }

  async function removeMember(memberId: string) {
    setError(null);
    setNotice(null);
    setRemovingId(memberId);
    try {
      const res = await fetch(`/api/dashboard/team?memberId=${encodeURIComponent(memberId)}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; members?: TeamMember[] } | null;
      if (!res.ok) {
        setError(json?.error || "Mitglied konnte nicht entfernt werden.");
        return;
      }
      if (Array.isArray(json?.members)) onMembersChange(json.members);
      setNotice("Mitglied entfernt.");
    } catch {
      setError("Mitglied konnte nicht entfernt werden.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <>
      <Eyebrow>Team</Eyebrow>
      <h1 className="studio-dash-page-title" style={{ color: P.ink }}>
        Mitglieder
      </h1>
      <p style={{ marginTop: 10, fontFamily: TOKENS.sans, fontSize: 14.5, color: P.ink2 }}>
        Lade Kolleginnen und Kollegen ein, um gemeinsam Motive zu erstellen.
      </p>

      <div style={{ marginTop: 18, background: P.surface2, border: `1px solid ${P.rule}`, borderRadius: 14, padding: 16 }}>
        <div style={{ fontFamily: TOKENS.sans, fontWeight: 650, fontSize: 14, color: P.ink }}>Neues Mitglied einladen</div>
        <p style={{ marginTop: 4, fontFamily: TOKENS.sans, fontSize: 13, color: P.ink3 }}>
          Wir schicken eine Einladungs-E-Mail mit Login-Link.
        </p>
        <div className="studio-team-invite-grid">
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontFamily: TOKENS.mono, fontSize: 10, color: P.ink3, textTransform: "uppercase", letterSpacing: 1 }}>E-Mail</span>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="kollege@beispiel.de"
              style={{ padding: "9px 11px", borderRadius: 8, border: `1px solid ${P.ruleStrong}`, fontFamily: TOKENS.sans, fontSize: 13.5, background: P.surface2 }}
              disabled={inviting}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontFamily: TOKENS.mono, fontSize: 10, color: P.ink3, textTransform: "uppercase", letterSpacing: 1 }}>Name (optional)</span>
            <input
              type="text"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              placeholder="Vorname Nachname"
              style={{ padding: "9px 11px", borderRadius: 8, border: `1px solid ${P.ruleStrong}`, fontFamily: TOKENS.sans, fontSize: 13.5, background: P.surface2 }}
              disabled={inviting}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontFamily: TOKENS.mono, fontSize: 10, color: P.ink3, textTransform: "uppercase", letterSpacing: 1 }}>Rolle</span>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as "admin" | "editor" | "viewer")}
              style={{ padding: "9px 11px", borderRadius: 8, border: `1px solid ${P.ruleStrong}`, fontFamily: TOKENS.sans, fontSize: 13.5, background: P.surface2 }}
              disabled={inviting}
            >
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
              <option value="viewer">Viewer</option>
            </select>
          </label>
          <button
            type="button"
            onClick={sendInvite}
            disabled={inviting}
            className="studio-team-invite-submit"
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              background: TOKENS.amber,
              color: STUDIO_ON_ACCENT,
              fontFamily: TOKENS.sans,
              fontWeight: 650,
              fontSize: 13,
              border: "none",
              cursor: inviting ? "default" : "pointer",
              opacity: inviting ? 0.7 : 1,
            }}
          >
            {inviting ? "Sende …" : "Einladen"}
          </button>
        </div>
        {error ? <p style={{ marginTop: 10, fontFamily: TOKENS.sans, fontSize: 12.5, color: "#A8351A" }}>{error}</p> : null}
        {notice ? <p style={{ marginTop: 10, fontFamily: TOKENS.sans, fontSize: 12.5, color: "#1F6F3B" }}>{notice}</p> : null}
      </div>

      <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
        {members.length === 0 ? (
          <div style={{ background: P.surface2, border: `1px solid ${P.rule}`, borderRadius: 14, padding: 20, fontFamily: TOKENS.sans, color: P.ink3 }}>Noch keine Teammitglieder.</div>
        ) : (
          members.map((m) => (
            <div key={m.id} className="studio-team-member-row" style={{ background: P.surface2, border: `1px solid ${P.rule}`, borderRadius: 14, padding: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 12, background: P.surface, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: TOKENS.sans, fontWeight: 700 }}>
                {initialsFromName(m.name || m.email)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: TOKENS.sans, fontWeight: 650, color: P.ink, fontSize: 13.5 }}>{m.name}</div>
                <div style={{ fontFamily: TOKENS.mono, fontSize: 10.5, color: P.ink3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.email}</div>
              </div>
              <div style={{ fontFamily: TOKENS.mono, fontSize: 10.5, color: P.ink3, textTransform: "uppercase", letterSpacing: 0.9 }}>
                {m.role} · {m.status}
              </div>
              {m.role !== "owner" ? (
                <button
                  type="button"
                  onClick={() => removeMember(m.id)}
                  disabled={removingId === m.id}
                  className="studio-team-member-actions"
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    background: "transparent",
                    border: `1px solid ${P.ruleStrong}`,
                    fontFamily: TOKENS.sans,
                    fontSize: 12,
                    color: removingId === m.id ? P.ink3 : "#A8351A",
                    cursor: removingId === m.id ? "default" : "pointer",
                    minHeight: 44,
                  }}
                >
                  {removingId === m.id ? "Entferne …" : "Entfernen"}
                </button>
              ) : null}
            </div>
          ))
        )}
      </div>
    </>
  );
}

function SettingsView({
  P,
  value,
  onChange,
  loaded,
  loadError,
  brandProfileComplete,
  brandProfileNotice,
  onOpenBrandTab,
  onOpenBrandSetup,
  onSkipBrandProfile,
  onResetBrandProfile,
}: {
  P: StudioPalette;
  value: SettingsPayload | null;
  onChange: (v: SettingsPayload) => void;
  loaded: boolean;
  loadError: string | null;
  brandProfileComplete: boolean;
  brandProfileNotice: string;
  onOpenBrandTab: () => void;
  onOpenBrandSetup: () => void;
  onSkipBrandProfile: () => void;
  onResetBrandProfile: () => void | Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const draft = value;

  const setField = <K extends keyof SettingsPayload>(key: K, next: SettingsPayload[K]) => {
    if (!draft) return;
    onChange({ ...draft, [key]: next });
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/dashboard/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(draft),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; settings?: SettingsPayload } | null;
      if (!res.ok) {
        setError(json?.error || "Einstellungen konnten nicht gespeichert werden.");
        return;
      }
      if (json?.settings) onChange(json.settings);
      setNotice("Gespeichert.");
    } catch {
      setError("Einstellungen konnten nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Eyebrow>Einstellungen</Eyebrow>
      <h1 className="studio-dash-page-title" style={{ color: P.ink }}>
        Profil & Marke
      </h1>
      <p style={{ marginTop: 10, fontFamily: TOKENS.sans, fontSize: 14.5, color: P.ink2 }}>
        Diese Angaben erscheinen in der Begrüßung und in Dashboard-Überschriften.
      </p>
      {!draft ? (
        <div
          style={{
            marginTop: 18,
            background: loadError
              ? "#FBEFE0"
              : "linear-gradient(180deg, rgba(245,237,223,0.04) 0%, rgba(245,237,223,0.01) 100%)",
            border: `1px solid ${loadError ? "rgba(193,59,31,0.30)" : P.rule}`,
            borderRadius: 16,
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {!loaded ? (
            <span style={{ fontFamily: TOKENS.sans, fontSize: 14, color: P.ink2 }}>Lade Einstellungen…</span>
          ) : loadError ? (
            <>
              <span style={{ fontFamily: TOKENS.sans, fontSize: 14, color: "#A8351A", fontWeight: 600 }}>
                {loadError}
              </span>
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{
                  alignSelf: "flex-start",
                  padding: "8px 14px",
                  borderRadius: 8,
                  background: TOKENS.amber,
                  color: STUDIO_ON_ACCENT,
                  fontFamily: TOKENS.sans,
                  fontWeight: 650,
                  fontSize: 13,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Erneut versuchen
              </button>
            </>
          ) : (
            <span style={{ fontFamily: TOKENS.sans, fontSize: 14, color: P.ink2 }}>
              Keine Einstellungen verfügbar. Bitte Seite neu laden oder Support kontaktieren.
            </span>
          )}
        </div>
      ) : (
        <>
          {brandProfileComplete && draft.brandProfileMode !== "skip" ? (
            <div className="studio-settings-brand-banner">
              <div className="studio-settings-brand-banner-inner">
                <div className="studio-settings-brand-banner-left">
                  <span className="studio-settings-brand-banner-icon" aria-hidden="true">
                    <StudioIcon name="shield" size={20} />
                  </span>
                  <div>
                    <div className="studio-settings-brand-banner-title">Markenprofil aktiv</div>
                    <div className="studio-settings-brand-banner-sub">
                      {draft.brandWebsiteUrl ? formatDomain(draft.brandWebsiteUrl) : draft.breweryName || "Marke"}
                      {" · "}
                      Brand-Lock auf „{brandLockLabel(draft.brandLockLevel)}“
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  <StudioButton type="button" variant="soft" size="sm" onClick={onOpenBrandTab}>
                    <StudioIcon name="pencil" size={15} />
                    Profil verwalten
                  </StudioButton>
                  <StudioButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    style={{ color: "var(--warn)" }}
                    onClick={() => {
                      const confirmed = window.confirm(
                        "Markenprofil wirklich löschen und generisch weitermachen? Gespeicherte Stil-Vorgaben werden entfernt.",
                      );
                      if (!confirmed) return;
                      void onResetBrandProfile();
                    }}
                  >
                    Generisch nutzen
                  </StudioButton>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 24, background: P.surface2, border: `1px solid ${P.rule}`, borderRadius: 16, padding: 18 }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontFamily: TOKENS.sans, fontWeight: 650, fontSize: 15 }}>Markenprofil</div>
                  <p style={{ marginTop: 6, maxWidth: 520, fontFamily: TOKENS.sans, fontSize: 13, color: P.ink2 }}>
                    {draft.brandProfileMode === "skip"
                      ? "Du nutzt EvGlab ohne Markenprofil. Über den Button kannst du jederzeit ein Profil aus deiner Website anlegen."
                      : "Lege dein Markenprofil fest: Website-Link eingeben, KI wertet Stil und Vorgaben aus."}
                  </p>
                  {draft.brandWebsiteUrl ? (
                    <p style={{ marginTop: 6, fontFamily: TOKENS.mono, fontSize: 11, color: P.ink3 }}>Quelle: {draft.brandWebsiteUrl}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={onOpenBrandSetup}
                  className="evg-cta"
                  style={{ padding: "10px 16px", borderRadius: 10, background: TOKENS.amber, color: STUDIO_ON_ACCENT, fontFamily: TOKENS.sans, fontWeight: 650, fontSize: 13, border: "none", cursor: "pointer", boxShadow: "0 10px 24px -10px rgba(230,106,43,0.55), inset 0 1px 0 rgba(255,255,255,0.18)" }}
                >
                  {draft.brandProfileMode === "skip" ? "Markenprofil erstellen" : "Markenprofil erstellen"}
                </button>
              </div>
              {brandProfileNotice ? <p style={{ marginTop: 10, fontFamily: TOKENS.sans, fontSize: 13, color: P.ink2 }}>{brandProfileNotice}</p> : null}
              {draft.brandProfileMode !== "skip" ? (
                <button
                  type="button"
                  onClick={onSkipBrandProfile}
                  style={{ marginTop: 14, padding: "8px 12px", borderRadius: 8, border: `1px solid ${P.ruleStrong}`, background: "transparent", fontFamily: TOKENS.sans, fontSize: 12, color: P.ink3 }}
                >
                  Ohne Markenprofil nutzen
                </button>
              ) : null}
            </div>
          )}

          <div className="studio-settings-two-col">
          <div style={{ background: P.surface2, border: `1px solid ${P.rule}`, borderRadius: 16, padding: 18 }}>
            <div style={{ fontFamily: TOKENS.sans, fontWeight: 650, fontSize: 14.5 }}>Dein Name</div>
            <p style={{ marginTop: 4, fontSize: 12.5, color: P.ink3 }}>z. B. „Guten Morgen, Team“</p>
            <input
              value={draft.profileName}
              onChange={(e) => setField("profileName", e.target.value)}
              style={{ marginTop: 12, width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${P.ruleStrong}`, fontFamily: TOKENS.sans, fontSize: 14 }}
            />
            <label style={{ display: "block", marginTop: 12, fontFamily: TOKENS.mono, fontSize: 10, color: P.ink3, textTransform: "uppercase", letterSpacing: 1 }}>
              Telefon
              <input
                value={draft.profilePhone}
                onChange={(e) => setField("profilePhone", e.target.value)}
                style={{ marginTop: 6, width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${P.ruleStrong}`, fontFamily: TOKENS.sans, fontSize: 14, display: "block" }}
              />
            </label>
          </div>
          <div style={{ background: P.surface2, border: `1px solid ${P.rule}`, borderRadius: 16, padding: 18 }}>
            <div style={{ fontFamily: TOKENS.sans, fontWeight: 650, fontSize: 14.5 }}>Marke</div>
            <p style={{ marginTop: 4, fontSize: 12.5, color: P.ink3 }}>z. B. „… für deine Marke“</p>
            <input
              value={draft.breweryName}
              onChange={(e) => setField("breweryName", e.target.value)}
              style={{ marginTop: 12, width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${P.ruleStrong}`, fontFamily: TOKENS.sans, fontSize: 14 }}
            />
          </div>
          </div>

          <div style={{ marginTop: 18, background: P.surface2, border: `1px solid ${P.rule}`, borderRadius: 16, padding: 18 }}>
            <div style={{ fontFamily: TOKENS.sans, fontWeight: 650, fontSize: 14.5 }}>Benachrichtigungen</div>
            <p style={{ marginTop: 4, fontSize: 12.5, color: P.ink3 }}>
              Wir schicken dir wichtige Updates und optional einen Wochenrückblick.
            </p>
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <SettingsToggle
                P={P}
                checked={draft.emailNotifications}
                onChange={(v) => setField("emailNotifications", v)}
                label="E-Mail-Benachrichtigungen"
                hint="Status zu Generierungen, Einladungen und Sicherheit."
              />
              <SettingsToggle
                P={P}
                checked={draft.weeklySummary}
                onChange={(v) => setField("weeklySummary", v)}
                label="Wochenzusammenfassung"
                hint="Jeden Montag eine kurze E-Mail mit deinen Highlights."
              />
            </div>
          </div>

          <div className="studio-settings-save-row">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="evg-cta"
              style={{ padding: "10px 18px", borderRadius: 10, background: TOKENS.amber, color: STUDIO_ON_ACCENT, fontFamily: TOKENS.sans, fontWeight: 650, fontSize: 13.5, border: "none", opacity: saving ? 0.7 : 1, cursor: saving ? "default" : "pointer", boxShadow: "0 10px 24px -10px rgba(230,106,43,0.55), inset 0 1px 0 rgba(255,255,255,0.18)" }}
            >
              {saving ? "Speichert…" : "Speichern"}
            </button>
            {notice ? <span style={{ fontFamily: TOKENS.sans, fontSize: 13.5, color: P.ink2 }}>{notice}</span> : null}
            {error ? <span style={{ fontFamily: TOKENS.sans, fontSize: 13.5, color: "#B42318" }}>{error}</span> : null}
          </div>

          <div
            style={{
              marginTop: 28,
              paddingTop: 24,
              borderTop: `1px solid ${P.rule}`,
            }}
          >
            <div style={{ fontFamily: TOKENS.sans, fontWeight: 600, fontSize: 14, color: P.ink }}>Konto</div>
            <p style={{ marginTop: 6, fontFamily: TOKENS.sans, fontSize: 13, color: P.ink2, lineHeight: 1.5 }}>
              Melde dich ab, um die Sitzung auf diesem Gerät zu beenden. Du landest wieder auf der Anmeldeseite.
            </p>
            <button
              type="button"
              disabled={signingOut}
              onClick={() => {
                setSigningOut(true);
                void signOutAndRedirect();
              }}
              className="studio-btn studio-btn-ghost"
              style={{ marginTop: 14, display: "inline-flex", alignItems: "center", gap: 8, opacity: signingOut ? 0.7 : 1 }}
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M7 17 H4a1 1 0 0 1-1-1 V4a1 1 0 0 1 1-1h3" />
                <path d="M13 14 L17 10 L13 6" />
                <path d="M17 10 H7" />
              </svg>
              {signingOut ? "Abmelden …" : "Abmelden"}
            </button>
          </div>
        </>
      )}
    </>
  );
}

function SettingsToggle({
  P,
  checked,
  onChange,
  label,
  hint,
}: {
  P: StudioPalette;
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 14,
        padding: "10px 12px",
        borderRadius: 10,
        border: `1px solid ${P.rule}`,
        background: P.surface2,
        cursor: "pointer",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: TOKENS.sans, fontWeight: 600, fontSize: 13.5, color: P.ink }}>{label}</div>
        {hint ? (
          <div style={{ marginTop: 2, fontFamily: TOKENS.sans, fontSize: 12.5, color: P.ink3 }}>{hint}</div>
        ) : null}
      </div>
      <span
        role="switch"
        aria-checked={checked}
        style={{
          flexShrink: 0,
          width: 36,
          height: 20,
          borderRadius: 999,
          background: checked ? P.accent : "#D7CFC1",
          position: "relative",
          transition: "background .15s",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: 999,
            background: P.surface2,
            boxShadow: "0 1px 2px rgba(0,0,0,0.12)",
            transition: "left .15s",
          }}
        />
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
        tabIndex={-1}
        aria-hidden="true"
      />
    </label>
  );
}
