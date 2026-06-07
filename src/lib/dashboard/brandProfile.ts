import { getDashboardMetadata } from "@/lib/dashboard/metadata";

export type BrandProfileSource = "url" | "instagram" | "manual" | "skip";

export type BrandProfile = {
  brandProfileMode: "undecided" | "guided" | "skip";
  brandInstagramUrl: string;
  brandWebsiteUrl: string;
  brandProfileSource: BrandProfileSource;
  brandLockLevel: "strict" | "balanced" | "loose";
  breweryName: string;
  brandTone: string;
  brandColors: string;
  brandDos: string;
  brandDonts: string;
  brandReferenceImageUrls: string[];
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, 10);
}

function asBrandProfileMode(value: unknown): BrandProfile["brandProfileMode"] {
  if (value === "guided" || value === "skip" || value === "undecided") return value;
  return "undecided";
}

function asBrandLockLevel(value: unknown): BrandProfile["brandLockLevel"] {
  if (value === "strict" || value === "balanced" || value === "loose") return value;
  return "strict";
}

function asBrandProfileSource(value: unknown): BrandProfileSource {
  if (value === "url" || value === "instagram" || value === "manual" || value === "skip") return value;
  return "manual";
}

export function getBrandProfileFromMetadata(userMetadata: unknown): BrandProfile {
  const dashboard = getDashboardMetadata(userMetadata);
  const settings = dashboard.settings as Record<string, unknown> | undefined;
  return {
    brandProfileMode: asBrandProfileMode(settings?.brandProfileMode),
    brandInstagramUrl: asString(settings?.brandInstagramUrl),
    brandWebsiteUrl: asString(settings?.brandWebsiteUrl),
    brandProfileSource: asBrandProfileSource(settings?.brandProfileSource),
    brandLockLevel: asBrandLockLevel(settings?.brandLockLevel),
    breweryName: asString(settings?.breweryName),
    brandTone: asString(settings?.brandTone),
    brandColors: asString(settings?.brandColors),
    brandDos: asString(settings?.brandDos),
    brandDonts: asString(settings?.brandDonts),
    brandReferenceImageUrls: asStringArray(settings?.brandReferenceImageUrls),
  };
}

/**
 * Minimaldatensatz fuer „complete“:
 * - Mode `skip` zaehlt unabhaengig von Feldern als complete (User hat sich bewusst dagegen entschieden).
 * - Sonst muessen alle 5 Brand-Textfelder ausgefuellt sein (nach trim).
 *
 * Referenzbilder sind NICHT teil der Completeness — sie sind optional und
 * werden separat ueber `brandReferenceImagesStale` getrackt.
 */
export function isBrandProfileComplete(profile: BrandProfile): boolean {
  if (profile.brandProfileMode === "skip") return true;
  return Boolean(
    profile.breweryName &&
      profile.brandTone &&
      profile.brandColors &&
      profile.brandDos &&
      profile.brandDonts,
  );
}

/**
 * Strukturell identische Pruefung fuer Settings-Payloads (Client-seitig).
 * Adapter um Duplikation in Komponenten zu vermeiden.
 */
export function isBrandProfileCompleteFromSettings(
  settings: {
    brandProfileMode?: BrandProfile["brandProfileMode"];
    breweryName?: string;
    brandWebsiteUrl?: string;
    brandTone?: string;
    brandColors?: string;
    brandDos?: string;
    brandDonts?: string;
  } | null,
): boolean {
  if (!settings) return false;
  if (settings.brandProfileMode === "skip") return true;
  if (settings.brandProfileMode !== "guided") return false;
  const hasIdentity = Boolean(settings.breweryName?.trim() || settings.brandWebsiteUrl?.trim());
  return Boolean(
    hasIdentity &&
      settings.brandTone?.trim() &&
      settings.brandColors?.trim() &&
      settings.brandDos?.trim() &&
      settings.brandDonts?.trim(),
  );
}

/** „Kampagnenbild mit Text“ nur mit aktivem, ausgefülltem Markenprofil (nicht Modus „ohne Profil“). */
export function canUseCampaignWithTextProfile(profile: BrandProfile): boolean {
  return profile.brandProfileMode === "guided" && isBrandProfileComplete(profile);
}

export function buildBrandProfilePromptContext(profile: BrandProfile): string {
  return [
    "Brand profile lock (MANDATORY):",
    `- Brand lock level: ${profile.brandLockLevel.toUpperCase()}`,
    `- Brand/Brewery: ${profile.breweryName}`,
    profile.brandInstagramUrl ? `- Brand Instagram: ${profile.brandInstagramUrl}` : "",
    profile.brandWebsiteUrl ? `- Brand website: ${profile.brandWebsiteUrl}` : "",
    `- Brand tone: ${profile.brandTone}`,
    `- Brand colors/style cues: ${profile.brandColors}`,
    `- Must include style rules: ${profile.brandDos}`,
    `- Must avoid style rules: ${profile.brandDonts}`,
    `- Reference image URLs available: ${profile.brandReferenceImageUrls.join(", ")}`,
    "- Keep all generated outputs aligned with this brand profile unless the user explicitly overrides it.",
  ]
    .filter(Boolean)
    .join("\n");
}
