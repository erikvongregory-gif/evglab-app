import type { DashboardBeer, DashboardSettings, ProduktKategorie } from "@/lib/dashboard/metadata";

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
  suggestedBeers?: Array<{
    name: string;
    produktKategorie?: ProduktKategorie;
    bierstil: string;
    flaschenTyp: string;
    flaschenfarbe: "braun" | "gruen" | "klar";
    glasTyp: string;
    etikettUrl: string;
  }>;
};

export type OnboardingBootstrap = {
  profileName: string;
  settings: Partial<DashboardSettings> | null;
  beers: DashboardBeer[];
  userEmail: string;
  hasActivePlan: boolean;
  tokensRemaining: number | null;
};

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

export function parseBrandColors(raw: string): string[] {
  return raw
    .split(/[,;\s]+/)
    .map((c) => c.trim())
    .filter((c) => /^#?[0-9a-fA-F]{3,8}$/.test(c))
    .map((c) => (c.startsWith("#") ? c : `#${c}`))
    .slice(0, 8);
}
