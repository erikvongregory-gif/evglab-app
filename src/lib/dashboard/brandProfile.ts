import { getDashboardMetadata } from "@/lib/dashboard/metadata";

export type BrandProfile = {
  brandProfileMode: "undecided" | "guided" | "skip";
  brandInstagramUrl: string;
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

export function getBrandProfileFromMetadata(userMetadata: unknown): BrandProfile {
  const dashboard = getDashboardMetadata(userMetadata);
  const settings = dashboard.settings as Record<string, unknown> | undefined;
  return {
    brandProfileMode: asBrandProfileMode(settings?.brandProfileMode),
    brandInstagramUrl: asString(settings?.brandInstagramUrl),
    brandLockLevel: asBrandLockLevel(settings?.brandLockLevel),
    breweryName: asString(settings?.breweryName),
    brandTone: asString(settings?.brandTone),
    brandColors: asString(settings?.brandColors),
    brandDos: asString(settings?.brandDos),
    brandDonts: asString(settings?.brandDonts),
    brandReferenceImageUrls: asStringArray(settings?.brandReferenceImageUrls),
  };
}

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

export function buildBrandProfilePromptContext(profile: BrandProfile): string {
  return [
    "Brand profile lock (MANDATORY):",
    `- Brand lock level: ${profile.brandLockLevel.toUpperCase()}`,
    `- Brand/Brewery: ${profile.breweryName}`,
    profile.brandInstagramUrl ? `- Brand Instagram: ${profile.brandInstagramUrl}` : "",
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
