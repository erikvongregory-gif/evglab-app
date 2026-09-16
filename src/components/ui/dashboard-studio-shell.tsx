"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { StudioViewTransition } from "@/components/studio/studio-view-transition";
import { StudioTokenBadge, type StudioTokenCharge } from "@/components/studio/studio-token-badge";
import { studioFontClassName } from "@/lib/fonts/studio-fonts";
import { signOutAndRedirect } from "@/lib/auth/signOutClient";
import { isVideosCreateEnabled } from "@/lib/featureFlags";
import {
  StudioSearchProvider,
  StudioTopbarSearchDesktop,
  StudioTopbarSearchMobile,
} from "@/components/studio/studio-global-search";
import { useStudioOnboarding } from "@/components/studio/onboarding/onboarding-context";
import { EvglabMark } from "@/components/studio/evglab-mark";
import {
  StudioUiDialog,
  StudioUiDialogContent,
  StudioUiDialogDescription,
  StudioUiDialogHeader,
  StudioUiDialogTitle,
  StudioUiToaster,
  StudioUiTooltip,
  StudioUiTooltipContent,
  StudioUiTooltipProvider,
  StudioUiTooltipTrigger,
} from "@/components/studio/ui";
import { cn } from "@/lib/utils";

const PRICING_HREF = "/dashboard?tab=pricing";
const MOBILE_QUERY =
  "(max-width: 767px), ((hover: none) and (pointer: coarse) and (max-width: 1023px))";
/** Intent-Delay wie Studio-Sidebars: nicht bei jedem Streifen sofort auf. */
const RAIL_OPEN_MS = 90;
const RAIL_CLOSE_MS = 120;

export type StudioRecentMediaItem = {
  id: string;
  imageUrl: string;
  title: string;
  prompt: string;
  createdAt: string;
  aspectRatio: string;
  resolution: "1K" | "2K" | "4K";
  chargeNumber?: number | null;
};

/** Content gutter — matches BrewAI Studio redesign */
export const STUDIO_PAD_X = 24;

/** Studio design tokens (CSS vars on .evg-studio) — mapped to Sudbuch vars */
export const STUDIO_TOKENS = {
  paper: "var(--page)",
  paper2: "var(--app)",
  ink: "var(--fg)",
  ink2: "var(--fg-2)",
  ink3: "var(--fg-4)",
  amber: "var(--acc)",
  amber2: "var(--acc-hover)",
  ember: "var(--acc)",
  glow: "var(--acc-dim)",
  sans: "var(--f-sans)",
  /** Kein Serif in Produkt-UI — Newsreader nur über --f-brand am Logo */
  accentSerif: "var(--f-sans)",
  serif: "var(--f-sans)",
  mono: "var(--f-mono)",
  gradientBrand: "var(--acc)",
  gradientGlow: "transparent",
  gradientCard: "var(--field)",
};

/** Text on amber CTAs */
export const STUDIO_ON_ACCENT = "var(--acc-fg)";

export type StudioPalette = {
  bg: string;
  surface: string;
  surface2: string;
  ink: string;
  ink2: string;
  ink3: string;
  muted: string;
  rule: string;
  ruleStrong: string;
  accent: string;
  accent2: string;
};

export type StudioNavKey =
  | "dashboard"
  | "assistant"
  | "create"
  | "create-video"
  | "media"
  | "team"
  | "brand"
  | "settings"
  | "pricing";

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "?";
  const b = parts.length > 1 ? parts[1]?.[0] : parts[0]?.[1];
  return (a + (b ?? "")).toUpperCase();
}

function padCharge(n: number) {
  return String(n).padStart(4, "0");
}

function formatChargeRange(items: StudioRecentMediaItem[]): string | null {
  const nums = items
    .map((i) => i.chargeNumber)
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  if (nums.length === 0) return null;
  const hi = Math.max(...nums);
  const lo = Math.min(...nums);
  return hi === lo ? padCharge(hi) : `${padCharge(hi)} – ${padCharge(lo)}`;
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return matches;
}

function BrewAILogoMark() {
  return (
    <span className="evg-rail__mark" aria-hidden="true">
      <EvglabMark size={22} />
    </span>
  );
}

