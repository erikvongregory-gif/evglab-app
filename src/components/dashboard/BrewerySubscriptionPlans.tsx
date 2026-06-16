"use client";

import { Beer, Crown, Rocket } from "lucide-react";
import {
  PricingCard,
  type PricingCardProps,
} from "@/components/ui/animated-glassy-pricing";
import { STUDIO_PLANS } from "@/lib/billing/planCatalog";
import { type SubscriptionPlanKey } from "@/lib/billing/tokenState";

export type { SubscriptionPlanKey } from "@/lib/billing/tokenState";

const KLEINUNTERNEHMER_MODE = process.env.NEXT_PUBLIC_BILLING_KLEINUNTERNEHMER === "true";
const PRICE_SUBTEXT_DEFAULT = "pro Monat zzgl. MwSt.";
const PRICE_SUBTEXT_KLEINUNTERNEHMER = "pro Monat · gemäß § 19 UStG ohne Umsatzsteuer";
const PLAN_PRICE_SUBTEXT = KLEINUNTERNEHMER_MODE
  ? PRICE_SUBTEXT_KLEINUNTERNEHMER
  : PRICE_SUBTEXT_DEFAULT;
const SECTION_VAT_NOTE = KLEINUNTERNEHMER_MODE
  ? "Als Kleinunternehmer gemäß § 19 UStG wird derzeit keine Umsatzsteuer berechnet."
  : "Alle Preise verstehen sich zzgl. gesetzlicher Mehrwertsteuer.";

const DASHBOARD_PLAN_CARD_CLASS =
  "!rounded-xl !border !border-gray-200 !bg-white !shadow-sm !backdrop-blur-0 hover:!shadow-md " +
  "dark:!border-gray-700 dark:!bg-gray-900 " +
  "[&_h2]:!text-gray-900 [&_p]:!text-gray-700 [&_span]:!text-gray-700 [&_ul]:!text-gray-800 " +
  "dark:[&_h2]:!text-white dark:[&_p]:!text-gray-200 dark:[&_span]:!text-gray-200 dark:[&_ul]:!text-gray-100";

const DASHBOARD_POPULAR_PLAN_CARD_CLASS =
  `${DASHBOARD_PLAN_CARD_CLASS} !ring-1 !ring-white/20`;
const DASHBOARD_ACTIVE_PLAN_CARD_CLASS =
  "!border-[#c65a20] !ring-2 !ring-[#c65a20]/35 !shadow-[0_16px_34px_-20px_rgba(198,90,32,0.28)]";

const BREWERY_SUBSCRIPTION_PLANS: PricingCardProps[] = STUDIO_PLANS.map((plan) => ({
  planName: plan.name,
  planIcon: plan.id === "start" ? Beer : plan.id === "growth" ? Rocket : Crown,
  description: plan.tag,
  price: `${plan.monthly} €`,
  currencyPrefix: "",
  priceSubtext: PLAN_PRICE_SUBTEXT,
  buttonText: "Plan wählen",
  buttonVariant: "primary" as const,
  className: plan.recommended ? DASHBOARD_POPULAR_PLAN_CARD_CLASS : DASHBOARD_PLAN_CARD_CLASS,
  isPopular: plan.recommended,
  popularLabel: plan.recommended ? "Beliebteste Wahl" : undefined,
  features: plan.features.map((feature) => feature.replace("–", "-")),
}));

type BrewerySubscriptionPlansProps = {
  activePlan?: SubscriptionPlanKey | null;
  onSelectPlan?: (plan: SubscriptionPlanKey) => void;
  loadingPlan?: SubscriptionPlanKey | null;
  isLoading?: boolean;
  checkoutEnabled?: boolean;
};

export function BrewerySubscriptionPlans({
  activePlan,
  onSelectPlan,
  loadingPlan = null,
  isLoading = false,
  checkoutEnabled = true,
}: BrewerySubscriptionPlansProps) {
  const planKeyByName: Record<string, SubscriptionPlanKey> = {
    "Brauerei Start": "start",
    "Brauerei Wachstum": "growth",
    "Brauerei Pro": "pro",
  };

  return (
    <section className="dashboard-pricing-loop-stack-root relative isolate z-0 mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 md:overflow-hidden md:p-8">
      <div className="dashboard-pricing-loop-content-stack relative z-20">
      <div className="mb-7 flex flex-col items-center gap-3 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#1e232b] px-4 py-1.5 text-sm font-medium text-zinc-200">
          <span aria-hidden>✦</span>
          Abo-Modul
        </span>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 sm:text-3xl">Wähle deinen Preisplan</h2>
        <p className="max-w-2xl text-sm text-gray-600 dark:text-gray-400 sm:text-base">
          Nach dem Login startest du mit einem Plan. Tokens werden für Bild- und Video-Generierung
          verbraucht und monatlich neu aufgefüllt. {SECTION_VAT_NOTE}
        </p>
      </div>

      <div className="flex flex-col items-center gap-5 md:flex-row md:items-stretch md:justify-center md:gap-6">
        {BREWERY_SUBSCRIPTION_PLANS.map((plan) => {
          const key = planKeyByName[plan.planName];
          const isActive = activePlan === key;
          const isCurrentLoading = Boolean(isLoading && loadingPlan && key === loadingPlan);
          const mergedClassName = isActive
            ? `${plan.className ?? ""} ${DASHBOARD_ACTIVE_PLAN_CARD_CLASS}`.trim()
            : plan.className;
          return (
            <PricingCard
              key={plan.planName}
              {...plan}
              className={mergedClassName}
              isPopular={isActive ? true : plan.isPopular}
              popularLabel={isActive ? "Dein aktueller Plan" : plan.popularLabel}
              buttonText={
                !checkoutEnabled
                  ? "Testphase aktiv"
                  : isActive
                    ? "Aktueller Plan"
                    : isCurrentLoading
                      ? "Weiterleitung..."
                      : isLoading
                        ? "Bitte warten..."
                        : plan.buttonText
              }
              buttonLoading={isCurrentLoading}
              buttonDisabled={!checkoutEnabled || isActive}
              onCtaClick={() => {
                if (!checkoutEnabled) return;
                if (isLoading) return;
                if (!isActive && key && onSelectPlan) onSelectPlan(key);
              }}
            />
          );
        })}
      </div>
      </div>
    </section>
  );
}
