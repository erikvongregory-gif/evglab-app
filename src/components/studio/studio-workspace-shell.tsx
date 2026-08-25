"use client";

import {
  Suspense,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { STUDIO_LAYOUT } from "@/components/dashboard/studio-reference-ui";
import { StudioOnboardingProvider } from "@/components/studio/onboarding/onboarding-context";
import { StudioOnboardingWelcome } from "@/components/studio/onboarding/onboarding-welcome";
import { StudioOnboardingChecklist } from "@/components/studio/onboarding/onboarding-checklist";
import { StudioOnboardingHints } from "@/components/studio/onboarding/onboarding-hints";
import {
  DashboardStudioShell,
  type StudioNavKey,
} from "@/components/ui/dashboard-studio-shell";
import { runBillingBootstrap } from "@/lib/billing/clientBootstrap";
import { hasActiveSubscriptionFromState } from "@/lib/billing/access";
import { HopfenHugoAssistant } from "@/components/studio/hopfen-hugo-assistant";

type StudioShellContextValue = {
  setBrandProfileActive: (active: boolean) => void;
  setContentPadding: (padding: string | undefined) => void;
  setContentPending: (pending: boolean) => void;
};

const StudioShellContext = createContext<StudioShellContextValue | null>(null);

export function useStudioShell(): StudioShellContextValue {
  const ctx = useContext(StudioShellContext);
  if (!ctx) {
    throw new Error("useStudioShell muss innerhalb von StudioWorkspaceShell verwendet werden.");
  }
  return ctx;
}

function resolveDashboardTab(tabParam: string): StudioNavKey {
  if (tabParam === "media") return "media";
  if (tabParam === "team") return "team";
  if (tabParam === "brand") return "brand";
  if (tabParam === "settings") return "settings";
  if (tabParam === "pricing") return "pricing";
  return "dashboard";
}

function breadcrumbForNav(nav: StudioNavKey): string {
  switch (nav) {
    case "dashboard":
      return "Dashboard";
    case "media":
      return "Mediathek";
    case "team":
      return "Team";
    case "brand":
      return "Markenprofil";
    case "settings":
      return "Einstellungen";
    case "pricing":
      return "Abonnement";
    case "create":
      return "Bilder Erstellen";
    case "create-video":
      return "Videos Erstellen";
    default:
      return "Dashboard";
  }
}

export function StudioLayoutFallback() {
  return (
    <div
      className="evg-studio"
      style={{ minHeight: "100vh", background: "var(--bg-0, #131211)" }}
      aria-hidden
    />
  );
}

export function StudioWorkspaceShell({
  children,
  userEmail,
  initialProfileName,
  initialBreweryName,
  isAdmin = false,
  initialHasActivePlan = false,
}: {
  children: ReactNode;
  userEmail?: string;
  initialProfileName?: string;
  initialBreweryName?: string;
  isAdmin?: boolean;
  /** Owner starten freigeschaltet — sonst flackert „Abo erforderlich“ in der Nav. */
  initialHasActivePlan?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [brandProfileActive, setBrandProfileActiveState] = useState(false);
  const [contentPadding, setContentPaddingState] = useState<string | undefined>();
  const [contentPending, setContentPendingState] = useState(false);
  const [tokensRemaining, setTokensRemaining] = useState<number | undefined>();
  const [tokensMonthly, setTokensMonthly] = useState<number | undefined>();
  const [hasActivePlan, setHasActivePlan] = useState(initialHasActivePlan);

  const isCreateRoute = pathname.startsWith("/inhalte-erstellen");
  const isVideoCreateRoute = pathname.startsWith("/videos-erstellen");
  const isAdminRoute = pathname.startsWith("/admin");
  const tabParam = (searchParams.get("tab") ?? "dashboard").toLowerCase();

  const activeNav = isCreateRoute
    ? ("create" as const)
    : isVideoCreateRoute
      ? ("create-video" as const)
      : resolveDashboardTab(tabParam);
  const contentKey = isCreateRoute ? "create" : isVideoCreateRoute ? "create-video" : isAdminRoute ? "admin" : "dashboard";
  const breadcrumbLabel = isAdminRoute ? "Admin-Bereich" : breadcrumbForNav(activeNav);

  useEffect(() => {
    setBrandProfileActiveState(false);
    setContentPaddingState(undefined);
    setContentPendingState(false);
  }, [pathname]);

  useEffect(() => {
    let ignore = false;

    const refreshBillingUi = async () => {
      try {
        const res = await fetch("/api/dashboard/summary", { cache: "no-store", credentials: "include" });
        if (!res.ok || ignore) return;
        const json = (await res.json()) as {
          summary?: {
            tokens?: { remaining?: number; monthly?: number };
            plan?: string | null;
            billingStatus?: string;
          };
        };
        if (json.summary?.tokens) {
          setTokensRemaining(json.summary.tokens.remaining);
          setTokensMonthly(json.summary.tokens.monthly);
        }
        setHasActivePlan(
          hasActiveSubscriptionFromState(json.summary?.plan, json.summary?.billingStatus),
        );
      } catch {
        /* Topbar zeigt Platzhalter */
      }
    };

    void (async () => {
      await runBillingBootstrap();
      await refreshBillingUi();
    })();

    const onBillingUpdated = () => {
      void refreshBillingUi();
    };
    window.addEventListener("evglab-billing-updated", onBillingUpdated);

    return () => {
      ignore = true;
      window.removeEventListener("evglab-billing-updated", onBillingUpdated);
    };
  }, [pathname]);

  const setBrandProfileActive = useCallback((active: boolean) => {
    setBrandProfileActiveState(active);
  }, []);

  const setContentPadding = useCallback((padding: string | undefined) => {
    setContentPaddingState(padding);
  }, []);

  const setContentPending = useCallback((pending: boolean) => {
    setContentPendingState(pending);
  }, []);

  const shellContext = useMemo(
    () => ({
      setBrandProfileActive,
      setContentPadding,
      setContentPending,
    }),
    [setBrandProfileActive, setContentPadding, setContentPending],
  );

  return (
    <StudioShellContext.Provider value={shellContext}>
      <StudioOnboardingProvider>
        <DashboardStudioShell
          userEmail={userEmail}
          initialProfileName={initialProfileName}
          initialBreweryName={initialBreweryName}
          activeNav={activeNav}
          breadcrumbLabel={breadcrumbLabel}
          contentPadding={contentPadding ?? STUDIO_LAYOUT.contentPadding}
          contentKey={contentKey}
          contentPending={contentPending}
          brandProfileActive={brandProfileActive}
          isAdmin={isAdmin}
          adminRouteActive={isAdminRoute}
          hasActivePlan={hasActivePlan}
          tokensRemaining={tokensRemaining}
          tokensMonthly={tokensMonthly}
        >
          {children}
        </DashboardStudioShell>
        <StudioOnboardingWelcome />
        <StudioOnboardingChecklist />
        <StudioOnboardingHints area={activeNav} />
      </StudioOnboardingProvider>
      <Suspense fallback={null}>
        <HopfenHugoAssistant />
      </Suspense>
    </StudioShellContext.Provider>
  );
}