/** Nav icons — Iconsax Linear (24px), stroke 1.5, currentColor */
function SidebarIcon({ name, color = "currentColor" }: { name: string; color?: string }) {
  const map: Record<string, React.ReactNode> = {
    home: (
      <>
        <path d="M9.02 2.84 L3.63 7.04 C2.73 7.74 2 9.23 2 10.36 V17.77 C2 20.09 3.89 21.99 6.21 21.99 H17.79 C20.11 21.99 22 20.09 22 17.78 V10.5 C22 9.29 21.19 7.74 20.2 7.05 L14.02 2.72 C12.62 1.74 10.37 1.79 9.02 2.84 Z" />
        <path d="M12 18 V15" />
      </>
    ),
    dash: (
      <>
        <path d="M22 10.9 V4.1 C22 2.6 21.36 2 19.77 2 H15.73 C14.14 2 13.5 2.6 13.5 4.1 V10.9 C13.5 12.4 14.14 13 15.73 13 H19.77 C21.36 13 22 12.4 22 10.9 Z" />
        <path d="M22 19.9 V18.1 C22 16.6 21.36 16 19.77 16 H15.73 C14.14 16 13.5 16.6 13.5 18.1 V19.9 C13.5 21.4 14.14 22 15.73 22 H19.77 C21.36 22 22 21.4 22 19.9 Z" />
        <path d="M10.5 13.1 V19.9 C10.5 21.4 9.86 22 8.27 22 H4.23 C2.64 22 2 21.4 2 19.9 V13.1 C2 11.6 2.64 11 4.23 11 H8.27 C9.86 11 10.5 11.6 10.5 13.1 Z" />
        <path d="M10.5 4.1 V5.9 C10.5 7.4 9.86 8 8.27 8 H4.23 C2.64 8 2 7.4 2 5.9 V4.1 C2 2.6 2.64 2 4.23 2 H8.27 C9.86 2 10.5 2.6 10.5 4.1 Z" />
      </>
    ),
    spark: (
      <>
        <path d="M3.5 20.5 C4.33 21.33 5.67 21.33 6.5 20.5 L19.5 7.5 C20.33 6.67 20.33 5.33 19.5 4.5 C18.67 3.67 17.33 3.67 16.5 4.5 L3.5 17.5 C2.67 18.33 2.67 19.67 3.5 20.5 Z" />
        <path d="M18.01 8.99 L15.01 5.99" />
        <path d="M8.5 2.44 L10 2 L9.56 3.5 L10 5 L8.5 4.56 L7 5 L7.44 3.5 L7 2 L8.5 2.44 Z" />
        <path d="M4.5 8.44 L6 8 L5.56 9.5 L6 11 L4.5 10.56 L3 11 L3.44 9.5 L3 8 L4.5 8.44 Z" />
        <path d="M19.5 13.44 L21 13 L20.56 14.5 L21 16 L19.5 15.56 L18 16 L18.44 14.5 L18 13 L19.5 13.44 Z" />
      </>
    ),
    chat: (
      <>
        <path d="M16 2 H8 C4 2 2 4 2 8 V21 C2 21.55 2.45 22 3 22 H16 C20 22 22 20 22 16 V8 C22 4 20 2 16 2 Z" />
        <path d="M7 9.5 H17" />
        <path d="M7 14.5 H14" />
      </>
    ),
    video: (
      <>
        <path d="M12.53 20.42 H6.21 C3.05 20.42 2 18.32 2 16.21 V7.79 C2 4.63 3.05 3.58 6.21 3.58 H12.53 C15.69 3.58 16.74 4.63 16.74 7.79 V16.21 C16.74 19.37 15.68 20.42 12.53 20.42 Z" />
        <path d="M19.52 17.1 L16.74 15.15 V8.84 L19.52 6.89 C20.88 5.94 22 6.52 22 8.19 V15.81 C22 17.48 20.88 18.06 19.52 17.1 Z" />
        <path d="M11.5 11 C12.3284 11 13 10.3284 13 9.5 C13 8.67157 12.3284 8 11.5 8 C10.6716 8 10 8.67157 10 9.5 C10 10.3284 10.6716 11 11.5 11 Z" />
      </>
    ),
    media: (
      <>
        <path d="M9 22 H15 C20 22 22 20 22 15 V9 C22 4 20 2 15 2 H9 C4 2 2 4 2 9 V15 C2 20 4 22 9 22 Z" />
        <path d="M9 10 C10.1046 10 11 9.10457 11 8 C11 6.89543 10.1046 6 9 6 C7.89543 6 7 6.89543 7 8 C7 9.10457 7.89543 10 9 10 Z" />
        <path d="M2.67 18.95 L7.6 15.64 C8.39 15.11 9.53 15.17 10.24 15.78 L10.57 16.07 C11.35 16.74 12.61 16.74 13.39 16.07 L17.55 12.5 C18.33 11.83 19.59 11.83 20.37 12.5 L22 13.9" />
      </>
    ),
    team: (
      <>
        <path d="M9.16 10.87 C9.06 10.86 8.94 10.86 8.83 10.87 C6.45 10.79 4.56 8.84 4.56 6.44 C4.56 3.99 6.54 2 9 2 C11.45 2 13.44 3.99 13.44 6.44 C13.43 8.84 11.54 10.79 9.16 10.87 Z" />
        <path d="M16.41 4 C18.35 4 19.91 5.57 19.91 7.5 C19.91 9.39 18.41 10.93 16.54 11 C16.46 10.99 16.37 10.99 16.28 11" />
        <path d="M4.16 14.56 C1.74 16.18 1.74 18.82 4.16 20.43 C6.91 22.27 11.42 22.27 14.17 20.43 C16.59 18.81 16.59 16.17 14.17 14.56 C11.43 12.73 6.92 12.73 4.16 14.56 Z" />
        <path d="M18.34 20 C19.06 19.85 19.74 19.56 20.3 19.13 C21.86 17.96 21.86 16.03 20.3 14.86 C19.75 14.44 19.08 14.16 18.37 14" />
      </>
    ),
    gear: (
      <>
        <path d="M12 15 C13.6569 15 15 13.6569 15 12 C15 10.3431 13.6569 9 12 9 C10.3431 9 9 10.3431 9 12 C9 13.6569 10.3431 15 12 15 Z" />
        <path d="M2 12.88 V11.12 C2 10.08 2.85 9.22 3.9 9.22 C5.71 9.22 6.45 7.94 5.54 6.37 C5.02 5.47 5.33 4.3 6.24 3.78 L7.97 2.79 C8.76 2.32 9.78 2.6 10.25 3.39 L10.36 3.58 C11.26 5.15 12.74 5.15 13.65 3.58 L13.76 3.39 C14.23 2.6 15.25 2.32 16.04 2.79 L17.77 3.78 C18.68 4.3 18.99 5.47 18.47 6.37 C17.56 7.94 18.3 9.22 20.11 9.22 C21.15 9.22 22.01 10.07 22.01 11.12 V12.88 C22.01 13.92 21.16 14.78 20.11 14.78 C18.3 14.78 17.56 16.06 18.47 17.63 C18.99 18.54 18.68 19.7 17.77 20.22 L16.04 21.21 C15.25 21.68 14.23 21.4 13.76 20.61 L13.65 20.42 C12.75 18.85 11.27 18.85 10.36 20.42 L10.25 20.61 C9.78 21.4 8.76 21.68 7.97 21.21 L6.24 20.22 C5.33 19.7 5.02 18.53 5.54 17.63 C6.45 16.06 5.71 14.78 3.9 14.78 C2.85 14.78 2 13.92 2 12.88 Z" />
      </>
    ),
    brand: (
      <>
        <path d="M14 16 C14 17.77 13.23 19.37 12 20.46 C10.94 21.42 9.54 22 8 22 C4.69 22 2 19.31 2 16 C2 13.24 3.88 10.9 6.42 10.21 C7.11 11.95 8.59 13.29 10.42 13.79 C10.92 13.93 11.45 14 12 14 C12.55 14 13.08 13.93 13.58 13.79 C13.85 14.47 14 15.22 14 16 Z" />
        <path d="M18 8 C18 8.78 17.85 9.53 17.58 10.21 C16.89 11.95 15.41 13.29 13.58 13.79 C13.08 13.93 12.55 14 12 14 C11.45 14 10.92 13.93 10.42 13.79 C8.59 13.29 7.11 11.95 6.42 10.21 C6.15 9.53 6 8.78 6 8 C6 4.69 8.69 2 12 2 C15.31 2 18 4.69 18 8 Z" />
        <path d="M22 16 C22 19.31 19.31 22 16 22 C14.46 22 13.06 21.42 12 20.46 C13.23 19.37 14 17.77 14 16 C14 15.22 13.85 14.47 13.58 13.79 C15.41 13.29 16.89 11.95 17.58 10.21 C20.12 10.9 22 13.24 22 16 Z" />
      </>
    ),
    card: (
      <>
        <path d="M2 8.5 H22" />
        <path d="M6 16.5 H8" />
        <path d="M10.5 16.5 H14.5" />
        <path d="M6.44 3.5 H17.55 C21.11 3.5 22 4.38 22 7.89 V16.1 C22 19.61 21.11 20.49 17.56 20.49 H6.44 C2.89 20.5 2 19.62 2 16.11 V7.89 C2 4.38 2.89 3.5 6.44 3.5 Z" />
      </>
    ),
    bolt: (
      <>
        <path d="M2 8.5 H22" />
        <path d="M6 16.5 H8" />
        <path d="M10.5 16.5 H14.5" />
        <path d="M6.44 3.5 H17.55 C21.11 3.5 22 4.38 22 7.89 V16.1 C22 19.61 21.11 20.49 17.56 20.49 H6.44 C2.89 20.5 2 19.62 2 16.11 V7.89 C2 4.38 2.89 3.5 6.44 3.5 Z" />
      </>
    ),
    help: (
      <>
        <path d="M17 18.43 H13 L8.55 21.39 C7.89 21.83 7 21.36 7 20.56 V18.43 C4 18.43 2 16.43 2 13.43 V7.43 C2 4.43 4 2.43 7 2.43 H17 C20 2.43 22 4.43 22 7.43 V13.43 C22 16.43 20 18.43 17 18.43 Z" />
        <path d="M12 11.36 V11.15 C12 10.47 12.42 10.11 12.84 9.82 C13.25 9.54 13.66 9.18 13.66 8.52 C13.66 7.6 12.92 6.86 12 6.86 C11.08 6.86 10.34 7.6 10.34 8.52" />
        <path d="M11.995 13.75 H12.005" strokeWidth="2" />
      </>
    ),
    more: (
      <>
        <path d="M5 10 H5.01" strokeWidth="2.4" />
        <path d="M12 10 H12.01" strokeWidth="2.4" />
        <path d="M19 10 H19.01" strokeWidth="2.4" />
      </>
    ),
  };
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="evg-ico"
      data-ico={name}
      style={{ flexShrink: 0 }}
      aria-hidden="true"
    >
      {map[name]}
    </svg>
  );
}

