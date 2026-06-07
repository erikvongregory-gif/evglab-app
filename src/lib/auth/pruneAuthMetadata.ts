import { getDashboardMetadata } from "@/lib/dashboard/metadata";

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

/**
 * Entfernt Legacy-Felder aus user_metadata, die JWT/Auth-Cookies zu groß machen.
 * Gibt neue Metadata zurück, wenn etwas geändert wurde — sonst null.
 */
export function pruneBloatedAuthMetadata(userMetadata: unknown): Record<string, unknown> | null {
  const base = asRecord(userMetadata);
  if (!base) return null;

  const dashboard = asRecord(base.dashboard);
  if (!dashboard) return null;

  let changed = false;
  const nextDashboard = { ...dashboard };

  if ("brandReferenceImages" in nextDashboard) {
    delete nextDashboard.brandReferenceImages;
    changed = true;
  }

  const media = nextDashboard.mediaLibrary;
  if (Array.isArray(media) && media.length > 12) {
    nextDashboard.mediaLibrary = media.slice(0, 12);
    changed = true;
  }

  if (!changed) return null;
  return { ...base, dashboard: nextDashboard };
}

/** Grobe Schätzung, ob Metadata die Session-Cookies sprengen könnte. */
export function authMetadataLikelyOversized(userMetadata: unknown): boolean {
  try {
    return JSON.stringify(userMetadata ?? {}).length > 12_000;
  } catch {
    return false;
  }
}

export function shouldPruneAuthMetadata(userMetadata: unknown): boolean {
  return authMetadataLikelyOversized(userMetadata) || pruneBloatedAuthMetadata(userMetadata) !== null;
}

export function buildPrunedAuthUserData(userMetadata: unknown): Record<string, unknown> | null {
  const pruned = pruneBloatedAuthMetadata(userMetadata);
  if (pruned) return pruned;
  if (!authMetadataLikelyOversized(userMetadata)) return null;
  const { dashboard: _dashboard, ...rest } = asRecord(userMetadata) ?? {};
  const slim = getDashboardMetadata(userMetadata);
  return {
    ...rest,
    dashboard: {
      settings: slim.settings,
      mediaLibrary: slim.mediaLibrary,
      teamMembers: slim.teamMembers,
    },
  };
}
