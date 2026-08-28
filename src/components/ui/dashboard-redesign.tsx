"use client";

import "@/styles/studio-dashboard-home.css";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { StudioViewTransition } from "@/components/studio/studio-view-transition";
import { MARKETING_SITE_URL } from "@/lib/siteConfig";
import { useStudioShell } from "@/components/studio/studio-workspace-shell";
import {
  STUDIO_PAD_X,
  STUDIO_TOKENS,
  useStudioPalette,
  type StudioPalette,
} from "@/components/ui/dashboard-studio-shell";
import { StudioPricingView } from "@/components/studio/studio-pricing-view";
import { StudioButton, StudioIconButton, StudioPageHeader } from "@/components/studio/ui";
import { StudioIcon } from "@/components/studio/icons";
import { brandLockLabel, formatDomain } from "@/lib/brand/brand-profile-display";
import { BrandProfileView } from "@/components/dashboard/BrandProfileView";
import { BrandProfileSetupModal, type BrandScanSuggestion } from "@/components/dashboard/BrandProfileSetupModal";
import { DashboardHomeView } from "@/components/studio/dashboard/dashboard-home-view";
import { type SubscriptionPlanKey } from "@/lib/billing/tokenState";
import { hasActiveSubscriptionFromState } from "@/lib/billing/access";
import {
  clearHomepageCheckoutParams,
  getHomepageCheckoutPlan,
  startBillingCheckout,
} from "@/lib/billing/checkoutClient";
import { buildGenericBrandProfilePatch, isBrandProfileCompleteFromSettings } from "@/lib/dashboard/brandProfile";
import { mergeDashboardSettings, sanitizeDashboardSettings } from "@/lib/dashboard/settingsPayload";
import { formatChargeNumber, getMediaDisplayTitle } from "@/lib/dashboard/metadata";
import { fetchWithRetry } from "@/lib/http/fetchWithRetry";
import { signOutAndRedirect } from "@/lib/auth/signOutClient";

type DashboardTab = "dashboard" | "media" | "team" | "brand" | "settings" | "pricing";

type DashboardSummary = {
  unlimited?: boolean;
  tokens: { monthly: number; used: number; remaining: number; unlimited?: boolean };
  periodEnd?: string | null;
  postsThisMonth: number;
  chargesTotal?: number;
  activeCampaigns?: number;
  teamMembers: number;
  openInvites: number;
  billingStatus: string;
  plan: string | null;
  degradedBilling?: boolean;
};

type MediaItem = {
  id: string;
  imageUrl: string;
  title?: string;
  prompt: string;
  createdAt: string;
  aspectRatio: string;
  resolution: "1K" | "2K" | "4K";
  outputFormat: "png" | "jpg";
  generation?: { chargeNumber?: number | null } | null;
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
  brandLabelReferenceUrl: string;
  brandAnalyzedAt?: string;
};

const TOKENS = STUDIO_TOKENS;
const STUDIO_EASE = [0.22, 0.68, 0.2, 1] as const;
const MEDIA_LIGHTBOX_SPRING = { type: "spring" as const, stiffness: 420, damping: 36, mass: 0.85 };


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

function getMediaAssetUrl(item: MediaItem): string {
  if (item.imageUrl.startsWith("/api/kie/download?")) return item.imageUrl;
  return `/api/kie/download?url=${encodeURIComponent(item.imageUrl)}&format=${item.outputFormat}&taskId=${encodeURIComponent(item.id)}`;
}

async function downloadMediaItem(item: MediaItem): Promise<string | null> {
  const response = await fetch(getMediaAssetUrl(item));
  if (!response.ok) {
    try {
      const payload = (await response.json()) as { error?: string };
      return payload.error ?? "Download fehlgeschlagen.";
    } catch {
      return "Download fehlgeschlagen.";
    }
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = `brewai-${item.id}.${item.outputFormat}`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);
  return null;
}


const isBrandProfileComplete = isBrandProfileCompleteFromSettings;
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

