"use client";

import { Beer, Crown, Rocket } from "lucide-react";
import {
  PricingCard,
  type PricingCardProps,
} from "@/components/ui/animated-glassy-pricing";
import { SUBSCRIPTION_PLAN_TOKENS, type SubscriptionPlanKey } from "@/lib/billing/tokenState";

export type { SubscriptionPlanKey } from "@/lib/billing/tokenState";

const DASHBOARD_PLAN_CARD_CLASS =
  "!rounded-xl !border !border-gray-200 !bg-white !shadow-sm !backdrop-blur-0 hover:!shadow-md " +
  "dark:!border-gray-700 dark:!bg-gray-900 " +
  "[&_h2]:!text-gray-900 [&_p]:!text-gray-700 [&_span]:!text-gray-700 [&_ul]:!text-gray-800 " +
  "dark:[&_h2]:!text-white dark:[&_p]:!text-gray-200 dark:[&_span]:!text-gray-200 dark:[&_ul]:!text-gray-100";

const DASHBOARD_POPULAR_PLAN_CARD_CLASS =
  `${DASHBOARD_PLAN_CARD_CLASS} !ring-1 !ring-white/20`;

const BREWERY_SUBSCRIPTION_PLANS: PricingCardProps[] = [
  {
    planName: "Brauerei Start",
    planIcon: Beer,
    description: "Für kleine Teams, die regelmäßig Content planen und posten.",
    price: "79 €",
    currencyPrefix: "",
    priceSubtext: "pro Monat zzgl. MwSt.",
    buttonText: "Plan wählen",
    buttonVariant: "primary",
    className: DASHBOARD_PLAN_CARD_CLASS,
    features: [
      "1.200 Tokens / Monat",
      "ca. 60-120 Bilder",
      "1 Teammitglied inklusive",
      "E-Mail-Support",
      "Nicht genutzte Tokens: 30 Tage übertragbar",
    ],
  },
  {
    planName: "Brauerei Wachstum",
    planIcon: Rocket,
    description: "Für aktive Brauereien mit regelmäßigen Kampagnen und Saisonaktionen.",
    price: "149 €",
    currencyPrefix: "",
    priceSubtext: "pro Monat zzgl. MwSt.",
    buttonText: "Plan wählen",
    buttonVariant: "primary",
    className: DASHBOARD_PLAN_CARD_CLASS,
    features: [
      "3.000 Tokens / Monat",
      "ca. 150-300 Bilder",
      "3 Teammitglieder inklusive",
      "Priorisierter Support",
      "Nicht genutzte Tokens: 60 Tage übertragbar",
    ],
  },
  {
    planName: "Brauerei Pro",
    planIcon: Crown,
    description: "Für Marken mit hohem Content-Bedarf und mehreren Kanälen.",
    price: "299 €",
    currencyPrefix: "",
    priceSubtext: "pro Monat zzgl. MwSt.",
    buttonText: "Plan wählen",
    isPopular: true,
    popularLabel: "Beliebteste Wahl",
    buttonVariant: "primary",
    className: DASHBOARD_POPULAR_PLAN_CARD_CLASS,
    features: [
      "7.500 Tokens / Monat",
      "ca. 375-750 Bilder",
      "10 Teammitglieder inklusive",
      "Fast-Lane Rendering + Premium-Support",
      "Nicht genutzte Tokens: 90 Tage übertragbar",
    ],
  },
];

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
          Nach dem Login startest du mit einem Plan. Tokens werden für Bild-Generierung
          verbraucht und monatlich neu aufgefüllt. Alle Preise verstehen sich zzgl. gesetzlicher Mehrwertsteuer.
        </p>
      </div>

      <div className="flex flex-col items-center gap-5 md:flex-row md:items-stretch md:justify-center md:gap-6">
        {BREWERY_SUBSCRIPTION_PLANS.map((plan) => {
          const key = planKeyByName[plan.planName];
          const isActive = activePlan === key;
          const isCurrentLoading = Boolean(isLoading && loadingPlan && key === loadingPlan);
          return (
            <PricingCard
              key={plan.planName}
              {...plan}
              buttonText={
                !checkoutEnabled
                  ? "Testphase aktiv"
                  : isActive
                    ? "Aktiver Plan"
                    : isCurrentLoading
                      ? "Weiterleitung..."
                      : isLoading
                        ? "Bitte warten..."
                        : plan.buttonText
              }
              buttonLoading={isCurrentLoading}
              buttonDisabled={!checkoutEnabled}
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
