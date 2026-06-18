"use client";

import { useCallback, useMemo, useState } from "react";
import { StudioButton, StudioPageHeader } from "@/components/studio/ui";
import {
  getPlanAnnualSavingsVsList,
  getPlanDisplayMonthlyPrice,
  SEEDANCE_VIDEO_TOKEN_HINT,
  STUDIO_PLANS,
  type BillingInterval,
  type StudioPlanDefinition,
} from "@/lib/billing/planCatalog";
import { startBillingCheckout } from "@/lib/billing/checkoutClient";
import type { SubscriptionPlanKey } from "@/lib/billing/tokenState";
import { STUDIO_TOKENS } from "@/components/ui/dashboard-studio-shell";

function YearlyBillingToggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className={`studio-pricing-yearly-toggle${enabled ? " on" : ""}`}>
      <div className="studio-pricing-yearly-toggle-copy">
        <div className="studio-pricing-yearly-toggle-head">
          <span className="studio-pricing-yearly-toggle-title">Jährliche Zahlung</span>
          <span className="studio-pricing-yearly-toggle-pill studio-mono">
            <span className="studio-pricing-yearly-toggle-pill-on">Angebot aktiv</span>
            <span className="studio-pricing-yearly-toggle-pill-off">Aus</span>
          </span>
        </div>
        <div className="studio-pricing-yearly-toggle-hint">
          <p className="studio-faint studio-pricing-yearly-toggle-hint-on">
            Standard — Aktionspreise mit bis zu 26 % Ersparnis. Zum Listenpreis einfach deaktivieren.
          </p>
          <p className="studio-faint studio-pricing-yearly-toggle-hint-off">
            Listenpreis aktiv (100 / 200 / 400 €). Jährliche Zahlung für Aktionspreise wieder einschalten.
          </p>
        </div>
      </div>

      <span role="switch" aria-checked={enabled} aria-label="Jährliche Zahlung" className="studio-pricing-yearly-switch">
        <span className="studio-pricing-yearly-switch-knob" />
      </span>

      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => onChange(e.target.checked)}
        className="studio-pricing-yearly-input"
        tabIndex={-1}
        aria-hidden="true"
      />
    </label>
  );
}

function AnimatedPriceValue({ value }: { value: number }) {
  return (
    <span key={value} className="studio-pricing-price studio-accent-serif studio-tnum studio-pricing-price-anim">
      {value}
    </span>
  );
}

function PlanCheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--acc)"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="studio-pricing-check"
      aria-hidden="true"
    >
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  );
}