export function useStudioPalette(): StudioPalette {
  return useMemo(
    () => ({
      bg: "#F6F6F4",
      surface: "#FFFFFF",
      surface2: "#FAFAF8",
      ink: "#18140F",
      ink2: "#2C271F",
      ink3: "#6B645A",
      muted: "#4A4339",
      rule: "#E5E3DE",
      ruleStrong: "#D8D5CE",
      accent: "#C7691E",
      accent2: "#D4782A",
    }),
    [],
  );
}

function StudioTopbar({
  breadcrumbLabel,
  tokensRemaining,
  tokensMonthly,
  tokensUnlimited,
  billingPlan,
  periodEnd,
  recentCharges,
  showCreateCta = true,
  hasActivePlan = true,
  accountInitials,
  breweryLabel,
}: {
  breadcrumbLabel: string;
  tokensRemaining?: number;
  tokensMonthly?: number;
  tokensUnlimited?: boolean;
  billingPlan?: string | null;
  periodEnd?: string | null;
  recentCharges?: StudioTokenCharge[];
  showCreateCta?: boolean;
  hasActivePlan?: boolean;
  accountInitials: string;
  breweryLabel: string;
}) {
  return (
    <header className="evg-top">
      <div className="evg-top__mobile-brand">
        <BrewAILogoMark />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: 14,
              color: "var(--t1)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {breadcrumbLabel}
          </div>
          <div
            className="evg-mono"
            style={{
              fontSize: 10,
              color: "var(--t3)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {breweryLabel}
          </div>
        </div>
      </div>

      <div className="evg-crumb evg-top__desktop-brand" style={{ minWidth: 0 }}>
        Studio / <b>{breadcrumbLabel}</b>
      </div>

      <StudioTopbarSearchDesktop />

      <div className="evg-top__spacer" style={{ flex: 1, minWidth: 0 }} />

      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "none" }}>
        <StudioTopbarSearchMobile />
        <StudioTokenBadge
          unlimited={tokensUnlimited}
          remaining={tokensRemaining}
          monthly={tokensMonthly}
          plan={billingPlan}
          periodEnd={periodEnd}
          recentCharges={recentCharges}
        />

        {showCreateCta ? (
          <Link
            href={hasActivePlan ? "/inhalte-erstellen" : PRICING_HREF}
            aria-label={hasActivePlan ? "Neu erstellen" : "Tarif wählen"}
            className="stu-btn stu-btn--primary stu-btn--sm evg-top__desktop-only"
            style={{ textDecoration: "none", minHeight: 36 }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              {hasActivePlan ? (
                <path d="M8 3 V13 M3 8 H13" strokeLinecap="round" />
              ) : (
                <>
                  <rect x="3" y="7" width="10" height="7" rx="0" />
                  <path d="M5.5 7 V5.5a2.5 2.5 0 0 1 5 0 V7" strokeLinecap="round" />
                </>
              )}
            </svg>
            <span>{hasActivePlan ? "Neu erstellen" : "Tarif wählen"}</span>
          </Link>
        ) : null}

        <Link
          href="/dashboard?tab=settings"
          className="evg-avatar evg-top__desktop-only"
          aria-label="Konto & Einstellungen"
          title="Konto"
        >
          {accountInitials}
        </Link>
      </div>
    </header>
  );
}

function createNavHref(key: StudioNavKey, href: string, hasActivePlan: boolean) {
  if (key === "create" && !hasActivePlan) return "/inhalte-erstellen";
  return href;
}

type NavItemDef = { key: StudioNavKey; label: string; icon: string; href: string; badge?: string };

const NAV_WORKSPACE: NavItemDef[] = [
  { key: "dashboard", label: "Dashboard", icon: "dash", href: "/dashboard" },
  { key: "assistant", label: "BrewAI", icon: "chat", href: "/dashboard?tab=assistant" },
  { key: "create", label: "Bilder erstellen", icon: "spark", href: "/inhalte-erstellen" },
  { key: "create-video", label: "Videos erstellen", icon: "video", href: "/videos-erstellen" },
  { key: "media", label: "Mediathek", icon: "media", href: "/dashboard?tab=media" },
];

const NAV_BRAND: NavItemDef[] = [
  { key: "brand", label: "Markenprofil", icon: "brand", href: "/dashboard?tab=brand" },
  { key: "team", label: "Team", icon: "team", href: "/dashboard?tab=team" },
];

const NAV_ACCOUNT: NavItemDef[] = [
  { key: "pricing", label: "Abonnement", icon: "card", href: "/dashboard?tab=pricing" },
  { key: "settings", label: "Einstellungen", icon: "gear", href: "/dashboard?tab=settings" },
];

function useWorkspaceNavItems(): NavItemDef[] {
  return useMemo(
    () => (isVideosCreateEnabled() ? NAV_WORKSPACE : NAV_WORKSPACE.filter((item) => item.key !== "create-video")),
    [],
  );
}

function WorkspaceNavItem({
  item,
  activeNav,
  brandProfileActive,
  hasActivePlan,
  onNavigate,
  collapsed = false,
}: {
  item: NavItemDef;
  activeNav: StudioNavKey;
  brandProfileActive: boolean;
  hasActivePlan: boolean;
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const locked = item.key === "create" && !hasActivePlan;
  const active = item.key === activeNav || (item.key === "brand" && brandProfileActive);
  const href = createNavHref(item.key, item.href, hasActivePlan);
  const tip = locked ? "Abo erforderlich" : item.label;

  const link = (
    <Link
      href={href}
      scroll={false}
      className="evg-nav__item"
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? tip : undefined}
      onClick={onNavigate}
      title={!collapsed && locked ? tip : undefined}
    >
      <span className="evg-rail__icon" data-ico={item.icon} aria-hidden="true">
        <SidebarIcon name={item.icon} />
      </span>
      <span className="evg-rail__reveal">{item.label}</span>
      {locked ? (
        <svg
          width="13"
          height="13"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
          className="evg-rail__reveal"
        >
          <rect x="3" y="7" width="10" height="7" rx="0" />
          <path d="M5.5 7 V5.5a2.5 2.5 0 0 1 5 0 V7" strokeLinecap="round" />
        </svg>
      ) : null}
      {item.badge ? <span className="evg-nav__badge evg-rail__reveal">{item.badge}</span> : null}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <StudioUiTooltip>
      <StudioUiTooltipTrigger asChild>{link}</StudioUiTooltipTrigger>
      <StudioUiTooltipContent side="right">{tip}</StudioUiTooltipContent>
    </StudioUiTooltip>
  );
}

function RestartOnboardingNavItem({ onNavigate }: { onNavigate?: () => void }) {
  const onboarding = useStudioOnboarding();
  if (!onboarding) return null;
  return (
    <button
      type="button"
      className="evg-opt"
      role="menuitem"
      onClick={() => {
        onboarding.restart();
        onNavigate?.();
      }}
    >
      <SidebarIcon name="spark" />
      <span>Tour neu starten</span>
    </button>
  );
}

function RecentMediaRail({
  items,
  collapsed,
}: {
  items: StudioRecentMediaItem[];
  collapsed: boolean;
}) {
  const router = useRouter();
  const range = formatChargeRange(items);

  if (collapsed) return null;

  return (
    <div className="evg-chargen evg-rail__reveal" data-tour="recent-media">
      <div className="evg-chargen__label">Chargen</div>
      {items.length === 0 ? (
        <div className="evg-chargen__empty">
          <div className="evg-chargen__empty-icon" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="1.5" y="2.5" width="13" height="11" rx="1.8" stroke="currentColor" strokeWidth="1.3" />
              <circle cx="5.5" cy="6.5" r="1.3" stroke="currentColor" strokeWidth="1.2" />
              <path
                d="M2.5 11.5l3.5-3.5 2 2 3-3.5 2.5 2.5"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <p className="evg-chargen__empty-copy">Deine Motive erscheinen hier</p>
        </div>
      ) : (
        <>
          <div className="evg-chargen__grid">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="evg-chargen__item"
                title={item.title}
                onClick={() => {
                  try {
                    sessionStorage.setItem(
                      "evg-reuse-media",
                      JSON.stringify({
                        id: item.id,
                        prompt: item.prompt,
                        aspectRatio: item.aspectRatio,
                        resolution: item.resolution,
                        title: item.title,
                      }),
                    );
                  } catch {
                    /* ignore quota */
                  }
                  router.push("/inhalte-erstellen");
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.imageUrl} alt="" />
              </button>
            ))}
          </div>
          {range ? <div className="evg-chargen__range">{range}</div> : <div className="evg-chargen__range" />}
        </>
      )}
    </div>
  );
}

