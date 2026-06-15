"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { StudioViewTransition } from "@/components/studio/studio-view-transition";
import { EvglabMark } from "@/components/studio/evglab-mark";
import { StudioButton, StudioIconButton } from "@/components/studio/ui";
import { studioFontClassName } from "@/lib/fonts/studio-fonts";
import { MARKETING_SITE_URL } from "@/lib/siteConfig";
import { signOutAndRedirect } from "@/lib/auth/signOutClient";
import { cn } from "@/lib/utils";

/** Content gutter — matches EvGlab Studio redesign (--gutter) */
export const STUDIO_PAD_X = 40;

/** Studio design tokens (CSS vars on .evg-studio) */
export const STUDIO_TOKENS = {
  paper: "var(--bg-0)",
  paper2: "var(--bg-1)",
  ink: "var(--tx-0)",
  ink2: "var(--tx-1)",
  ink3: "var(--tx-2)",
  amber: "var(--acc)",
  amber2: "var(--acc-hi)",
  ember: "var(--acc-lo)",
  glow: "var(--acc-soft)",
  sans: "var(--studio-sans)",
  accentSerif: "var(--studio-accent-serif)",
  /** @deprecated Nur für orange/Gradient-Akzente — sonst `sans` verwenden */
  serif: "var(--studio-accent-serif)",
  mono: "var(--studio-mono)",
  gradientBrand: "linear-gradient(150deg, var(--acc-hi), var(--acc-lo))",
  gradientGlow: "radial-gradient(circle at 18% 0%, var(--acc-softer) 0%, transparent 52%)",
  gradientCard: "linear-gradient(180deg, var(--bg-3) 0%, var(--bg-2) 100%)",
};

/** Text on amber CTAs */
export const STUDIO_ON_ACCENT = "var(--acc-ink)";

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

export type StudioNavKey = "dashboard" | "create" | "media" | "team" | "brand" | "settings" | "pricing";

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "?";
  const b = parts.length > 1 ? parts[1]?.[0] : parts[0]?.[1];
  return (a + (b ?? "")).toUpperCase();
}

