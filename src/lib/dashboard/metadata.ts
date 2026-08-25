import { sanitizeStudioOnboardingState, type StudioOnboardingState } from "@/lib/dashboard/onboarding";

export type DashboardMediaItem = {
  id: string;
  imageUrl: string;
  /** Nutzerdefinierter Motiv-Titel (z. B. „Hefeweizen · Hero-Glas · Public Viewing“). */
  title?: string;
  prompt: string;
  createdAt: string;
  aspectRatio: string;
  resolution: "1K" | "2K" | "4K";
  outputFormat: "png" | "jpg";
};

export function getMediaDisplayTitle(item: Pick<DashboardMediaItem, "title" | "prompt">): string {
  const custom = item.title?.trim();
  if (custom) return custom;
  const fallback = item.prompt?.trim();
  return fallback || "Unbenanntes Motiv";
}

/**
 * Ein Bier aus dem Sortiment der Brauerei ("Meine Biere") — einmal angelegt,
 * belegt es im Erstell-Flow Bierstil, Flasche, Farbe und Etikett per Klick vor.
 */
export type DashboardBeer = {
  id: string;
  name: string;
  /** Bierstil-Code, z. B. "helles", "pils" (siehe WAS_OPTIONS im Erstell-Flow). */
  bierstil: string;
  /** Flaschentyp-Code, z. B. "nrw_500" (siehe FLASCHEN_TYPEN). */
  flaschenTyp: string;
  flaschenfarbe: "braun" | "gruen" | "klar";
  /** HTTPS-URL des Sorten-Etiketts (nie Base64 — JWT/Cookie-Limit). */
  etikettUrl: string;
  createdAt: string;
};

export const MAX_MY_BEERS = 8;

/** KIE-Temp-URLs sind oft tot oder vom Server nicht ladbar — Etikett dann neu hochladen. */
export function hasUsableBeerEtikett(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    return !host.includes("redpandaai.co") && !host.includes("tempfile.");
  } catch {
    return false;
  }
}

export function sanitizeDashboardBeers(value: unknown): DashboardBeer[] {
  if (!Array.isArray(value)) return [];
  const out: DashboardBeer[] = [];
  for (const raw of value) {
    const item = asObj(raw);
    const id = typeof item.id === "string" ? item.id.trim().slice(0, 64) : "";
    const name = typeof item.name === "string" ? item.name.trim().slice(0, 80) : "";
    if (!id || !name) continue;
    out.push({
      id,
      name,
      bierstil: typeof item.bierstil === "string" && item.bierstil.trim() ? item.bierstil.trim().slice(0, 60) : "helles",
      flaschenTyp:
        typeof item.flaschenTyp === "string" && item.flaschenTyp.trim() ? item.flaschenTyp.trim().slice(0, 60) : "nrw_500",
      flaschenfarbe:
        item.flaschenfarbe === "gruen" || item.flaschenfarbe === "klar" ? item.flaschenfarbe : "braun",
      etikettUrl: typeof item.etikettUrl === "string" ? item.etikettUrl.trim().slice(0, 1200) : "",
      createdAt: typeof item.createdAt === "string" ? item.createdAt.slice(0, 40) : "",
    });
    if (out.length >= MAX_MY_BEERS) break;
  }
  return out;
}

export type DashboardTeamRole = "owner" | "admin" | "editor" | "viewer";

export type DashboardTeamMember = {
  id: string;
  email: string;
  name: string;
  role: DashboardTeamRole;
  status: "active" | "invited";
  invitedAt: string;
};

export type DashboardSettings = {
  profileName: string;
  breweryName: string;
  profilePhone: string;
  emailNotifications: boolean;
  weeklySummary: boolean;
  brandProfileMode: "undecided" | "guided" | "skip";
  brandInstagramUrl: string;
  brandWebsiteUrl: string;
  brandProfileSource: "url" | "instagram" | "manual" | "skip";
  brandLockLevel: "strict" | "balanced" | "loose";
  brandTone: string;
  brandColors: string;
  brandDos: string;
  brandDonts: string;
  brandReferenceImageUrls: string[];
  /** Bester Packshot (Etikett-Traeger) aus der Analyse — fuer Etikett-Treue bei der Generierung. */
  brandLabelReferenceUrl: string;
  /** ISO-Zeitstempel der letzten Website-/Marken-Analyse */
  brandAnalyzedAt?: string;
};

export type DashboardMetadata = {
  mediaLibrary?: DashboardMediaItem[];
  teamMembers?: DashboardTeamMember[];
  settings?: DashboardSettings;
  onboarding?: StudioOnboardingState;
  myBeers?: DashboardBeer[];
};

function asObj(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

export function getDashboardMetadata(userMetadata: unknown): DashboardMetadata {
  const base = asObj(userMetadata);
  const dashboard = asObj(base.dashboard);
  const rawMedia = Array.isArray(dashboard.mediaLibrary)
    ? (dashboard.mediaLibrary as DashboardMediaItem[])
    : [];
  const mediaLibrary = rawMedia
    .map((item) => {
      const prompt = String(item.prompt ?? "").slice(0, 240);
      const titleRaw = String(item.title ?? "").trim().slice(0, 120);
      return {
        ...item,
        prompt,
        title: titleRaw || undefined,
        imageUrl: String(item.imageUrl ?? "").slice(0, 1200),
      };
    })
    .slice(0, 12);

  const rawTeam = Array.isArray(dashboard.teamMembers)
    ? (dashboard.teamMembers as DashboardTeamMember[])
    : [];
  const teamMembers = rawTeam.slice(0, 20);

  return {
    mediaLibrary,
    teamMembers,
    settings: asObj(dashboard.settings) as DashboardSettings,
    onboarding: sanitizeStudioOnboardingState(dashboard.onboarding),
    myBeers: sanitizeDashboardBeers(dashboard.myBeers),
  };
}

export function mergeDashboardMetadata(
  userMetadata: unknown,
  patch: Partial<DashboardMetadata>,
): Record<string, unknown> {
  const base = asObj(userMetadata);
  const dashboard = asObj(base.dashboard);
  return {
    ...base,
    dashboard: {
      ...dashboard,
      ...patch,
    },
  };
}