function AccountSidebarFooter({
  accountName,
  userEmail,
  initials,
  isAdmin = false,
  adminRouteActive = false,
  collapsed = false,
  busy = false,
  onMenuOpenChange,
}: {
  accountName: string;
  userEmail?: string;
  initials: string;
  isAdmin?: boolean;
  adminRouteActive?: boolean;
  collapsed?: boolean;
  busy?: boolean;
  onMenuOpenChange?: (open: boolean) => void;
}) {
  const [signingOut, setSigningOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onMenuOpenChange?.(menuOpen);
  }, [menuOpen, onMenuOpenChange]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
    };
  }, [menuOpen]);

  const trigger = (
    <button
      type="button"
      className="evg-rail__foot"
      aria-expanded={menuOpen}
      aria-haspopup="menu"
      aria-label={collapsed ? `Konto: ${accountName}` : undefined}
      onClick={() => setMenuOpen((v) => !v)}
    >
      <div className="evg-avatar">
        {initials}
        <span className="evg-avatar__pulse" data-busy={busy ? "true" : undefined} aria-hidden="true" />
      </div>
      <div className="evg-rail__foot-copy evg-rail__reveal">
        <div className="evg-rail__foot-status">
          <span className="evg-rail__foot-status-dot" aria-hidden="true" />
          <span className="evg-rail__foot-name">{busy ? "Compiling…" : accountName}</span>
        </div>
        <div className="evg-rail__foot-email">{userEmail ?? ""}</div>
      </div>
      <svg
        width="11"
        height="11"
        viewBox="0 0 10 10"
        fill="none"
        aria-hidden="true"
        className="evg-rail__foot-chevron evg-rail__reveal"
      >
        <path
          d="M2 3.5l3 3 3-3"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      {collapsed ? (
        <StudioUiTooltip>
          <StudioUiTooltipTrigger asChild>{trigger}</StudioUiTooltipTrigger>
          <StudioUiTooltipContent side="right">{accountName}</StudioUiTooltipContent>
        </StudioUiTooltip>
      ) : (
        trigger
      )}

      {menuOpen ? (
        <div className="evg-pop evg-rail__foot-menu" role="menu">
          {isAdmin ? (
            <Link
              href="/admin"
              role="menuitem"
              className="evg-opt"
              aria-current={adminRouteActive ? "page" : undefined}
              onClick={() => setMenuOpen(false)}
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10 2 L16.5 5 V10.5 C16.5 14.3 13.5 16.8 10 18 C6.5 16.8 3.5 14.3 3.5 10.5 V5 Z" />
                <path d="M7.5 10 L9 11.5 L12.5 8" />
              </svg>
              <span>Admin</span>
            </Link>
          ) : null}
          <Link href="mailto:kontakt@brewai.de" role="menuitem" className="evg-opt" onClick={() => setMenuOpen(false)}>
            <SidebarIcon name="help" />
            <span>Hilfe & Support</span>
          </Link>
          <RestartOnboardingNavItem onNavigate={() => setMenuOpen(false)} />
          <button
            type="button"
            role="menuitem"
            className="evg-opt"
            disabled={signingOut}
            aria-label="Abmelden"
            onClick={() => {
              setSigningOut(true);
              void signOutAndRedirect();
            }}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M7 17 H4a1 1 0 0 1-1-1 V4a1 1 0 0 1 1-1h3" />
              <path d="M13 14 L17 10 L13 6" />
              <path d="M17 10 H7" />
            </svg>
            <span>{signingOut ? "Abmelden …" : "Abmelden"}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

function StudioMobileBottomNav({
  activeNav,
  moreOpen,
  onOpenMore,
  hasActivePlan = true,
}: {
  activeNav: StudioNavKey;
  moreOpen: boolean;
  onOpenMore: () => void;
  hasActivePlan?: boolean;
}) {
  const primary: Array<{ key: StudioNavKey; label: string; icon: string; href: string }> = [
    { key: "dashboard", label: "Dashboard", icon: "dash", href: "/dashboard" },
    { key: "assistant", label: "BrewAI", icon: "chat", href: "/dashboard?tab=assistant" },
    { key: "create", label: "Erstellen", icon: "spark", href: "/inhalte-erstellen" },
    { key: "media", label: "Mediathek", icon: "media", href: "/dashboard?tab=media" },
  ];
  const moreActive =
    moreOpen ||
    activeNav === "brand" ||
    activeNav === "team" ||
    activeNav === "settings" ||
    activeNav === "pricing" ||
    activeNav === "create-video";

  return (
    <nav className="evg-bottom-nav" aria-label="Hauptnavigation">
      {primary.map((tab) => {
        const active = tab.key === activeNav;
        const href = tab.key === "create" ? createNavHref("create", tab.href, hasActivePlan) : tab.href;
        return (
          <Link
            key={tab.key}
            href={href}
            scroll={false}
            className="evg-bottom-nav__item"
            data-nav-key={tab.key}
            aria-current={active ? "page" : undefined}
          >
            <SidebarIcon name={tab.icon} />
            <span>{tab.label}</span>
          </Link>
        );
      })}
      <button
        type="button"
        className="evg-bottom-nav__item"
        data-nav-key="more"
        data-active={moreActive ? "true" : undefined}
        aria-expanded={moreOpen}
        aria-haspopup="dialog"
        aria-label="Mehr Navigation"
        onClick={onOpenMore}
      >
        <SidebarIcon name="more" />
        <span>Mehr</span>
      </button>
    </nav>
  );
}

function StudioMobileMoreSheet({
  open,
  onOpenChange,
  activeNav,
  brandProfileActive,
  isAdmin,
  adminRouteActive,
  hasActivePlan = true,
  accountName,
  userEmail,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeNav: StudioNavKey;
  brandProfileActive: boolean;
  isAdmin: boolean;
  adminRouteActive: boolean;
  hasActivePlan?: boolean;
  accountName: string;
  userEmail?: string;
}) {
  const [signingOut, setSigningOut] = useState(false);
  const videosEnabled = isVideosCreateEnabled();
  const onboarding = useStudioOnboarding();

  const close = () => onOpenChange(false);

  const sheetItems: NavItemDef[] = [
    ...NAV_BRAND,
    ...(videosEnabled
      ? [{ key: "create-video" as const, label: "Videos", icon: "video", href: "/videos-erstellen" }]
      : []),
    ...NAV_ACCOUNT,
  ];

  return (
    <StudioUiDialog open={open} onOpenChange={onOpenChange}>
      <StudioUiDialogContent sheetOnMobile showClose>
        <StudioUiDialogHeader>
          <StudioUiDialogTitle>Mehr</StudioUiDialogTitle>
          <StudioUiDialogDescription>
            <span style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {accountName}
              {userEmail ? ` · ${userEmail}` : ""}
            </span>
          </StudioUiDialogDescription>
        </StudioUiDialogHeader>

        <div className="evg-more-sheet-list" role="navigation" aria-label="Weitere Bereiche">
          <div className="stu-label">Navigation</div>
          {sheetItems.map((item) => {
            const active = item.key === activeNav || (item.key === "brand" && brandProfileActive);
            return (
              <Link
                key={item.key}
                href={createNavHref(item.key, item.href, hasActivePlan)}
                scroll={false}
                aria-current={active ? "page" : undefined}
                onClick={close}
              >
                <SidebarIcon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {isAdmin ? (
            <Link href="/admin" aria-current={adminRouteActive ? "page" : undefined} onClick={close}>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10 2 L16.5 5 V10.5 C16.5 14.3 13.5 16.8 10 18 C6.5 16.8 3.5 14.3 3.5 10.5 V5 Z" />
                <path d="M7.5 10 L9 11.5 L12.5 8" />
              </svg>
              <span>Admin</span>
            </Link>
          ) : null}

          <Link href="mailto:kontakt@brewai.de" onClick={close}>
            <SidebarIcon name="help" />
            <span>Hilfe & Support</span>
          </Link>

          {onboarding ? (
            <button
              type="button"
              onClick={() => {
                onboarding.restart();
                close();
              }}
            >
              <SidebarIcon name="spark" />
              <span>Tour neu starten</span>
            </button>
          ) : null}

          <button
            type="button"
            aria-label="Abmelden"
            disabled={signingOut}
            onClick={() => {
              setSigningOut(true);
              void signOutAndRedirect();
            }}
            style={{ color: "var(--err)" }}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M7 17 H4a1 1 0 0 1-1-1 V4a1 1 0 0 1 1-1h3" />
              <path d="M13 14 L17 10 L13 6" />
              <path d="M17 10 H7" />
            </svg>
            <span>{signingOut ? "Abmelden …" : "Abmelden"}</span>
          </button>
        </div>
      </StudioUiDialogContent>
    </StudioUiDialog>
  );
}

function NavGroup({
  label,
  items,
  activeNav,
  brandProfileActive,
  hasActivePlan,
  collapsed,
}: {
  label: string;
  items: NavItemDef[];
  activeNav: StudioNavKey;
  brandProfileActive: boolean;
  hasActivePlan: boolean;
  collapsed: boolean;
}) {
  return (
    <div className="evg-nav-group">
      <div className="evg-nav-group__label evg-rail__reveal">{label}</div>
      {items.map((it) => (
        <WorkspaceNavItem
          key={it.key}
          item={it}
          activeNav={activeNav}
          brandProfileActive={brandProfileActive}
          hasActivePlan={hasActivePlan}
          collapsed={collapsed}
        />
      ))}
    </div>
  );
}

export function DashboardStudioShell({
  userEmail,
  initialProfileName,
  initialBreweryName,
  activeNav,
  breadcrumbLabel,
  children,
  contentPadding,
  onOpenBrandProfile,
  brandProfileActive = false,
  isAdmin = false,
  adminRouteActive = false,
  hasActivePlan = true,
  tokensRemaining,
  tokensMonthly,
  tokensUnlimited = false,
  billingPlan = null,
  periodEnd = null,
  recentMedia = [],
  recentCharges = [],
  contentKey,
  contentPending = false,
}: {
  userEmail?: string;
  initialProfileName?: string;
  initialBreweryName?: string;
  activeNav: StudioNavKey;
  breadcrumbLabel: string;
  children: React.ReactNode;
  contentPadding?: string;
  onOpenBrandProfile?: () => void;
  brandProfileActive?: boolean;
  isAdmin?: boolean;
  adminRouteActive?: boolean;
  hasActivePlan?: boolean;
  tokensRemaining?: number;
  tokensMonthly?: number;
  tokensUnlimited?: boolean;
  billingPlan?: string | null;
  periodEnd?: string | null;
  recentMedia?: StudioRecentMediaItem[];
  recentCharges?: StudioTokenCharge[];
  /** Schlüssel für View-Transition (Tab oder Route). */
  contentKey?: string;
  contentPending?: boolean;
}) {
  void onOpenBrandProfile;
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement>(null);
  const railCloseTimer = useRef<number | null>(null);
  const railOpenTimer = useRef<number | null>(null);
  const reduceMotion = useReducedMotion();
  const [moreOpen, setMoreOpen] = useState(false);
  const [railHovered, setRailHovered] = useState(false);
  const [footMenuOpen, setFootMenuOpen] = useState(false);
  const workspaceNav = useWorkspaceNavItems();
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const railOpen = !isMobile && (railHovered || footMenuOpen);

  const clearRailTimers = useCallback(() => {
    if (railCloseTimer.current != null) {
      window.clearTimeout(railCloseTimer.current);
      railCloseTimer.current = null;
    }
    if (railOpenTimer.current != null) {
      window.clearTimeout(railOpenTimer.current);
      railOpenTimer.current = null;
    }
  }, []);

  const openRail = useCallback(() => {
    if (railCloseTimer.current != null) {
      window.clearTimeout(railCloseTimer.current);
      railCloseTimer.current = null;
    }
    if (railHovered) return;
    if (railOpenTimer.current != null) return;
    railOpenTimer.current = window.setTimeout(() => {
      setRailHovered(true);
      railOpenTimer.current = null;
    }, reduceMotion ? 0 : RAIL_OPEN_MS);
  }, [railHovered, reduceMotion]);

  const scheduleCloseRail = useCallback(() => {
    if (railOpenTimer.current != null) {
      window.clearTimeout(railOpenTimer.current);
      railOpenTimer.current = null;
    }
    if (railCloseTimer.current != null) {
      window.clearTimeout(railCloseTimer.current);
    }
    railCloseTimer.current = window.setTimeout(() => {
      setRailHovered(false);
      railCloseTimer.current = null;
    }, reduceMotion ? 0 : RAIL_CLOSE_MS);
  }, [reduceMotion]);

  useEffect(() => {
    return () => clearRailTimers();
  }, [clearRailTimers]);

  useEffect(() => {
    if (!contentKey || !mainRef.current) return;
    mainRef.current.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }, [activeNav, contentKey, reduceMotion]);

  /* Sheet nach Navigation schließen */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional close on route/tab change
    setMoreOpen(false);
  }, [pathname, contentKey]);

  const [liveBreweryName, setLiveBreweryName] = useState(initialBreweryName?.trim() || "");
  const [liveProfileName, setLiveProfileName] = useState(initialProfileName?.trim() || "");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirror server/layout props
    setLiveBreweryName(initialBreweryName?.trim() || "");
  }, [initialBreweryName]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirror server/layout props
    setLiveProfileName(initialProfileName?.trim() || "");
  }, [initialProfileName]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as
        | { breweryName?: string; profileName?: string }
        | undefined;
      if (!detail) return;
      if (typeof detail.breweryName === "string") setLiveBreweryName(detail.breweryName.trim());
      if (typeof detail.profileName === "string") setLiveProfileName(detail.profileName.trim());
    };
    window.addEventListener("evglab-profile-updated", handler);
    return () => window.removeEventListener("evglab-profile-updated", handler);
  }, []);

  const accountName = liveBreweryName || liveProfileName || "BrewAI";
  const initials = initialsFromName(accountName);
  const pad = contentPadding ?? "var(--sp-8)";

  const labeledSidebar = !isMobile;
  const iconOnly = labeledSidebar ? false : !railOpen;

  return (
    <StudioSearchProvider>
      <StudioUiTooltipProvider delayDuration={280}>
        <div
          className={cn(
            studioFontClassName,
            "evg-studio",
            "evg-app",
            labeledSidebar ? "evg-app--sidebar-labeled" : "evg-app--rail-flyout",
            isMobile && "evg-app--mobile",
          )}
        >
          <aside
            className="evg-rail"
            aria-label="Seitennavigation"
            data-open={labeledSidebar || railOpen ? "true" : "false"}
            onMouseEnter={labeledSidebar ? undefined : openRail}
            onMouseLeave={labeledSidebar ? undefined : scheduleCloseRail}
            onFocusCapture={labeledSidebar ? undefined : openRail}
            onBlurCapture={
              labeledSidebar
                ? undefined
                : (e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                      scheduleCloseRail();
                    }
                  }
            }
          >
            <div className="evg-rail__scroll">
              <div className="evg-rail__brand">
                <BrewAILogoMark />
                <div className="evg-rail__brand-copy evg-rail__reveal">
                  <div className="evg-rail__name">BrewAI</div>
                  <div className="evg-rail__sub">STUDIO</div>
                </div>
              </div>

              <nav className="evg-nav" data-tour="nav" aria-label="Arbeitsbereich">
                <NavGroup
                  label="Arbeitsbereich"
                  items={workspaceNav}
                  activeNav={activeNav}
                  brandProfileActive={brandProfileActive}
                  hasActivePlan={hasActivePlan}
                  collapsed={iconOnly}
                />
                <NavGroup
                  label="Marke"
                  items={NAV_BRAND}
                  activeNav={activeNav}
                  brandProfileActive={brandProfileActive}
                  hasActivePlan={hasActivePlan}
                  collapsed={iconOnly}
                />
                <NavGroup
                  label="Konto"
                  items={NAV_ACCOUNT}
                  activeNav={activeNav}
                  brandProfileActive={brandProfileActive}
                  hasActivePlan={hasActivePlan}
                  collapsed={iconOnly}
                />
              </nav>

              <RecentMediaRail items={recentMedia} collapsed={iconOnly} />
            </div>

            <div className="evg-rail__bottom">
              <AccountSidebarFooter
                accountName={accountName}
                userEmail={userEmail}
                initials={initials}
                isAdmin={isAdmin}
                adminRouteActive={adminRouteActive}
                collapsed={iconOnly}
                busy={contentPending}
                onMenuOpenChange={setFootMenuOpen}
              />
            </div>
          </aside>

          <div className="evg-main-wrap">
            <StudioTopbar
              breadcrumbLabel={breadcrumbLabel}
              tokensRemaining={tokensRemaining}
              tokensMonthly={tokensMonthly}
              tokensUnlimited={tokensUnlimited}
              billingPlan={billingPlan}
              periodEnd={periodEnd}
              recentCharges={recentCharges}
              showCreateCta={
                activeNav !== "create" &&
                activeNav !== "create-video" &&
                activeNav !== "dashboard" &&
                activeNav !== "assistant"
              }
              hasActivePlan={hasActivePlan}
              accountInitials={initials}
              breweryLabel={accountName}
            />
            <main
              ref={mainRef}
              className={cn("evg-main", contentPending && "studio-main-pending")}
            >
              <div className="evg-main__inner" style={{ padding: pad }}>
                {contentKey ? (
                  <StudioViewTransition viewKey={contentKey} variant="route">
                    {children}
                  </StudioViewTransition>
                ) : (
                  children
                )}
              </div>
            </main>
          </div>

          <StudioMobileMoreSheet
            open={moreOpen}
            onOpenChange={setMoreOpen}
            activeNav={activeNav}
            brandProfileActive={brandProfileActive}
            isAdmin={isAdmin}
            adminRouteActive={adminRouteActive}
            hasActivePlan={hasActivePlan}
            accountName={accountName}
            userEmail={userEmail}
          />
          <StudioMobileBottomNav
            activeNav={activeNav}
            moreOpen={moreOpen}
            onOpenMore={() => setMoreOpen(true)}
            hasActivePlan={hasActivePlan}
          />
          <StudioUiToaster />
        </div>
      </StudioUiTooltipProvider>
    </StudioSearchProvider>
  );
}
