"use client";

import { Suspense, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { StudioPricingView } from "@/components/studio/studio-pricing-view";
import { studioFontClassName } from "@/lib/fonts/studio-fonts";
import type { SubscriptionPlanKey } from "@/lib/billing/tokenState";

function StudioChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className={`evg-studio ${studioFontClassName}`} style={{ minHeight: "100dvh", background: "var(--app)" }}>
      <style>{`html, body { background: var(--app) !important; margin: 0; }`}</style>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "14px 24px",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div style={{ flex: 1, maxWidth: 320, padding: "8px 12px", border: "1px solid var(--line)" }}>
          <span className="evg-mono" style={{ fontSize: 11, color: "var(--fg-5)" }}>
            Suche …
          </span>
        </div>
        <div className="evg-mono" style={{ padding: "6px 10px", border: "1px solid var(--line-strong)", fontSize: 11 }}>
          620 / 1.600
        </div>
      </header>
      <div style={{ display: "flex", minHeight: "calc(100dvh - 53px)" }}>
        <aside style={{ width: 62, borderRight: "1px solid var(--line)", padding: 16 }} aria-hidden="true" />
        <main style={{ flex: 1, padding: "32px 24px 96px", minWidth: 0 }}>{children}</main>
      </div>
      <nav className="evg-bottom-nav" aria-label="Hauptnavigation (Mock)">
        {["Dashboard", "Erstellen", "Medien", "Mehr"].map((label) => (
          <button
            key={label}
            type="button"
            className="evg-bottom-nav__item"
            aria-current={label === "Mehr" ? "page" : undefined}
          >
            <span style={{ width: 18, height: 18, borderRadius: 4, background: "var(--line2)" }} aria-hidden />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function CheckoutLoadingDemo() {
  useEffect(() => {
    const origFetch = window.fetch.bind(window);
    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
      if (url.includes("/api/billing/checkout")) {
        return new Promise<Response>(() => {});
      }
      return origFetch(input, init);
    }) as typeof window.fetch;

    const timer = window.setTimeout(() => {
      const buttons = document.querySelectorAll<HTMLButtonElement>(".studio-pricing-cta button");
      for (const btn of buttons) {
        if (!btn.disabled && btn.textContent?.includes("Plan wählen")) {
          btn.click();
          break;
        }
      }
    }, 600);

    return () => {
      window.clearTimeout(timer);
      window.fetch = origFetch;
    };
  }, []);

  return (
    <StudioPricingView
      currentPlan="pro"
      monthlyTokens={1600}
      usedTokens={980}
      remainingTokens={620}
    />
  );
}

function PricingQaDemo({ view }: { view: string }) {
  const subtitle = useMemo(() => {
    const labels: Record<string, string> = {
      pricing: "Volle Pricing-Ansicht",
      "current-plan": "Aktiver Plan (Summary)",
      "checkout-loading": "Checkout lädt",
      "token-packs": "Token-Packs",
      error: "Billing-Fehler",
    };
    return labels[view] ?? view;
  }, [view]);

  const plan: SubscriptionPlanKey | null = view === "no-plan" ? null : "pro";
  const initialCheckoutError =
    view === "error" ? "Checkout konnte nicht gestartet werden. Bitte versuche es erneut oder kontaktiere den Support." : null;

  if (view === "checkout-loading") {
    return (
      <>
        <p style={{ margin: "0 0 20px", fontSize: 12, color: "var(--t3)" }}>
          T8 QA — Abonnement ({subtitle}, Mock, keine API)
        </p>
        <CheckoutLoadingDemo />
      </>
    );
  }

  return (
    <>
      <p style={{ margin: "0 0 20px", fontSize: 12, color: "var(--t3)" }}>
        T8 QA — Abonnement ({subtitle}, Mock, keine API)
      </p>
      <StudioPricingView
        currentPlan={plan}
        monthlyTokens={1600}
        usedTokens={980}
        remainingTokens={620}
        initialCheckoutError={initialCheckoutError}
      />
    </>
  );
}

function T8QaInner() {
  const searchParams = useSearchParams();
  const view = searchParams.get("view") ?? "pricing";

  return (
    <StudioChrome>
      <PricingQaDemo view={view} />
    </StudioChrome>
  );
}

export default function T8QaPage() {
  return (
    <Suspense fallback={null}>
      <T8QaInner />
    </Suspense>
  );
}
