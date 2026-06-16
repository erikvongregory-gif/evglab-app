import type { SubscriptionPlanKey } from "@/lib/billing/tokenState";
import { SUBSCRIPTION_PLAN_TOKENS } from "@/lib/billing/tokenState";
import { formatPlanImageEstimate, formatPlanVideoEstimate } from "@/lib/billing/generationTokenCost";

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

function buildPlanFeatures(planId: SubscriptionPlanKey, carryDays: string, teamLine: string, supportLine: string): string[] {
  const tokens = SUBSCRIPTION_PLAN_TOKENS[planId];
  return [
    `${tokens.toLocaleString("de-DE")} Tokens / Monat`,
    `${formatPlanImageEstimate(tokens)} · ${formatPlanVideoEstimate(tokens)}`,
    "Videos Erstellen (Seedance 2)",
    teamLine,
    supportLine,
    carryDays,
  ];
}

export const STUDIO_PLANS: StudioPlanDefinition[] = [
  {
    id: "start",
    tag: "Für kleine Teams, die regelmäßig posten",
    name: "Brauerei Start",
    monthly: 79,
    yearly: 65,
    compareAtMonthly: 100,
    savingsLabel: "21% Ersparnis inklusive",
    features: buildPlanFeatures(
      "start",
      "Tokens 30 Tage übertragbar",
      "1 Teammitglied",
      "E-Mail-Support",
    ),
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
    features: buildPlanFeatures(
      "growth",
      "Tokens 60 Tage übertragbar",
      "3 Teammitglieder",
      "Priorisierter Support",
    ),
  },
  {
    id: "pro",
    tag: "Für Marken mit hohem Content-Bedarf",
    name: "Brauerei Pro",
    monthly: 299,
    yearly: 249,
    compareAtMonthly: 400,
    savingsLabel: "25% Ersparnis inklusive",
    features: buildPlanFeatures(
      "pro",
      "Tokens 90 Tage übertragbar",
      "10 Teammitglieder",
      "Fast-Lane Rendering + Premium-Support",
    ),
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

/** Hinweis für UI: typischer Video-Verbrauch (720p, ~8 s). */
export const SEEDANCE_VIDEO_TOKEN_HINT =
  "Ein Standard-Video (Seedance 2 · 720p · ~8 s) kostet 90 Tokens — deutlich mehr als eine Bild-Generierung.";
