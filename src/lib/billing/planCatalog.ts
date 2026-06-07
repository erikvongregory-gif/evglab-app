import type { SubscriptionPlanKey } from "@/lib/billing/tokenState";

export type BillingInterval = "monthly" | "yearly";

export type StudioPlanDefinition = {
  id: SubscriptionPlanKey;
  tag: string;
  name: string;
  monthly: number;
  yearly: number;
  /** Streichpreis Monatsabo (Marketing) */
  compareAtMonthly: number;
  /** z. B. „21% Ersparnis inklusive“ */
  savingsLabel: string;
  recommended?: boolean;
  features: string[];
};

export const STUDIO_PLANS: StudioPlanDefinition[] = [
  {
    id: "start",
    tag: "Für kleine Teams, die regelmäßig posten",
    name: "Brauerei Start",
    monthly: 79,
    yearly: 65,
    compareAtMonthly: 100,
    savingsLabel: "21% Ersparnis inklusive",
    features: [
      "1.200 Tokens / Monat",
      "ca. 60–120 Bilder",
      "1 Teammitglied",
      "E-Mail-Support",
      "Tokens 30 Tage übertragbar",
    ],
  },
  {
    id: "growth",
    tag: "Für aktive Brauereien mit Saisonkampagnen",
    name: "Brauerei Wachstum",
    monthly: 149,
    yearly: 125,
    compareAtMonthly: 200,
    savingsLabel: "26% Ersparnis inklusive",
    recommended: true,
    features: [
      "3.000 Tokens / Monat",
      "ca. 150–300 Bilder",
      "3 Teammitglieder",
      "Priorisierter Support",
      "Tokens 60 Tage übertragbar",
    ],
  },
  {
    id: "pro",
    tag: "Für Marken mit hohem Content-Bedarf",
    name: "Brauerei Pro",
    monthly: 299,
    yearly: 249,
    compareAtMonthly: 400,
    savingsLabel: "25% Ersparnis inklusive",
    features: [
      "7.500 Tokens / Monat",
      "ca. 375–750 Bilder",
      "10 Teammitglieder",
      "Fast-Lane Rendering + Premium-Support",
      "Tokens 90 Tage übertragbar",
    ],
  },
];

export const PLAN_ORDER: SubscriptionPlanKey[] = ["start", "growth", "pro"];

export function planRank(plan: SubscriptionPlanKey): number {
  return PLAN_ORDER.indexOf(plan);
}

/** Angezeigter Monatspreis: jährlich = Aktionspreis, Monatsabo = Listenpreis. */
export function getPlanDisplayMonthlyPrice(plan: StudioPlanDefinition, yearlyBilling: boolean): number {
  return yearlyBilling ? plan.monthly : plan.compareAtMonthly;
}

/** Jährliche Ersparnis gegenüber Listenpreis (nur bei jährlicher Zahlung relevant). */
export function getPlanAnnualSavingsVsList(plan: StudioPlanDefinition): number {
  return (plan.compareAtMonthly - plan.monthly) * 12;
}
