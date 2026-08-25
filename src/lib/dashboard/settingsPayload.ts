import type { DashboardSettings } from "@/lib/dashboard/metadata";

/** Client/API-Hilfsfeld — nicht in user_metadata speichern. */
const CLIENT_ONLY_KEYS = new Set(["brandReferenceImagesStale"]);

/** Muss mit `settingsSchema` in `/api/dashboard/settings` uebereinstimmen. */
export const BRAND_SETTINGS_LIMITS = {
  breweryName: 120,
  brandTone: 300,
  brandColors: 300,
  brandDos: 600,
  brandDonts: 600,
} as const;

function clampText(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.trim().slice(0, max);
}

/** Kuerzt Markenprofil-Texte vor Validierung/Speichern (KI-Antworten koennen zu lang sein). */
export function clampBrandSettingsFields(input: Record<string, unknown>): Record<string, unknown> {
  const next = { ...input };
  const breweryName = clampText(next.breweryName, BRAND_SETTINGS_LIMITS.breweryName);
  const brandTone = clampText(next.brandTone, BRAND_SETTINGS_LIMITS.brandTone);
  const brandColors = clampText(next.brandColors, BRAND_SETTINGS_LIMITS.brandColors);
  const brandDos = clampText(next.brandDos, BRAND_SETTINGS_LIMITS.brandDos);
  const brandDonts = clampText(next.brandDonts, BRAND_SETTINGS_LIMITS.brandDonts);
  if (breweryName !== undefined) next.breweryName = breweryName;
  if (brandTone !== undefined) next.brandTone = brandTone;
  if (brandColors !== undefined) next.brandColors = brandColors;
  if (brandDos !== undefined) next.brandDos = brandDos;
  if (brandDonts !== undefined) next.brandDonts = brandDonts;
  return next;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asBrandMode(value: unknown): DashboardSettings["brandProfileMode"] {
  if (value === "guided" || value === "skip" || value === "undecided") return value;
  return "undecided";
}

function asBrandSource(value: unknown): DashboardSettings["brandProfileSource"] {
  if (value === "url" || value === "instagram" || value === "manual" || value === "skip") return value;
  return "manual";
}

function asLockLevel(value: unknown): DashboardSettings["brandLockLevel"] {
  if (value === "strict" || value === "balanced" || value === "loose") return value;
  return "strict";
}

function asReferenceUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 10);
}

/** Normalisiert API-Settings (entfernt Client-only-Felder, setzt Defaults). */
export function sanitizeDashboardSettings(input: unknown): DashboardSettings {
  const raw =
    typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};

  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!CLIENT_ONLY_KEYS.has(key)) cleaned[key] = value;
  }

  const analyzedAt = asString(cleaned.brandAnalyzedAt);

  return {
    profileName: asString(cleaned.profileName),
    breweryName: asString(cleaned.breweryName),
    profilePhone: asString(cleaned.profilePhone),
    emailNotifications: asBool(cleaned.emailNotifications, true),
    weeklySummary: asBool(cleaned.weeklySummary, true),
    brandProfileMode: asBrandMode(cleaned.brandProfileMode),
    brandInstagramUrl: asString(cleaned.brandInstagramUrl),
    brandWebsiteUrl: asString(cleaned.brandWebsiteUrl),
    brandProfileSource: asBrandSource(cleaned.brandProfileSource),
    brandLockLevel: asLockLevel(cleaned.brandLockLevel),
    brandTone: asString(cleaned.brandTone),
    brandColors: asString(cleaned.brandColors),
    brandDos: asString(cleaned.brandDos),
    brandDonts: asString(cleaned.brandDonts),
    brandReferenceImageUrls: asReferenceUrls(cleaned.brandReferenceImageUrls),
    brandLabelReferenceUrl: asString(cleaned.brandLabelReferenceUrl).trim(),
    ...(analyzedAt ? { brandAnalyzedAt: analyzedAt } : {}),
  };
}

export function mergeDashboardSettings(
  base: DashboardSettings,
  patch: Partial<DashboardSettings>,
): DashboardSettings {
  return sanitizeDashboardSettings(clampBrandSettingsFields({ ...base, ...patch }));
}