function PlanCard({
  plan,
  yearlyBilling,
  currentPlan,
  checkoutPending,
  onCheckout,
}: {
  plan: StudioPlanDefinition;
  yearlyBilling: boolean;
  currentPlan: SubscriptionPlanKey | null;
  checkoutPending: SubscriptionPlanKey | null;
  onCheckout: (plan: SubscriptionPlanKey) => void;
}) {
  const price = getPlanDisplayMonthlyPrice(plan, yearlyBilling);
  const isCurrent = currentPlan === plan.id;
  const isRec = Boolean(plan.recommended);
  const showSavings = yearlyBilling;

  return (
    <div className={`studio-pricing-card-wrap${isRec ? " rec" : ""}`}>
      {isRec ? <div className="studio-pricing-rec-badge">Empfohlen</div> : null}

      <div className={`studio-pricing-card${isRec ? " rec" : ""}${isCurrent ? " current" : ""}`}>
        <div className="studio-pricing-card-head">
          <div className={`studio-pricing-card-tag${isRec ? " rec" : ""}`}>{plan.tag}</div>
          <div className="studio-pricing-card-title-row">
            <h2 className="studio-pricing-card-title">{plan.name}</h2>
            {isCurrent ? <span className="studio-pricing-current-badge">Aktuell</span> : null}
          </div>
        </div>

        <div className={`studio-pricing-promo-slot${showSavings ? " on" : ""}`}>
          <div className="studio-pricing-promo-row">
            <span className="studio-pricing-promo-badge">Im Angebot</span>
            <span className="studio-pricing-promo-savings">{plan.savingsLabel}</span>
          </div>
        </div>

        <div className="studio-pricing-price-block">
          <div className="studio-pricing-price-row">
            <AnimatedPriceValue value={price} />
            <span className="studio-pricing-currency">€</span>
            <span className={`studio-pricing-compare-wrap${showSavings ? " on" : ""}`}>
              <span className="studio-pricing-compare">statt {plan.compareAtMonthly} €</span>
            </span>
          </div>
          <div className="studio-pricing-price-meta-slot">
            <span className={`studio-pricing-price-meta${showSavings ? " on" : ""}`}>Pro Monat · jährliche Abrechnung</span>
            <span className={`studio-pricing-price-meta${!showSavings ? " on" : ""}`}>Pro Monat</span>
          </div>
          <div className="studio-pricing-price-sub-slot">
            <p className={`studio-pricing-price-sub studio-mono studio-faint${showSavings ? " on" : ""}`}>
              {(plan.monthly * 12).toLocaleString("de-DE")} € jährlich · du sparst{" "}
              <span className="studio-pricing-savings-amount">{getPlanAnnualSavingsVsList(plan).toLocaleString("de-DE")} €</span>
            </p>
            <p className={`studio-pricing-price-sub studio-mono studio-faint${!showSavings ? " on" : ""}`}>Monatlich kündbar</p>
          </div>
        </div>

        <ul className="studio-pricing-features">
          {plan.features.map((feature) => (
            <li key={feature}>
              <PlanCheckIcon />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        <div className="studio-pricing-cta">
          {isCurrent ? (
            <div className="studio-pricing-cta-current">✓ Aktueller Plan</div>
          ) : (
            <StudioButton
              variant="primary"
              size="lg"
              className={`w-full${isRec ? "" : " studio-pricing-cta-dark"}`}
              disabled={checkoutPending === plan.id}
              onClick={() => onCheckout(plan.id)}
            >
              {checkoutPending === plan.id ? "Weiterleitung …" : "Plan wählen →"}
            </StudioButton>
          )}
        </div>
      </div>
    </div>
  );
}

export function StudioPricingView({
  currentPlan,
  monthlyTokens,
  usedTokens,
  remainingTokens,
  initialCheckoutError = null,
}: {
  currentPlan: SubscriptionPlanKey | null;
  monthlyTokens: number;
  usedTokens: number;
  remainingTokens: number;
  initialCheckoutError?: string | null;
}) {
  const [yearlyBilling, setYearlyBilling] = useState(true);
  const billing: BillingInterval = yearlyBilling ? "yearly" : "monthly";
  const [checkoutPending, setCheckoutPending] = useState<SubscriptionPlanKey | null>(null);
  const [tokenPackPending, setTokenPackPending] = useState<"tokens_500" | "tokens_2000" | null>(null);
  const [portalPending, setPortalPending] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(initialCheckoutError);

  const activePlan = useMemo(
    () => STUDIO_PLANS.find((plan) => plan.id === currentPlan) ?? STUDIO_PLANS[1],
    [currentPlan],
  );
  const tokenPct = monthlyTokens > 0 ? Math.round((usedTokens / monthlyTokens) * 100) : 0;

  const startCheckout = useCallback(
    async (plan: SubscriptionPlanKey) => {
      setCheckoutError(null);
      setCheckoutPending(plan);
      try {
        const result = await startBillingCheckout({ plan, interval: billing });
        if (!result.ok && !result.redirected) {
          setCheckoutError(result.error);
        }
      } catch {
        setCheckoutError("Checkout konnte nicht gestartet werden.");
      } finally {
        setCheckoutPending(null);
      }
    },
    [billing],
  );

  const openPortal = useCallback(async () => {
    setPortalPending(true);
    setCheckoutError(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST", credentials: "same-origin" });
      const json = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!res.ok || !json?.url) {
        setCheckoutError(json?.error ?? "Kundenportal konnte nicht geöffnet werden.");
        return;
      }
      window.location.href = json.url;
    } catch {
      setCheckoutError("Kundenportal konnte nicht geöffnet werden.");
    } finally {
      setPortalPending(false);
    }
  }, []);

  const buyTokenPack = useCallback(async (pack: "tokens_500" | "tokens_2000") => {
    setCheckoutError(null);
    setTokenPackPending(pack);
    try {
      const res = await fetch("/api/billing/buy-tokens", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pack }),
      });
      const json = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!res.ok || !json?.url) {
        setCheckoutError(json?.error ?? "Token-Kauf konnte nicht gestartet werden.");
        return;
      }
      window.location.href = json.url;
    } catch {
      setCheckoutError("Token-Kauf konnte nicht gestartet werden.");
    } finally {
      setTokenPackPending(null);
    }
  }, []);

  return (
    <div>
      <StudioPageHeader
        eyebrow="Abonnement"
        title="Dein Plan"
        subtitle="Jährliche Zahlung ist standardmäßig aktiv (79 / 149 / 299 €) — ohne Jahresabo gelten die Listenpreise 100 / 200 / 400 €. Tokens gelten für Bilder und Videos (Seedance 2)."
      />

      {checkoutError ? (
        <div
          className="studio-card studio-card-pad"
          style={{ marginBottom: 16, borderColor: "var(--warn)", background: "var(--warn-soft)" }}
          role="alert"
        >
          <p className="studio-page-sub" style={{ color: "var(--warn-hi)", margin: 0 }}>
            {checkoutError}
          </p>
        </div>
      ) : null}

      <div className="studio-card studio-pricing-summary">
        <div>
          <div className="studio-page-eyebrow" style={{ marginBottom: 10 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--ok)", boxShadow: "0 0 0 3px var(--ok-soft)" }} />
            Aktiver Plan
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <span className="studio-accent-serif" style={{ fontSize: 22, fontWeight: 500 }}>
              {currentPlan ? activePlan.name : "Kein Abo"}
            </span>
            {currentPlan ? (
              <span className="studio-faint" style={{ fontSize: 13 }}>
                {activePlan.monthly} € / Monat
              </span>
            ) : null}
          </div>
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span className="studio-field-label" style={{ margin: 0 }}>
              Tokens · aktueller Zyklus
            </span>
            <span
              className="studio-mono"
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: "3px 8px",
                borderRadius: "var(--r-xs)",
                background: "var(--acc-soft)",
                color: "var(--acc-hi)",
              }}
            >
              {tokenPct}% genutzt
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 99, background: "var(--bg-4)", overflow: "hidden" }}>
            <div
              style={{
                width: `${Math.min(tokenPct, 100)}%`,
                height: "100%",
                borderRadius: 99,
                background: "linear-gradient(90deg, var(--acc-lo), var(--acc-hi))",
                transition: "width .4s ease",
              }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
            <span className="studio-faint studio-tnum" style={{ fontSize: 11.5 }}>
              {usedTokens.toLocaleString("de-DE")} verbraucht
            </span>
            <span className="studio-faint studio-tnum" style={{ fontSize: 11.5 }}>
              {monthlyTokens.toLocaleString("de-DE")} gesamt · {remainingTokens.toLocaleString("de-DE")} frei
            </span>
          </div>
        </div>

        <div>
          <div className="studio-faint" style={{ fontSize: 11.5, marginBottom: 4 }}>
            Abrechnung
          </div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{currentPlan ? "Aktives Abonnement" : "Noch kein Plan"}</div>
        </div>

        <StudioButton variant="ghost" size="sm" disabled={portalPending} onClick={() => void openPortal()}>
          {portalPending ? "Öffnen …" : "Rechnung & Portal"}
        </StudioButton>
      </div>

      <YearlyBillingToggle enabled={yearlyBilling} onChange={setYearlyBilling} />

      <div className={`studio-pricing-plans${yearlyBilling ? " yearly-on" : " yearly-off"}`}>
        {STUDIO_PLANS.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            yearlyBilling={yearlyBilling}
            currentPlan={currentPlan}
            checkoutPending={checkoutPending}
            onCheckout={startCheckout}
          />
        ))}
      </div>

      {currentPlan ? (
        <div className="studio-card" style={{ marginTop: 24, padding: 20 }}>
          <div className="studio-page-eyebrow" style={{ marginBottom: 8 }}>
            Zusätzliche Tokens
          </div>
          <p className="studio-faint" style={{ fontSize: 13, marginBottom: 16, maxWidth: 520 }}>
            Einmalige Token-Packs für mehr Bild- und Video-Generierungen im aktuellen Abrechnungszeitraum. Gekaufte Tokens
            bleiben erhalten, bis du sie verbrauchst. {SEEDANCE_VIDEO_TOKEN_HINT}
          </p>
          <div className="studio-pricing-token-packs">
            <div className="studio-pricing-card studio-pricing-token-pack">
              <div className="studio-pricing-token-pack-title">+500 Tokens</div>
              <div className="studio-pricing-token-pack-price studio-accent-serif">39 €</div>
              <StudioButton
                variant="ghost"
                size="sm"
                className="w-full studio-pricing-token-pack-cta"
                disabled={tokenPackPending !== null}
                onClick={() => void buyTokenPack("tokens_500")}
              >
                {tokenPackPending === "tokens_500" ? "Weiterleitung …" : "Jetzt kaufen →"}
              </StudioButton>
            </div>
            <div className="studio-pricing-card studio-pricing-token-pack">
              <div className="studio-pricing-token-pack-title">+2.000 Tokens</div>
              <div className="studio-pricing-token-pack-price studio-accent-serif">119 €</div>
              <StudioButton
                variant="ghost"
                size="sm"
                className="w-full studio-pricing-token-pack-cta"
                disabled={tokenPackPending !== null}
                onClick={() => void buyTokenPack("tokens_2000")}
              >
                {tokenPackPending === "tokens_2000" ? "Weiterleitung …" : "Jetzt kaufen →"}
              </StudioButton>
            </div>
          </div>
        </div>
      ) : null}

      <div className="studio-pricing-footnote">
        <p>Alle Preise gemäß § 19 UStG ohne Umsatzsteuer · Monatlich kündbar · Tokens übertragbar je nach Plan · Videos via Seedance 2</p>
      </div>
    </div>
  );
}
