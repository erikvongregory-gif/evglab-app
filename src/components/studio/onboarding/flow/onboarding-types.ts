"use client";

import type { DashboardBeer, DashboardSettings, DashboardTeamMember } from "@/lib/dashboard/metadata";
import type { OnboardingFlowStep } from "@/lib/dashboard/onboarding";

export type OnboardingBrandDraft = {
  breweryName: string;
  brandTone: string;
  brandColors: string;
  brandDos: string;
  brandDonts: string;
  brandWebsiteUrl: string;
  brandInstagramUrl: string;
  brandProfileSource: "url" | "instagram" | "manual" | "skip";
  brandLabelReferenceUrl: string;
  referenceImageUrls: string[];
  referenceImagePayloads?: { base64: string; mime: string }[];
};

export type OnboardingBootstrap = {
  profileName: string;
  settings: Partial<DashboardSettings> | null;
  beers: DashboardBeer[];
  team: DashboardTeamMember[];
  userEmail: string;
  initialStep: OnboardingFlowStep;
  hasActivePlan: boolean;
  tokensRemaining: number | null;
};

export const ONBOARDING_STEPS: {
  id: OnboardingFlowStep;
  title: string;
  sub: string;
  kicker: string;
  headline: string;
  lead: string;
}[] = [
  {
    id: 1,
    title: "Brauerei",
    sub: "Name und Website",
    kicker: "SCHRITT 1 VON 5",
    headline: "Erzähl uns von deiner Brauerei",
    lead: "Name und Website bilden die Basis für Markenprofil und Motive. Alles bleibt später änderbar.",
  },
  {
    id: 2,
    title: "Markenprofil",
    sub: "Farben und Tonalität",
    kicker: "SCHRITT 2 VON 5",
    headline: "Dein Markenprofil",
    lead: "Wir analysieren deine Website und bereiten Farben, Tonalität und Bildregeln vor — du bestätigst jeden Wert.",
  },
  {
    id: 3,
    title: "Sortiment",
    sub: "Biere anlegen",
    kicker: "SCHRITT 3 VON 5",
    headline: "Was schenkst du aus?",
    lead: "Jede Sorte wird ein eigener Motiv-Kontext. Lege mindestens ein Bier an — oder füge später weitere hinzu.",
  },
  {
    id: 4,
    title: "Team",
    sub: "Kollegen einladen",
    kicker: "SCHRITT 4 VON 5",
    headline: "Wer arbeitet mit?",
    lead: "Lade Kolleginnen und Kollegen ein — oder überspringe den Schritt und mache es später im Team-Bereich.",
  },
  {
    id: 5,
    title: "Fertig",
    sub: "Erstes Motiv",
    kicker: "FERTIG",
    headline: "Alles bereit",
    lead: "Dein Studio ist eingerichtet. Du kannst Marke, Sortiment und Team jederzeit ändern.",
  },
];

export function emptyBrandDraft(settings?: Partial<DashboardSettings> | null): OnboardingBrandDraft {
  return {
    breweryName: settings?.breweryName?.trim() || "",
    brandTone: settings?.brandTone?.trim() || "",
    brandColors: settings?.brandColors?.trim() || "",
    brandDos: settings?.brandDos?.trim() || "",
    brandDonts: settings?.brandDonts?.trim() || "",
    brandWebsiteUrl: settings?.brandWebsiteUrl?.trim() || "",
    brandInstagramUrl: settings?.brandInstagramUrl?.trim() || "",
    brandProfileSource:
      settings?.brandProfileSource === "url" ||
      settings?.brandProfileSource === "instagram" ||
      settings?.brandProfileSource === "manual" ||
      settings?.brandProfileSource === "skip"
        ? settings.brandProfileSource
        : "manual",
    brandLabelReferenceUrl: settings?.brandLabelReferenceUrl?.trim() || "",
    referenceImageUrls: Array.isArray(settings?.brandReferenceImageUrls)
      ? settings.brandReferenceImageUrls.filter(Boolean).slice(0, 10)
      : [],
  };
}

export function brandLooksReady(draft: OnboardingBrandDraft): boolean {
  return Boolean(
    draft.breweryName.trim() &&
      draft.brandTone.trim() &&
      draft.brandColors.trim() &&
      draft.brandDos.trim() &&
      draft.brandDonts.trim(),
  );
}

export async function patchOnboarding(body: Record<string, unknown>) {
  const res = await fetch("/api/dashboard/onboarding", {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error || "Onboarding-Status konnte nicht gespeichert werden.");
  }
  return res.json();
}
