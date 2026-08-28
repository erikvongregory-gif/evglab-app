"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";
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
import {
  StudioUiDialog,
  StudioUiDialogContent,
  StudioUiDialogDescription,
  StudioUiDialogHeader,
  StudioUiDialogTitle,
  StudioUiIconButton,
  StudioUiToaster,
  StudioUiTooltip,
  StudioUiTooltipContent,
  StudioUiTooltipProvider,
  StudioUiTooltipTrigger,
} from "@/components/studio/ui";
import { cn } from "@/lib/utils";

const RAIL_COLLAPSE_KEY = "evg-studio-rail-collapsed";
const PRICING_HREF = "/dashboard?tab=pricing";
const DESKTOP_MIN = 1240;
const MOBILE_MAX = 639;

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
export const STUDIO_PAD_X = 40;

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
  accentSerif: "var(--f-sans)",
  /** @deprecated Display-Alias — Serif im Studio entfernt */
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
        <rect x="3" y="3" width="6" height="6" rx="0" />
        <rect x="11" y="3" width="6" height="4" rx="0" />
        <rect x="11" y="9" width="6" height="8" rx="0" />
        <rect x="3" y="11" width="6" height="6" rx="0" />
      </>
    ),
    spark: <path d="M10 3 L11.5 8 L16.5 9.5 L11.5 11 L10 16 L8.5 11 L3.5 9.5 L8.5 8 Z" />,
    video: (
      <>
        <rect x="3" y="5" width="14" height="10" rx="0" />
        <path d="M8 10 L13 12.5 V7.5 Z" fill={color} stroke="none" />
      </>
    ),
    media: (
      <>
        <rect x="3" y="3" width="14" height="14" rx="0" />
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
    brand: (
      <>
        <rect x="4" y="4" width="12" height="12" rx="0" />
        <path d="M8 13 V9.5" />
        <circle cx="8" cy="7.5" r="1" fill={color} stroke="none" />
        <path d="M12 13 V8" />
        <circle cx="12" cy="6.5" r="1" fill={color} stroke="none" />
      </>
    ),
    bolt: <path d="M9 2 L4 9 H8 L7 14 L12 7 H8 Z" strokeLinejoin="round" />,
    help: (
      <>
        <circle cx="10" cy="10" r="7.5" />
        <path d="M7.8 8 C7.8 6.6 8.8 5.8 10 5.8 C11.2 5.8 12.2 6.6 12.2 7.8 C12.2 9 10 9.5 10 11" />
        <circle cx="10" cy="13.5" r="0.6" fill={color} stroke="none" />
      </>
    ),
    more: (
      <>
        <circle cx="4" cy="10" r="1.2" fill={color} stroke="none" />
        <circle cx="10" cy="10" r="1.2" fill={color} stroke="none" />
        <circle cx="16" cy="10" r="1.2" fill={color} stroke="none" />
      </>
    ),
  };
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 20 20"
      fill="none"
      stroke={color}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
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
      bg: "#0F0906",
      surface: "#16100B",
      surface2: "#1E1710",
      ink: "#F3EDE4",
      ink2: "#DED5CA",
      ink3: "#7E7263",
      muted: "#7E7263",
      rule: "#2E2418",
      ruleStrong: "#3D3021",
      accent: "#C9A24D",
      accent2: "#DDBA6A",
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
  isMobile,
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
  isMobile: boolean;
}) {
  return (
    <header className="evg-top">
      {isMobile ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
          <span className="evg-rail__mark" aria-hidden="true">
            B
          </span>
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
      ) : (
        <div className="evg-crumb" style={{ minWidth: 0 }}>
          Studio / <b>{breadcrumbLabel}</b>
        </div>
      )}

      {!isMobile ? <StudioTopbarSearchDesktop /> : null}

      <div style={{ flex: isMobile ? 0 : 1, minWidth: 0 }} />

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

        {showCreateCta && !isMobile ? (
          <Link
            href={hasActivePlan ? "/inhalte-erstellen" : PRICING_HREF}
            aria-label={hasActivePlan ? "Neu erstellen" : "Tarif wählen"}
            className="stu-btn stu-btn--primary stu-btn--sm"
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

        {!isMobile ? (
          <Link href="/dashboard?tab=settings" className="evg-avatar" aria-label="Konto & Einstellungen" title="Konto">
            {accountInitials}
          </Link>
        ) : null}
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
  { key: "create", label: "Bilder erstellen", icon: "spark", href: "/inhalte-erstellen" },
  { key: "create-video", label: "Videos erstellen", icon: "video", href: "/videos-erstellen" },
  { key: "media", label: "Mediathek", icon: "media", href: "/dashboard?tab=media" },
];

const NAV_BRAND: NavItemDef[] = [
  { key: "brand", label: "Markenprofil", icon: "brand", href: "/dashboard?tab=brand" },
  { key: "team", label: "Team", icon: "team", href: "/dashboard?tab=team" },
];

const NAV_ACCOUNT: NavItemDef[] = [
  { key: "pricing", label: "Abonnement", icon: "bolt", href: "/dashboard?tab=pricing" },
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
      <SidebarIcon name={item.icon} />
      {!collapsed ? <span className="evg-hide-collapsed" style={{ flex: 1, minWidth: 0 }}>{item.label}</span> : null}
      {!collapsed && locked ? (
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="evg-hide-collapsed">
          <rect x="3" y="7" width="10" height="7" rx="0" />
          <path d="M5.5 7 V5.5a2.5 2.5 0 0 1 5 0 V7" strokeLinecap="round" />
        </svg>
      ) : null}
      {!collapsed && item.badge ? <span className="evg-nav__badge">{item.badge}</span> : null}
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
    <div className="evg-chargen evg-hide-collapsed" data-tour="recent-media">
      <div className="evg-rubrik">Chargen</div>
      {items.length === 0 ? (
        <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--fg-5)" }}>Deine Motive erscheinen hier</p>
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
}: {
  accountName: string;
  userEmail?: string;
  initials: string;
  isAdmin?: boolean;
  adminRouteActive?: boolean;
  collapsed?: boolean;
}) {
  const [signingOut, setSigningOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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
      style={collapsed ? { justifyContent: "center", paddingInline: 10 } : undefined}
    >
      <div className="evg-avatar">{initials}</div>
      {!collapsed ? (
        <>
          <div style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
            <div
              style={{
                fontWeight: 500,
                fontSize: 13,
                color: "var(--t1)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {accountName}
            </div>
            <div
              className="evg-mono"
              style={{
                fontSize: 9.5,
                color: "var(--t3)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {userEmail ?? ""}
            </div>
          </div>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--t3)" strokeWidth="1.6" aria-hidden="true">
            <path d="M4 6 L8 10 L12 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </>
      ) : null}
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
        <div
          className="evg-pop"
          role="menu"
          style={{ position: "absolute", left: 8, right: 8, bottom: "100%", marginBottom: 6, zIndex: 40 }}
        >
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
      <StudioUiDialogContent sheetOnMobile showClose aria-describedby={undefined}>
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
          <div className="stu-label">Marke & Konto</div>
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
      <div className="evg-nav-group__label">{label}</div>
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
  const reduceMotion = useReducedMotion();
  const [moreOpen, setMoreOpen] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(RAIL_COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const workspaceNav = useWorkspaceNavItems();
  const isNarrow = useMediaQuery(`(max-width: ${DESKTOP_MIN - 1}px)`);
  const isMobile = useMediaQuery(`(max-width: ${MOBILE_MAX}px)`);
  /** Tablet/Mid erzwingen Icon-Rail; Desktop-Preference bleibt in localStorage. */
  const effectiveCollapsed = isNarrow || railCollapsed;

  const toggleRail = () => {
    if (isNarrow) return;
    setRailCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(RAIL_COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  useEffect(() => {
    if (!contentKey || !mainRef.current) return;
    mainRef.current.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }, [contentKey, reduceMotion]);

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

  return (
    <StudioSearchProvider>
      <StudioUiTooltipProvider delayDuration={280}>
        <div
          className={cn(
            studioFontClassName,
            "evg-studio",
            "evg-app",
            effectiveCollapsed && "evg-app--collapsed",
            isMobile && "evg-app--mobile",
          )}
        >
          <aside className="evg-rail" aria-label="Seitennavigation">
            <div
              className="evg-rail__brand"
              style={effectiveCollapsed ? { justifyContent: "center", paddingInline: 8, gap: 6 } : undefined}
            >
              <span className="evg-rail__mark" aria-hidden="true">
                B
              </span>
              {!effectiveCollapsed ? (
                <div style={{ minWidth: 0, flex: 1 }} className="evg-hide-collapsed">
                  <div className="evg-rail__name">BrewAI</div>
                  <div
                    className="evg-rail__sub"
                    style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                    title={liveBreweryName || undefined}
                  >
                    {liveBreweryName || "STUDIO"}
                  </div>
                </div>
              ) : null}
              {!isNarrow ? (
                <StudioUiIconButton
                  size="sm"
                  aria-label={railCollapsed ? "Navigation ausklappen" : "Navigation einklappen"}
                  aria-pressed={railCollapsed}
                  onClick={toggleRail}
                  style={{ marginLeft: effectiveCollapsed ? 0 : "auto" }}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                    {railCollapsed ? (
                      <path d="M6 4 L10 8 L6 12" strokeLinecap="round" strokeLinejoin="round" />
                    ) : (
                      <path d="M10 4 L6 8 L10 12" strokeLinecap="round" strokeLinejoin="round" />
                    )}
                  </svg>
                </StudioUiIconButton>
              ) : null}
            </div>

            <nav className="evg-nav" data-tour="nav" aria-label="Arbeitsbereich">
              <NavGroup
                label="Arbeitsbereich"
                items={workspaceNav}
                activeNav={activeNav}
                brandProfileActive={brandProfileActive}
                hasActivePlan={hasActivePlan}
                collapsed={effectiveCollapsed}
              />
              <NavGroup
                label="Marke"
                items={NAV_BRAND}
                activeNav={activeNav}
                brandProfileActive={brandProfileActive}
                hasActivePlan={hasActivePlan}
                collapsed={effectiveCollapsed}
              />
              <NavGroup
                label="Konto"
                items={NAV_ACCOUNT}
                activeNav={activeNav}
                brandProfileActive={brandProfileActive}
                hasActivePlan={hasActivePlan}
                collapsed={effectiveCollapsed}
              />
            </nav>

            <RecentMediaRail items={recentMedia} collapsed={effectiveCollapsed} />

            <AccountSidebarFooter
              accountName={accountName}
              userEmail={userEmail}
              initials={initials}
              isAdmin={isAdmin}
              adminRouteActive={adminRouteActive}
              collapsed={effectiveCollapsed}
            />
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
              showCreateCta={activeNav !== "create" && activeNav !== "create-video"}
              hasActivePlan={hasActivePlan}
              accountInitials={initials}
              breweryLabel={accountName}
              isMobile={isMobile}
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
