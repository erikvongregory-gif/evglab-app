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

/** Ungenutzte Abo-Tokens: einmalig in den Folgemonat, danach Verfall. */
export const TOKEN_CARRY_DAYS = 30;
const CARRY_FEATURE = "Ungenutzte Tokens 1 Monat übertragbar";

function buildPlanFeatures(planId: SubscriptionPlanKey, teamLine: string, supportLine: string): string[] {
  const tokens = SUBSCRIPTION_PLAN_TOKENS[planId];
  return [
    `${tokens.toLocaleString("de-DE")} Tokens / Monat`,
    `${formatPlanImageEstimate(tokens)} · ${formatPlanVideoEstimate(tokens)}`,
    "Videos erstellen mit Seedance 2.5",
    teamLine,
    supportLine,
    CARRY_FEATURE,
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
      "1 Teamplatz (Inhaber inklusive)",
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
      "3 Teamplätze (Inhaber inklusive)",
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
      "10 Teamplätze (Inhaber inklusive)",
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

/** Hinweis für UI: typischer Video-Verbrauch (720p, 5 s, mit Audio). */
export const SEEDANCE_VIDEO_TOKEN_HINT =
  "Ein Standard-Video (Seedance 2.5 · 720p · 5 s · mit Audio) kostet 100 Tokens — Varianten und längere Clips multiplizieren 1:1.";