function Placeholder({
  label,
  w = "100%",
  h = 64,
  tone = "cream",
  radius = 0,
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
          borderRadius: 2,
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
  const [summaryLoaded, setSummaryLoaded] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [brandProfileSetupOpen, setBrandProfileSetupOpen] = useState(false);
  const [brandQuickStartUrl, setBrandQuickStartUrl] = useState("");
  const [brandAutoAnalyzeSignal, setBrandAutoAnalyzeSignal] = useState(0);
  const [showBrandProfileChoice, setShowBrandProfileChoice] = useState(false);
  const [brandProfileNotice, setBrandProfileNotice] = useState("");
  const [pricingCheckoutError, setPricingCheckoutError] = useState<string | null>(null);
  const homepageCheckoutStartedRef = useRef(false);

  const profileName = settings?.profileName?.trim() || initialProfileName?.trim() || "";
  const breweryName = settings?.breweryName?.trim() || initialBreweryName?.trim() || "";
  const accountName = breweryName || profileName || "BrewAI";
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

    const load = async (url: string) => {
      const res = await fetch(url, { cache: "no-store", credentials: "include" });
      if (res.status === 401) {
        window.location.href = "/anmelden";
        return null;
      }
      return res;
    };

    void (async () => {
      try {
        const res = await load("/api/dashboard/media");
        if (!res || ignore) return;
        if (res.ok) {
          const json = (await res.json()) as { items?: MediaItem[] };
          if (Array.isArray(json.items)) setMedia(json.items);
        }
      } catch {
        /* Mediathek separat — Fehler nicht als Dashboard-Totalschaden */
      } finally {
        if (!ignore) setMediaLoaded(true);
      }
    })();

    void (async () => {
      try {
        const res = await load("/api/dashboard/summary");
        if (!res || ignore) return;
        if (res.ok) {
          const json = (await res.json()) as { summary?: DashboardSummary };
          if (json.summary) {
            setSummary(json.summary);
            setSummaryError(null);
          }
        } else {
          setSummaryError("Übersicht konnte nicht geladen werden.");
        }
      } catch {
        if (!ignore) setSummaryError("Netzwerkfehler beim Laden der Übersicht.");
      } finally {
        if (!ignore) setSummaryLoaded(true);
      }
    })();

    void (async () => {
      try {
        const res = await load("/api/dashboard/team");
        if (!res || ignore || !res.ok) return;
        const json = (await res.json()) as { members?: TeamMember[] };
        if (Array.isArray(json.members)) setTeam(json.members);
      } catch {
        /* Team optional */
      }
    })();

    void (async () => {
      try {
        const res = await load("/api/dashboard/settings");
        if (!res || ignore) return;
        if (res.ok) {
          const json = (await res.json()) as { settings?: SettingsPayload };
          if (json.settings) {
            setSettings(normalizeSettings(json.settings));
            setSettingsError(null);
          }
        } else {
          const fallback = (await res.json().catch(() => null)) as { error?: string } | null;
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
          const json = (await res.json()) as { summary?: DashboardSummary };
          if (json.summary) setSummary(json.summary);
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
        brandLabelReferenceUrl: suggestion.brandLabelReferenceUrl ?? "",
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
        <DashboardHomeView
          summary={summary}
          summaryLoaded={summaryLoaded}
          summaryError={summaryError}
          media={media}
          mediaLoaded={mediaLoaded}
          settings={settings}
          settingsLoaded={settingsLoaded}
          profileName={profileName}
          breweryName={breweryName}
          brandProfileComplete={brandProfileComplete}
          brandProfileMode={brandProfileMode}
          onOpenTab={changeTab}
          onOpenBrandSetup={() => {
            changeTab("brand");
            setBrandProfileSetupOpen(true);
          }}
          onRetrySummary={() => {
            setSummaryLoaded(false);
            setSummaryError(null);
            void fetch("/api/dashboard/summary", { cache: "no-store", credentials: "include" })
              .then(async (res) => {
                if (!res.ok) throw new Error("fail");
                const json = (await res.json()) as { summary?: DashboardSummary };
                if (json.summary) setSummary(json.summary);
              })
              .catch(() => setSummaryError("Übersicht konnte nicht geladen werden."))
              .finally(() => setSummaryLoaded(true));
          }}
        />
      ) : null}
      {tab === "media" ? (
        <MediaView
          P={P}
          items={media}
          loaded={mediaLoaded}
          onItemsChange={setMedia}
          hasActivePlan={hasActivePlan}
          initialQuery={searchParams.get("q") ?? ""}
        />
      ) : null}
      {tab === "team" ? <TeamView P={P} members={team} onMembersChange={setTeam} /> : null}
      {tab === "brand" ? (
        <BrandProfileView
          value={settings}
          loaded={settingsLoaded}
          loadError={settingsError}
          brandProfileComplete={brandProfileComplete}
          brandProfileNotice={brandProfileNotice}
          onOpenBrandSetup={() => setBrandProfileSetupOpen(true)}
          onQuickAnalyze={(url) => {
            setBrandQuickStartUrl(url);
            setBrandAutoAnalyzeSignal((n) => n + 1);
            setBrandProfileSetupOpen(true);
          }}
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
      initialWebsiteUrl={brandQuickStartUrl}
      autoAnalyzeSignal={brandAutoAnalyzeSignal}
    />

    {showBrandProfileChoice ? (
      <div
        className="fixed inset-0 z-[126] flex items-center justify-center px-4"
        style={{ background: "rgba(19,18,17,0.72)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}
        onClick={() => setShowBrandProfileChoice(false)}
      >
        <div
          className="evg-dialog relative w-full max-w-lg p-7"
          style={{ background: "var(--field)", color: "var(--fg)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            aria-label="Schliessen"
            onClick={() => setShowBrandProfileChoice(false)}
            className="evg-btn absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center"
            style={{ color: "var(--fg-5)", padding: 0 }}
          >
            ×
          </button>
          <h3 className="evg-h1" style={{ fontSize: 18 }}>Willst du deinen Markenstil fixieren?</h3>
          <p className="mt-2 text-sm" style={{ color: "var(--fg-3)" }}>
            Gib einfach die Website deiner Marke ein — die KI erkennt Tonality, Farben und Bildsprache und erstellt
            dein Markenprofil. Du kannst das später unter Einstellungen jederzeit ändern.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button type="button" onClick={handleChooseBrandProfileGuided} className="evg-btn evg-btn--primary">
              Ja, Markenprofil anlegen
            </button>
            <button type="button" onClick={() => void handleSkipBrandProfile()} className="evg-btn">
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


function MediaView({
  P,
  items,
  loaded = true,
  onItemsChange,
  hasActivePlan = true,
  initialQuery = "",
}: {
  P: StudioPalette;
  items: MediaItem[];
  loaded?: boolean;
  onItemsChange: (next: MediaItem[]) => void;
  hasActivePlan?: boolean;
  initialQuery?: string;
}) {
  const reduceMotion = useReducedMotion();
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState(initialQuery);
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [titleSaving, setTitleSaving] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    setSearch(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (!selectedItem) return;
    setTitleDraft(getMediaDisplayTitle(selectedItem));
    setTitleError(null);
    const focusTimer = window.setTimeout(() => titleInputRef.current?.focus(), reduceMotion ? 0 : 180);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedItem(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedItem, reduceMotion]);

  const openMediaItem = useCallback((item: MediaItem) => {
    setDownloadError(null);
    setTitleError(null);
    setSelectedItem(item);
  }, []);

  const saveMediaTitle = useCallback(
    async (item: MediaItem, nextTitle: string) => {
      const trimmed = nextTitle.trim();
      if (!trimmed) {
        setTitleError("Bitte einen Titel eingeben.");
        return;
      }
      if (trimmed === getMediaDisplayTitle(item)) return;

      setTitleSaving(true);
      setTitleError(null);
      try {
        const res = await fetch("/api/dashboard/media", {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: item.id, title: trimmed }),
        });
        const json = (await res.json().catch(() => null)) as { error?: string; items?: MediaItem[] } | null;
        if (!res.ok) {
          setTitleError(json?.error ?? "Titel konnte nicht gespeichert werden.");
          return;
        }
        const nextItems = Array.isArray(json?.items) ? json.items : items.map((entry) => (entry.id === item.id ? { ...entry, title: trimmed } : entry));
        onItemsChange(nextItems);
        setSelectedItem((current) => (current?.id === item.id ? { ...current, title: trimmed } : current));
      } catch {
        setTitleError("Titel konnte nicht gespeichert werden.");
      } finally {
        setTitleSaving(false);
      }
    },
    [items, onItemsChange],
  );

  const handleDownload = useCallback(async (item: MediaItem) => {
    setDownloading(true);
    setDownloadError(null);
    try {
      const error = await downloadMediaItem(item);
      if (error) setDownloadError(error);
    } catch {
      setDownloadError("Download fehlgeschlagen.");
    } finally {
      setDownloading(false);
    }
  }, []);

  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        getMediaDisplayTitle(it).toLowerCase().includes(q) ||
        it.prompt.toLowerCase().includes(q) ||
        it.aspectRatio.toLowerCase().includes(q) ||
        it.resolution.toLowerCase().includes(q),
    );
  }, [items, search]);

  return (
    <>
      <StudioPageHeader
        eyebrow="Mediathek"
        title="Deine Motive"
        meta={`${items.length} Motive`}
        subtitle="Alle generierten Bilder deiner Marke — sortiert nach Datum."
      />
      {items.length > 0 ? (
        <div style={{ marginTop: 18, maxWidth: 420 }}>
          <input
            className="evg-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Motive durchsuchen …"
            aria-label="Mediathek durchsuchen"
            style={{ width: "100%", height: 36 }}
          />
        </div>
      ) : null}
      <LayoutGroup id="studio-media-library">
      {visibleItems.length === 0 ? (
        <div className="evg-none">
          {!loaded
            ? "Motive werden geladen …"
            : items.length === 0
              ? (
                <>
                  Noch keine Motive.{" "}
                  <Link href={hasActivePlan ? "/inhalte-erstellen" : "/dashboard?tab=pricing"}>
                    {hasActivePlan ? "Jetzt erstellen →" : "Tarif wählen →"}
                  </Link>
                </>
              )
              : "Keine Motive passen zur Suche."}
        </div>
      ) : (
      <div className="evg-grid" style={{ marginTop: 22 }}>
          {visibleItems.map((it) => (
            <button
              key={it.id}
              type="button"
              className="evg-tile"
              onClick={() => openMediaItem(it)}
              aria-label={`${getMediaDisplayTitle(it)} in Großansicht öffnen`}
              style={{ width: "100%", padding: 0, textAlign: "left", font: "inherit", color: "inherit" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <motion.img
                layoutId={reduceMotion ? undefined : `studio-media-${it.id}`}
                src={getMediaAssetUrl(it)}
                alt=""
                transition={reduceMotion ? { duration: 0 } : MEDIA_LIGHTBOX_SPRING}
              />
              <div className="evg-tile__cap">
                <span>{clampText(getMediaDisplayTitle(it), 48)}</span>
                <span>{it.aspectRatio}</span>
              </div>
            </button>
          ))}
      </div>
      )}
      <AnimatePresence>
        {selectedItem ? (
          <motion.div
            key="studio-media-lightbox"
            role="dialog"
            aria-modal="true"
            aria-label="Bild in Großansicht"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.12 : 0.22, ease: STUDIO_EASE }}
            onClick={() => setSelectedItem(null)}
            className="evg-scrim"
            style={{
              zIndex: 120,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
            }}
          >
            <motion.div
              onClick={(event) => event.stopPropagation()}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
              transition={{ duration: reduceMotion ? 0.12 : 0.22, ease: STUDIO_EASE }}
              className="evg-dialog"
              style={{
                position: "relative",
                width: "min(1100px, 100%)",
                maxHeight: "min(92vh, 900px)",
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) minmax(240px, 320px)",
                gap: 16,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: P.surface2,
                  padding: 20,
                  minHeight: 280,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <motion.img
                  layoutId={reduceMotion ? undefined : `studio-media-${selectedItem.id}`}
                  src={getMediaAssetUrl(selectedItem)}
                  alt={getMediaDisplayTitle(selectedItem)}
                  style={{ maxWidth: "100%", maxHeight: "min(78vh, 760px)", objectFit: "contain" }}
                  transition={reduceMotion ? { duration: 0 } : MEDIA_LIGHTBOX_SPRING}
                />
              </div>
              <aside style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <label htmlFor={`media-title-${selectedItem.id}`} className="evg-rubrik">
                    Motiv-Titel
                  </label>
                  <input
                    id={`media-title-${selectedItem.id}`}
                    ref={titleInputRef}
                    className="evg-input"
                    value={titleDraft}
                    onChange={(event) => setTitleDraft(event.target.value)}
                    onBlur={() => {
                      if (selectedItem) void saveMediaTitle(selectedItem, titleDraft);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        if (selectedItem) void saveMediaTitle(selectedItem, titleDraft);
                      }
                    }}
                    maxLength={120}
                    disabled={titleSaving}
                    placeholder="z. B. Hefeweizen · Hero-Glas · Public Viewing"
                    style={{ marginTop: 8, height: 36, fontWeight: 500 }}
                  />
                  <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 11.5, color: "var(--fg-5)" }}>Enter oder Speichern</span>
                    <StudioButton
                      size="sm"
                      variant="soft"
                      disabled={titleSaving || titleDraft.trim() === getMediaDisplayTitle(selectedItem)}
                      onClick={() => void saveMediaTitle(selectedItem, titleDraft)}
                    >
                      Titel speichern
                    </StudioButton>
                  </div>
                  <dl className="evg-sheet" style={{ marginTop: 14 }}>
                    <dt>Format</dt>
                    <dd>{selectedItem.resolution} · {selectedItem.aspectRatio} · {selectedItem.outputFormat.toUpperCase()}</dd>
                    <dt>Zeit</dt>
                    <dd>{formatRelativeTime(selectedItem.createdAt)}</dd>
                  </dl>
                </div>
                <StudioIconButton aria-label="Schließen" onClick={() => setSelectedItem(null)}>
                  <StudioIcon name="x" size={16} />
                </StudioIconButton>
              </div>
              {titleError ? <p className="evg-note" style={{ margin: 0, fontSize: 12.5 }}>{titleError}</p> : null}
              {titleSaving ? (
                <p style={{ margin: 0, fontSize: 12.5, color: "var(--fg-5)" }}>Titel wird gespeichert …</p>
              ) : null}
              {downloadError ? <p className="evg-note" style={{ margin: 0, fontSize: 12.5 }}>{downloadError}</p> : null}
              <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                <StudioButton disabled={downloading} onClick={() => void handleDownload(selectedItem)}>
                  {downloading ? "Wird heruntergeladen …" : "Herunterladen"}
                </StudioButton>
                <StudioButton variant="ghost" onClick={() => setSelectedItem(null)}>
                  Schließen
                </StudioButton>
              </div>
              </aside>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      </LayoutGroup>
    </>
  );
}

function TeamView({
  members,
  onMembersChange,
}: {
  P?: StudioPalette;
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
      <StudioPageHeader
        eyebrow="Team"
        title="Mitglieder"
        meta={`${members.length}`}
        subtitle="Lade Kolleginnen und Kollegen ein, um gemeinsam Motive zu erstellen."
      />

      <div style={{ marginTop: 18 }}>
        <div className="evg-field">
          <div>
            <div className="evg-field__l">E-Mail</div>
            <div className="evg-field__h">Einladung mit Login-Link</div>
          </div>
          <input
            type="email"
            className="evg-input"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="kollege@beispiel.de"
            disabled={inviting}
          />
        </div>
        <div className="evg-field">
          <div>
            <div className="evg-field__l">Name</div>
            <div className="evg-field__h">Optional</div>
          </div>
          <input
            type="text"
            className="evg-input"
            value={inviteName}
            onChange={(e) => setInviteName(e.target.value)}
            placeholder="Vorname Nachname"
            disabled={inviting}
          />
        </div>
        <div className="evg-field">
          <div>
            <div className="evg-field__l">Rolle</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <select
              className="evg-input"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as "admin" | "editor" | "viewer")}
              disabled={inviting}
              style={{ flex: 1, minWidth: 140 }}
            >
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
              <option value="viewer">Viewer</option>
            </select>
            <button type="button" onClick={sendInvite} disabled={inviting} className="evg-btn evg-btn--primary">
              {inviting ? "Sende …" : "Einladen"}
            </button>
          </div>
        </div>
        {error ? <p style={{ marginTop: 10, fontSize: 12.5, color: "var(--err)" }}>{error}</p> : null}
        {notice ? <p style={{ marginTop: 10, fontSize: 12.5, color: "var(--ok)" }}>{notice}</p> : null}
      </div>

      {members.length === 0 ? (
        <div className="evg-none">Noch keine Teammitglieder.</div>
      ) : (
        <div style={{ marginTop: 8 }}>
          {members.map((m) => (
            <div key={m.id} className="evg-entry">
              <span className="evg-entry__ico" aria-hidden="true">
                <StudioIcon name="users" size={16} />
              </span>
              <div>
                <div className="evg-entry__t">{m.name}</div>
                <div className="evg-entry__s">{m.email}</div>
              </div>
              <div className="evg-entry__end" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="evg-mark">{m.role}</span>
                {m.role !== "owner" ? (
                  <button
                    type="button"
                    onClick={() => removeMember(m.id)}
                    disabled={removingId === m.id}
                    className="evg-btn evg-btn--danger"
                  >
                    {removingId === m.id ? "Entferne …" : "Entfernen"}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function SettingsView({
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
  P?: StudioPalette;
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
      // Sidebar-Fußzeile (Avatar + Name) sofort aktualisieren, ohne Server-Reload.
      const savedSettings = json?.settings ?? draft;
      window.dispatchEvent(
        new CustomEvent("evglab-profile-updated", {
          detail: {
            breweryName: savedSettings.breweryName ?? "",
            profileName: savedSettings.profileName ?? "",
          },
        }),
      );
      setNotice("Gespeichert.");
    } catch {
      setError("Einstellungen konnten nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <StudioPageHeader
        eyebrow="Einstellungen"
        title="Profil & Marke"
        subtitle="Diese Angaben erscheinen in der Begrüßung und in Dashboard-Überschriften."
      />
      {!draft ? (
        <div className="evg-none">
          {!loaded ? (
            "Lade Einstellungen…"
          ) : loadError ? (
            <>
              {loadError}{" "}
              <button type="button" onClick={() => window.location.reload()}>
                Erneut versuchen
              </button>
            </>
          ) : (
            "Keine Einstellungen verfügbar."
          )}
        </div>
      ) : (
        <>
          {brandProfileComplete && draft.brandProfileMode !== "skip" ? (
            <div className="evg-callout" style={{ marginInline: 0, marginTop: 22 }}>
              <div className="evg-callout__body">
                <div className="evg-callout__t">Markenprofil aktiv</div>
                <div className="evg-callout__s">
                  {draft.brandWebsiteUrl ? formatDomain(draft.brandWebsiteUrl) : draft.breweryName || "Marke"}
                  {" · "}
                  Brand-Lock auf „{brandLockLabel(draft.brandLockLevel)}“
                </div>
              </div>
              <StudioButton type="button" variant="soft" size="sm" onClick={onOpenBrandTab}>
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
          ) : (
            <div className="evg-callout" style={{ marginInline: 0, marginTop: 22 }}>
              <div className="evg-callout__body">
                <div className="evg-callout__t">Markenprofil</div>
                <div className="evg-callout__s">
                  {draft.brandProfileMode === "skip"
                    ? "Du nutzt BrewAI ohne Markenprofil. Über den Button kannst du jederzeit ein Profil anlegen."
                    : "Lege dein Markenprofil fest: Website-Link eingeben, KI wertet Stil und Vorgaben aus."}
                  {brandProfileNotice ? ` · ${brandProfileNotice}` : ""}
                </div>
              </div>
              <StudioButton type="button" variant="primary" size="sm" onClick={onOpenBrandSetup}>
                Markenprofil erstellen
              </StudioButton>
              {draft.brandProfileMode !== "skip" ? (
                <StudioButton type="button" variant="ghost" size="sm" onClick={onSkipBrandProfile}>
                  Ohne Markenprofil nutzen
                </StudioButton>
              ) : null}
            </div>
          )}

          <div style={{ marginTop: 8 }}>
            <div className="evg-field">
              <div>
                <div className="evg-field__l">Dein Name</div>
                <div className="evg-field__h">z. B. „Guten Morgen, Team“</div>
              </div>
              <input
                className="evg-input"
                value={draft.profileName}
                onChange={(e) => setField("profileName", e.target.value)}
              />
            </div>
            <div className="evg-field">
              <div>
                <div className="evg-field__l">Telefon</div>
              </div>
              <input
                className="evg-input"
                value={draft.profilePhone}
                onChange={(e) => setField("profilePhone", e.target.value)}
              />
            </div>
            <div className="evg-field">
              <div>
                <div className="evg-field__l">Marke</div>
                <div className="evg-field__h">z. B. „… für deine Marke“</div>
              </div>
              <input
                className="evg-input"
                value={draft.breweryName}
                onChange={(e) => setField("breweryName", e.target.value)}
              />
            </div>
            <SettingsToggle
              checked={draft.emailNotifications}
              onChange={(v) => setField("emailNotifications", v)}
              label="E-Mail-Benachrichtigungen"
              hint="Status zu Generierungen, Einladungen und Sicherheit."
            />
            <SettingsToggle
              checked={draft.weeklySummary}
              onChange={(v) => setField("weeklySummary", v)}
              label="Wochenzusammenfassung"
              hint="Jeden Montag eine kurze E-Mail mit deinen Highlights."
            />
          </div>

          <div className="studio-settings-save-row" style={{ marginTop: 18 }}>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="evg-btn evg-btn--primary"
              style={{ opacity: saving ? 0.7 : 1 }}
            >
              {saving ? "Speichert…" : "Speichern"}
            </button>
            {notice ? <span style={{ fontSize: 13.5, color: "var(--fg-3)" }}>{notice}</span> : null}
            {error ? <span style={{ fontSize: 13.5, color: "var(--err)" }}>{error}</span> : null}
          </div>

          <div style={{ marginTop: 28, paddingTop: 24, borderTop: "1px solid var(--line)" }}>
            <div className="evg-field">
              <div>
                <div className="evg-field__l">Konto</div>
                <div className="evg-field__h">Sitzung auf diesem Gerät beenden</div>
              </div>
              <button
                type="button"
                disabled={signingOut}
                onClick={() => {
                  setSigningOut(true);
                  void signOutAndRedirect();
                }}
                className="evg-btn"
                style={{ justifySelf: "start", opacity: signingOut ? 0.7 : 1 }}
              >
                {signingOut ? "Abmelden …" : "Abmelden"}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function SettingsToggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="evg-field" style={{ cursor: "pointer" }}>
      <div>
        <div className="evg-field__l">{label}</div>
        {hint ? <div className="evg-field__h">{hint}</div> : null}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 16, height: 16, accentColor: "var(--acc)", justifySelf: "start" }}
      />
    </label>
  );
}