function WaveMark({ size = 28, color = STUDIO_TOKENS.ink }: { size?: number; color?: string }) {
  const h = (size * 20) / 28;
  return (
    <svg width={size} height={h} viewBox="0 0 28 20" fill="none" aria-hidden="true">
      <path d="M2 5 C6 1, 10 9, 14 5 S22 1, 26 5" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M2 11 C6 7, 10 15, 14 11 S22 7, 26 11" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M2 17 C6 13, 10 21, 14 17 S22 13, 26 17" stroke={color} strokeWidth="2" strokeLinecap="round" />
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
    brand: (
      <>
        <rect x="4" y="4" width="12" height="12" rx="2.5" />
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
  };
  return (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true">
      {map[name]}
    </svg>
  );
}

export function useStudioPalette(): StudioPalette {
  return useMemo(
    () => ({
      bg: "#131211",
      surface: "#1a1816",
      surface2: "#201d1b",
      ink: "#f4f1ec",
      ink2: "#c4bdb3",
      ink3: "#8a837a",
      muted: "#635c54",
      rule: "rgba(255, 255, 255, 0.07)",
      ruleStrong: "rgba(255, 255, 255, 0.12)",
      accent: "#e8772e",
      accent2: "#f08a45",
    }),
    [],
  );
}

function StudioBrandMark({ size = 30 }: { size?: number }) {
  return <EvglabMark size={size} />;
}

function StudioBreadcrumbLabel({ label }: { label: string }) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) {
    return <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>;
  }
  return (
    <span
      className="studio-view-transition studio-view-transition--inline"
      style={{ position: "relative", minHeight: 18, alignItems: "center" }}
    >
      <AnimatePresence initial={false}>
        <motion.span
          key={label}
          className="studio-view-transition__panel"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -3 }}
          transition={{ duration: 0.14, ease: [0.22, 0.68, 0.2, 1] }}
          style={{ fontSize: 13, fontWeight: 600 }}
        >
          {label}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function StudioTopbar({
  breadcrumbLabel,
  tokensRemaining,
  tokensMonthly,
  onOpenMobileMenu,
  showCreateCta = true,
  hasActivePlan = true,
}: {
  breadcrumbLabel: string;
  tokensRemaining?: number;
  tokensMonthly?: number;
  onOpenMobileMenu?: () => void;
  showCreateCta?: boolean;
  hasActivePlan?: boolean;
}) {
  const free =
    typeof tokensRemaining === "number" && typeof tokensMonthly === "number"
      ? Math.max(0, tokensRemaining)
      : null;

  return (
    <header
      className="evg-shell-topbar"
      style={{
        height: "var(--topbar-h)",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        padding: "0 var(--gutter)",
        borderBottom: "1px solid var(--line)",
        background: "color-mix(in srgb, var(--bg-0) 80%, transparent)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        position: "sticky",
        top: 0,
        zIndex: 20,
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <StudioIconButton
        type="button"
        className="evg-shell-menu-btn"
        aria-label="Menü öffnen"
        onClick={onOpenMobileMenu}
      >
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <path d="M3 6 H17 M3 10 H17 M3 14 H17" />
        </svg>
      </StudioIconButton>
      <div className="evg-shell-topbar-breadcrumb" style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
        <span className="studio-faint evg-shell-topbar-studio-label" style={{ fontSize: 13 }}>
          Studio
        </span>
        <svg className="evg-shell-topbar-chevron" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="var(--tx-3)" strokeWidth="1.6" aria-hidden="true">
          <path d="M6 4 L10 8 L6 12" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <StudioBreadcrumbLabel label={breadcrumbLabel} />
      </div>

      <div data-tour="search" className="evg-shell-topbar-search">
        <span style={{ position: "absolute", left: 13, top: 10, color: "var(--tx-3)", pointerEvents: "none" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5 L13 13" strokeLinecap="round" />
          </svg>
        </span>
        <input
          className="studio-field"
          style={{ height: 38, paddingLeft: 38, fontSize: 13 }}
          placeholder="Suche · Posts, Bilder, Kampagnen …"
          aria-label="Suche"
        />
        <span
          className="studio-mono"
          style={{
            position: "absolute",
            right: 10,
            top: 9,
            fontSize: 10.5,
            color: "var(--tx-3)",
            border: "1px solid var(--line)",
            borderRadius: 5,
            padding: "2px 6px",
            pointerEvents: "none",
          }}
        >
          ⌘K
        </span>
      </div>

      <div className="evg-shell-topbar-spacer" style={{ flex: 1, minWidth: 0 }} />

      <div className="evg-shell-topbar-actions">
        {free !== null ? (
          <div
            data-tour="tokens"
            className="studio-tnum evg-shell-topbar-tokens"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              height: 36,
              padding: "0 12px",
              borderRadius: "var(--r-sm)",
              border: "1px solid var(--line)",
              background: "var(--bg-1)",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--acc-hi)" strokeWidth="1.6" aria-hidden="true">
              <path d="M9 2 L4 9 H8 L7 14 L12 7 H8 Z" strokeLinejoin="round" />
            </svg>
            {free.toLocaleString("de-DE")}
            <span className="studio-faint evg-shell-topbar-tokens-label" style={{ fontSize: 11.5, fontWeight: 500 }}>
              Tokens
            </span>
          </div>
        ) : null}

        <StudioIconButton aria-label="Benachrichtigungen" className="evg-shell-topbar-notify" style={{ position: "relative" }}>
          <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 7 C4 4.8 5.8 3 8 3 C10.2 3 12 4.8 12 7 V10 L13 12 H3 L4 10 Z" />
            <path d="M6.5 12 C6.7 13 7.3 13.5 8 13.5 C8.7 13.5 9.3 13 9.5 12" />
          </svg>
          <span
            style={{
              position: "absolute",
              top: 8,
              right: 9,
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--acc)",
              border: "1.5px solid var(--bg-0)",
            }}
          />
        </StudioIconButton>

        {showCreateCta ? (
          <>
            <div className="evg-shell-topbar-divider" style={{ width: 1, height: 24, background: "var(--line)" }} />
            <StudioButton
              href={hasActivePlan ? "/inhalte-erstellen" : PRICING_HREF}
              variant="primary"
              size="sm"
              data-tour="create"
              className="evg-shell-topbar-create"
              aria-label={hasActivePlan ? "Neu erstellen" : "Tarif wählen"}
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                {hasActivePlan ? (
                  <path d="M8 3 V13 M3 8 H13" strokeLinecap="round" />
                ) : (
                  <>
                    <rect x="3" y="7" width="10" height="7" rx="1.5" />
                    <path d="M5.5 7 V5.5a2.5 2.5 0 0 1 5 0 V7" strokeLinecap="round" />
                  </>
                )}
              </svg>
              <span className="evg-shell-topbar-create-label">{hasActivePlan ? "Neu erstellen" : "Tarif wählen"}</span>
            </StudioButton>
          </>
        ) : null}

        <div className="evg-shell-topbar-divider evg-shell-topbar-brand-divider" style={{ width: 1, height: 24, background: "var(--line)" }} />
        <Link href={MARKETING_SITE_URL} className="evg-shell-topbar-brand" aria-label="EvGlab Startseite">
          <EvglabMark size={26} />
          <span className="evg-shell-topbar-brand-name studio-serif">EvGlab</span>
        </Link>
      </div>
    </header>
  );
}

const PRICING_HREF = "/dashboard?tab=pricing";

function createNavHref(key: StudioNavKey, href: string, hasActivePlan: boolean) {
  if (key === "create" && !hasActivePlan) return "/inhalte-erstellen";
  return href;
}

function WorkspaceNavItem({
  item,
  activeNav,
  brandProfileActive,
  hasActivePlan,
  onNavigate,
}: {
  item: NavItemDef;
  activeNav: StudioNavKey;
  brandProfileActive: boolean;
  hasActivePlan: boolean;
  onNavigate?: () => void;
}) {
  const locked = item.key === "create" && !hasActivePlan;
  const active = item.key === activeNav || (item.key === "brand" && brandProfileActive);
  const href = createNavHref(item.key, item.href, hasActivePlan);

  return (
    <Link
      href={href}
      scroll={false}
      className={cn("studio-nav-item", active && "studio-nav-item--active", locked && "studio-nav-item--locked")}
      onClick={onNavigate}
      title={locked ? "Abo erforderlich" : undefined}
    >
      <SidebarIcon name={item.icon} />
      <span style={{ flex: 1 }}>{item.label}</span>
      {locked ? (
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <rect x="3" y="7" width="10" height="7" rx="1.5" />
          <path d="M5.5 7 V5.5a2.5 2.5 0 0 1 5 0 V7" strokeLinecap="round" />
        </svg>
      ) : null}
    </Link>
  );
}

type NavItemDef = { key: StudioNavKey; label: string; icon: string; href: string };

const NAV_ITEMS: NavItemDef[] = [
  { key: "dashboard", label: "Dashboard", icon: "dash", href: "/dashboard" },
  { key: "create", label: "Inhalte erstellen", icon: "spark", href: "/inhalte-erstellen" },
  { key: "media", label: "Mediathek", icon: "media", href: "/dashboard?tab=media" },
  { key: "team", label: "Team", icon: "team", href: "/dashboard?tab=team" },
  { key: "brand", label: "Markenprofil", icon: "brand", href: "/dashboard?tab=brand" },
  { key: "settings", label: "Einstellungen", icon: "gear", href: "/dashboard?tab=settings" },
  { key: "pricing", label: "Abonnement", icon: "bolt", href: "/dashboard?tab=pricing" },
];

function AccountSidebarFooter({
  accountName,
  userEmail,
  initials,
}: {
  accountName: string;
  userEmail?: string;
  initials: string;
}) {
  const [signingOut, setSigningOut] = useState(false);

  return (
    <div style={{ marginTop: 12 }}>
      <Link
        href="/dashboard?tab=settings"
        className="studio-card"
        style={{
          padding: 10,
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 11,
          textDecoration: "none",
          color: "inherit",
        }}
      >
        <div className="studio-avatar">{initials}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: 13,
              color: "var(--tx-0)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {accountName}
          </div>
          <div
            className="studio-mono studio-faint"
            style={{
              fontSize: 9.5,
              letterSpacing: 0.4,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {userEmail ?? ""}
          </div>
        </div>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--tx-3)" strokeWidth="1.6" aria-hidden="true">
          <path d="M4 6 L8 10 L12 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
      <button
        type="button"
        className="studio-nav-item"
        style={{ width: "100%", marginTop: 4, border: "none", background: "transparent", cursor: signingOut ? "wait" : "pointer" }}
        disabled={signingOut}
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
  );
}

function StudioMobileBottomNav({
  activeNav,
  onOpenMenu,
  hasActivePlan = true,
}: {
  activeNav: StudioNavKey;
  onOpenMenu: () => void;
  hasActivePlan?: boolean;
}) {
  const tabs: Array<{ key: StudioNavKey | "menu"; label: string; icon: string; href?: string }> = [
    { key: "dashboard", label: "Home", icon: "dash", href: "/dashboard" },
    { key: "create", label: "Erstellen", icon: "spark", href: "/inhalte-erstellen" },
    { key: "media", label: "Medien", icon: "media", href: "/dashboard?tab=media" },
    { key: "menu", label: "Menü", icon: "gear" },
  ];

  return (
    <nav className="evg-shell-mobile-nav" aria-label="Hauptnavigation">
      {tabs.map((tab) => {
        if (tab.key === "menu") {
          return (
            <button key={tab.key} type="button" className="evg-shell-mobile-nav-item" onClick={onOpenMenu}>
              <SidebarIcon name={tab.icon} />
              <span>{tab.label}</span>
            </button>
          );
        }
        const active = tab.key === activeNav;
        const href = tab.key === "create" ? createNavHref("create", tab.href!, hasActivePlan) : tab.href!;
        return (
          <Link
            key={tab.key}
            href={href}
            scroll={false}
            className={cn("evg-shell-mobile-nav-item", active && "evg-shell-mobile-nav-item--active")}
          >
            <SidebarIcon name={tab.icon} color={active ? "var(--acc-hi)" : "currentColor"} />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function StudioMobileDrawer({
  open,
  onClose,
  activeNav,
  brandProfileActive,
  isAdmin,
  adminRouteActive,
  hasActivePlan = true,
  accountName,
  userEmail,
  initials,
}: {
  open: boolean;
  onClose: () => void;
  activeNav: StudioNavKey;
  brandProfileActive: boolean;
  isAdmin: boolean;
  adminRouteActive: boolean;
  hasActivePlan?: boolean;
  accountName: string;
  userEmail?: string;
  initials: string;
}) {
  return (
    <>
      <button
        type="button"
        className={cn("evg-shell-mobile-backdrop", open && "evg-shell-mobile-backdrop--open")}
        aria-label="Menü schließen"
        onClick={onClose}
      />
      <aside className={cn("evg-shell-mobile-drawer", open && "evg-shell-mobile-drawer--open")} aria-hidden={!open}>
        <div className="evg-shell-mobile-drawer-head">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <StudioBrandMark />
            <div>
              <div className="studio-serif" style={{ fontSize: 17, fontWeight: 600 }}>
                EvGlab
              </div>
              <div className="studio-mono studio-faint" style={{ fontSize: 9, letterSpacing: "0.14em", marginTop: 2 }}>
                STUDIO
              </div>
            </div>
          </div>
          <StudioIconButton type="button" aria-label="Menü schließen" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M4 4 L12 12 M12 4 L4 12" />
            </svg>
          </StudioIconButton>
        </div>
        <nav className="evg-shell-mobile-drawer-nav" aria-label="Seitennavigation">
          {NAV_ITEMS.map((it) => (
            <WorkspaceNavItem
              key={it.key}
              item={it}
              activeNav={activeNav}
              brandProfileActive={brandProfileActive}
              hasActivePlan={hasActivePlan}
              onNavigate={onClose}
            />
          ))}
          {isAdmin ? (
            <Link
              href="/admin"
              className={cn("studio-nav-item", adminRouteActive && "studio-nav-item--active")}
              onClick={onClose}
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10 2 L16.5 5 V10.5 C16.5 14.3 13.5 16.8 10 18 C6.5 16.8 3.5 14.3 3.5 10.5 V5 Z" />
                <path d="M7.5 10 L9 11.5 L12.5 8" />
              </svg>
              <span>Admin</span>
            </Link>
          ) : null}
          <Link href="mailto:support@evglab.com" className="studio-nav-item" onClick={onClose}>
            <SidebarIcon name="help" />
            <span>Hilfe & Support</span>
          </Link>
        </nav>
        <AccountSidebarFooter accountName={accountName} userEmail={userEmail} initials={initials} />
      </aside>
    </>
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
  /** Schlüssel für View-Transition (Tab oder Route). */
  contentKey?: string;
  contentPending?: boolean;
}) {
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!contentKey || !mainRef.current) return;
    mainRef.current.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }, [contentKey, reduceMotion]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname, contentKey]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileMenuOpen]);

  const profileName = initialProfileName?.trim() || "";
  const breweryName = initialBreweryName?.trim() || "";
  const accountName = breweryName || profileName || "EvGlab";
  const initials = initialsFromName(accountName);
  const pad = contentPadding ?? "var(--gutter)";

  return (
    <div
      className={cn(studioFontClassName, "evg-studio", "evg-shell")}
      style={{
        background: "var(--bg-0)",
        display: "flex",
        width: "100%",
      }}
    >
      <style>{`
        .evg-shell .evg-card { transition: transform .2s ease, border-color .2s ease, box-shadow .25s ease; }
        .evg-shell .evg-card:hover { transform: translateY(-1px); border-color: var(--line-strong) !important; box-shadow: var(--sh-2); }
        .evg-shell .evg-cta { transition: transform .15s ease, box-shadow .2s ease, filter .2s ease; }
        .evg-shell .evg-cta:hover { transform: translateY(-1px); filter: brightness(1.04); }
        .evg-shell input:not(.studio-field), .evg-shell select:not(.studio-field), .evg-shell textarea:not(.studio-field) {
          background-color: var(--bg-1);
          color: var(--tx-0);
          border: 1px solid var(--line-strong);
          caret-color: var(--acc);
        }
        .evg-shell select option { background: var(--bg-2); color: var(--tx-0); }
        .evg-shell input[type="checkbox"], .evg-shell input[type="radio"] { accent-color: var(--acc); }
        .evg-pill { transition: all .18s ease; }
        .evg-pill:hover { border-color: var(--line-strong) !important; background: var(--bg-3) !important; color: var(--tx-0) !important; }
        .evg-pill-active:hover { border-color: var(--line-accent) !important; background: var(--acc-soft) !important; }
        .evg-result-card:hover .evg-result-img { transform: scale(1.04); }
        .evg-result-card:hover .evg-result-overlay { opacity: 1 !important; }
        .evg-result-card:hover .evg-result-actions { opacity: 1 !important; transform: translateY(0) !important; }
        .evg-result-card { transition: border-color .25s ease, transform .25s ease; }
        .evg-result-card:hover { border-color: var(--line-accent) !important; }
        @keyframes evg-ping { 0% { transform: scale(1); opacity: 1; } 80%,100% { transform: scale(2.2); opacity: 0; } }
        @keyframes evg-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        .evg-ping::after { content: ""; position: absolute; inset: -3px; border-radius: 999px; background: var(--acc); opacity: 0.6; animation: evg-ping 1.8s cubic-bezier(0,0,0.2,1) infinite; }
        .evg-skeleton { background: linear-gradient(90deg, var(--bg-2) 0%, var(--bg-3) 50%, var(--bg-2) 100%); background-size: 200% 100%; animation: evg-shimmer 1.6s linear infinite; }
      `}</style>
      <aside
        className="evg-shell-sidebar"
        style={{
          width: "var(--sidebar-w)",
          background: "var(--bg-1)",
          borderRight: "1px solid var(--line)",
          padding: "24px 18px",
        }}
      >
        <div className="evg-shell-sidebar-brand" style={{ padding: "0 6px 26px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <StudioBrandMark />
            <div>
              <div className="studio-serif" style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1 }}>
                EvGlab
              </div>
              <div className="studio-mono studio-faint" style={{ fontSize: 9.5, letterSpacing: "0.16em", marginTop: 4 }}>
                STUDIO · V2.4
              </div>
            </div>
          </div>
        </div>

        <nav
          className="evg-shell-sidebar-nav"
          data-tour="nav"
          style={{ display: "flex", flexDirection: "column", gap: 3 }}
        >
          <div className="studio-field-label" style={{ padding: "0 12px", marginBottom: 8 }}>
            Arbeitsbereich
          </div>
          {NAV_ITEMS.map((it) => (
            <WorkspaceNavItem
              key={it.key}
              item={it}
              activeNav={activeNav}
              brandProfileActive={brandProfileActive}
              hasActivePlan={hasActivePlan}
            />
          ))}
        </nav>

        <div className="evg-shell-sidebar-footer">
          {isAdmin ? (
            <Link
              href="/admin"
              className={cn("studio-nav-item", adminRouteActive && "studio-nav-item--active")}
              style={{ marginBottom: 4 }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M10 2 L16.5 5 V10.5 C16.5 14.3 13.5 16.8 10 18 C6.5 16.8 3.5 14.3 3.5 10.5 V5 Z" />
                <path d="M7.5 10 L9 11.5 L12.5 8" />
              </svg>
              <span>Admin</span>
            </Link>
          ) : null}
          <Link href="mailto:support@evglab.com" className="studio-nav-item" style={{ marginBottom: 12 }}>
            <SidebarIcon name="help" />
            <span>Hilfe & Support</span>
          </Link>
          <AccountSidebarFooter accountName={accountName} userEmail={userEmail} initials={initials} />
        </div>
      </aside>

      <div className="evg-shell-main-column" style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <StudioTopbar
          breadcrumbLabel={breadcrumbLabel}
          tokensRemaining={tokensRemaining}
          tokensMonthly={tokensMonthly}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          showCreateCta={activeNav !== "create"}
          hasActivePlan={hasActivePlan}
        />
        <main
          ref={mainRef}
          className={cn("evg-shell-main", contentPending && "studio-main-pending")}
          style={{ flex: 1, overflowY: "auto", overflowX: "hidden", WebkitOverflowScrolling: "touch" }}
        >
          <div style={{ maxWidth: "var(--maxw)", margin: "0 auto", padding: pad, boxSizing: "border-box" }}>
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

      <StudioMobileDrawer
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        activeNav={activeNav}
        brandProfileActive={brandProfileActive}
        isAdmin={isAdmin}
        adminRouteActive={adminRouteActive}
        hasActivePlan={hasActivePlan}
        accountName={accountName}
        userEmail={userEmail}
        initials={initials}
      />
      <StudioMobileBottomNav activeNav={activeNav} onOpenMenu={() => setMobileMenuOpen(true)} hasActivePlan={hasActivePlan} />
    </div>
  );
}
