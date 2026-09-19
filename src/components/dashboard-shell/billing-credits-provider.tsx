"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  runBillingBootstrap,
  type ClientBillingState,
} from "@/lib/billing/clientBootstrap";
import {
  invalidateBillingCredits,
  loadBillingCredits,
  peekBillingCredits,
} from "@/lib/billing/creditsCache";
import { markDashboardPerf } from "@/lib/dashboard/dashboardPerf";

type BillingCreditsContextValue = {
  state: ClientBillingState | null;
  loaded: boolean;
  refresh: (force?: boolean) => Promise<ClientBillingState | null>;
};

const BillingCreditsContext = createContext<BillingCreditsContextValue | null>(null);

export function BillingCreditsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ClientBillingState | null>(() => peekBillingCredits());
  const [loaded, setLoaded] = useState(() => peekBillingCredits() != null);

  const refresh = useCallback(async (force = true) => {
    const next = await loadBillingCredits({ force });
    setState(next);
    setLoaded(true);
    if (next) markDashboardPerf("tokens-ready");
    return next;
  }, []);

  useEffect(() => {
    markDashboardPerf("shell-visible");
    let cancelled = false;

    void (async () => {
      try {
        const result = await runBillingBootstrap();
        if (cancelled) return;
        setState(result.state);
        setLoaded(true);
        if (result.state) markDashboardPerf("tokens-ready");
      } catch {
        if (!cancelled) setLoaded(true);
      }
    })();

    const onUpdate = () => {
      void refresh(true);
    };
    const onInvalidate = () => {
      invalidateBillingCredits();
      void refresh(true);
    };

    window.addEventListener("evglab-billing-updated", onUpdate);
    window.addEventListener("evglab-workspace-changed", onInvalidate);
    return () => {
      cancelled = true;
      window.removeEventListener("evglab-billing-updated", onUpdate);
      window.removeEventListener("evglab-workspace-changed", onInvalidate);
    };
  }, [refresh]);

  const value = useMemo(
    () => ({
      state,
      loaded,
      refresh,
    }),
    [state, loaded, refresh],
  );

  return <BillingCreditsContext.Provider value={value}>{children}</BillingCreditsContext.Provider>;
}

export function useBillingCredits(): BillingCreditsContextValue {
  const ctx = useContext(BillingCreditsContext);
  if (!ctx) {
    return {
      state: peekBillingCredits(),
      loaded: peekBillingCredits() != null,
      refresh: (force = true) => loadBillingCredits({ force }),
    };
  }
  return ctx;
}
