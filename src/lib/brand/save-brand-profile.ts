import { createAdminClient } from "@/lib/supabase/admin";
import { buildPrunedAuthUserData, pruneBloatedAuthMetadata } from "@/lib/auth/pruneAuthMetadata";
import {
  clampBrandSettingsFields,
  sanitizeDashboardSettings,
} from "@/lib/dashboard/settingsPayload";
import { getDashboardMetadata, mergeDashboardMetadata, type DashboardSettings } from "@/lib/dashboard/metadata";
import { storeBrandReferenceImagesAsUrls } from "@/lib/brand/persist-reference-urls";
import { parseBrandReferenceIdFromUrl, repairBrandReferenceImageUrls } from "@/lib/brand/reference-image-store";
import { normalizeWebsiteUrl } from "@/lib/brand/url-intake";

export type BrandReferencePayload = {
  base64: string;
  mime: "image/jpeg" | "image/png" | "image/webp";
};

export type SaveBrandProfileInput = {
  breweryName: string;
  brandTone: string;
  brandColors: string;
  brandDos: string;
  brandDonts: string;
  brandInstagramUrl?: string;
  brandWebsiteUrl?: string;
  brandProfileSource: "url" | "instagram" | "manual";
  brandReferenceImageUrls?: string[];
  /** Bester Packshot (Etikett-Traeger) aus der Analyse — Quelle fuer Etikett-Treue. */
  brandLabelReferenceUrl?: string;
  referenceImagePayloads?: BrandReferencePayload[];
};

function filterHttpUrls(urls: string[] | undefined): string[] {
  if (!urls?.length) return [];
  const out: string[] = [];
  for (const raw of urls) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
      out.push(parsed.toString());
      if (out.length >= 10) break;
    } catch {
      /* skip */
    }
  }
  return out;
}

function normalizeOptionalUrl(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "";
  return normalizeWebsiteUrl(trimmed) ?? "";
}

function normalizeHttpUrlOrEmpty(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : "";
  } catch {
    return "";
  }
}

export async function resolveBrandReferenceImageUrls(input: {
  referenceImageUrls?: string[];
  referenceImagePayloads?: BrandReferencePayload[];
}): Promise<string[]> {
  const existing = filterHttpUrls(input.referenceImageUrls);
  if (existing.length > 0) return existing.slice(0, 5);

  if (!input.referenceImagePayloads?.length) return [];

  const uploaded = await storeBrandReferenceImagesAsUrls(
    input.referenceImagePayloads.map((image) => ({
      base64: image.base64,
      mime: image.mime,
    })),
  );
  return uploaded.slice(0, 5);
}

export async function loadLatestUserMetadata(userId: string, fallback: unknown): Promise<unknown> {
  void userId;
  return prepareMetadataForSave(fallback);
}

export function prepareMetadataForSave(userMetadata: unknown): unknown {
  const pruned = buildPrunedAuthUserData(userMetadata);
  if (pruned) return pruned;
  const partial = pruneBloatedAuthMetadata(userMetadata);
  if (partial) return partial;
  return userMetadata;
}

export function buildActivatedBrandSettings(params: {
  latestMetadata: unknown;
  origin: string;
  input: SaveBrandProfileInput;
  referenceImageUrls: string[];
  analyzedAt?: string;
}): DashboardSettings {
  const existing = sanitizeDashboardSettings(getDashboardMetadata(params.latestMetadata).settings);
  const mergedInput = clampBrandSettingsFields({
    ...existing,
    brandProfileMode: "guided",
    breweryName: params.input.breweryName,
    brandTone: params.input.brandTone,
    brandColors: params.input.brandColors,
    brandDos: params.input.brandDos,
    brandDonts: params.input.brandDonts,
    brandInstagramUrl: normalizeOptionalUrl(params.input.brandInstagramUrl),
    brandWebsiteUrl: normalizeOptionalUrl(params.input.brandWebsiteUrl),
    brandProfileSource: params.input.brandProfileSource,
    brandReferenceImageUrls: params.referenceImageUrls,
    brandLabelReferenceUrl: normalizeHttpUrlOrEmpty(params.input.brandLabelReferenceUrl),
    brandAnalyzedAt: params.analyzedAt ?? existing.brandAnalyzedAt ?? new Date().toISOString(),
  });

  const sanitized = sanitizeDashboardSettings(mergedInput);
  const repairedRefs = repairBrandReferenceImageUrls(
    params.latestMetadata,
    params.origin,
    sanitized.brandReferenceImageUrls,
  );

  return {
    ...sanitized,
    brandReferenceImageUrls: repairedRefs.urls,
  };
}

export function buildUserMetadataForBrandSave(params: {
  latestMetadata: unknown;
  settings: DashboardSettings;
}): Record<string, unknown> {
  const merged = mergeDashboardMetadata(params.latestMetadata, { settings: params.settings });
  const dashboard = (merged as { dashboard?: Record<string, unknown> }).dashboard;
  const keepsInternalReferenceStore = params.settings.brandReferenceImageUrls.some(
    (url) => parseBrandReferenceIdFromUrl(url) !== null,
  );

  if (dashboard && typeof dashboard === "object" && !keepsInternalReferenceStore && "brandReferenceImages" in dashboard) {
    delete dashboard.brandReferenceImages;
  }

  return {
    ...merged,
    brewery: params.settings.breweryName || null,
  };
}

export async function persistBrandProfileForUser(params: {
  userId: string;
  latestMetadata: unknown;
  origin: string;
  input: SaveBrandProfileInput;
  referenceImageUrls: string[];
}): Promise<{ settings: DashboardSettings; referenceImageUrls: string[] }> {
  const settings = buildActivatedBrandSettings({
    latestMetadata: params.latestMetadata,
    origin: params.origin,
    input: params.input,
    referenceImageUrls: params.referenceImageUrls,
  });

  const admin = createAdminClient();
  let userMetadata = buildUserMetadataForBrandSave({
    latestMetadata: params.latestMetadata,
    settings,
  });

  let { error } = await admin.auth.admin.updateUserById(params.userId, {
    user_metadata: userMetadata,
  });

  if (error) {
    const prunedBase = buildPrunedAuthUserData(params.latestMetadata);
    if (prunedBase) {
      userMetadata = buildUserMetadataForBrandSave({
        latestMetadata: prunedBase,
        settings,
      });
      ({ error } = await admin.auth.admin.updateUserById(params.userId, {
        user_metadata: userMetadata,
      }));
    }
  }

  if (error) {
    throw new Error(error.message || "Markenprofil konnte nicht gespeichert werden.");
  }

  return {
    settings,
    referenceImageUrls: settings.brandReferenceImageUrls,
  };
}
