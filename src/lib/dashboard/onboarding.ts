export type StudioOnboardingTaskId = "brand" | "motif" | "plan" | "team";

export type OnboardingFlowStep = 1 | 2 | 3 | 4 | 5;

/** Aktuelle Product-Tour-Version — alte `completedAt` ohne diese Version zählen nicht. */
export const ONBOARDING_TOUR_VERSION = 1;

/** Dashboard-UI-Rundgang (Sidebar/Shell) — unabhängig vom Marken-Onboarding. */
export const UI_TOUR_VERSION = 1;

/**
 * Nur kompakte Flags — landet in `user_metadata.dashboard.onboarding` und darf
 * das Auth-JWT nicht aufblähen.
 *
 * v1: Welcome / Checklist / Hints
 * v2: Geführte Einrichtung per Product-Tour (`flowVersion`, `completedAt`, `tourVersion`)
 */
export type StudioOnboardingState = {
  v: 1;
  /** Willkommens-Dialog wurde gesehen oder weggeklickt. */
  welcome: boolean;
  /** Checkliste dauerhaft ausgeblendet. */
  checklistDismissed: boolean;
  /** Abschluss-Bestätigung wurde bereits gezeigt. */
  celebrated: boolean;
  /** IDs weggeklickter Kontext-Hinweise. */
  hints: string[];
  /** 2 = Product-Tour-Einrichtung. */
  flowVersion?: 2;
  /** Letzter erreichter / aktiver Schritt (Legacy). */
  currentStep?: OnboardingFlowStep;
  /** ISO — Flow abgeschlossen. */
  completedAt?: string;
  /** Abgeschlossene Tour-Version — fehlt bei Legacy-Abschlüssen. */
  tourVersion?: number;
  /** Abgeschlossener Dashboard-UI-Rundgang (nicht Markenprofil). */
  uiTourVersion?: number;
};

export type StudioOnboardingProgress = Record<StudioOnboardingTaskId, boolean>;

export const STUDIO_ONBOARDING_REQUIRED_TASKS: readonly StudioOnboardingTaskId[] = [
  "brand",
  "motif",
  "plan",
];

export const EMPTY_STUDIO_ONBOARDING_STATE: StudioOnboardingState = {
  v: 1,
  welcome: false,
  checklistDismissed: false,
  celebrated: false,
  hints: [],
};

const MAX_HINTS = 24;
const MAX_HINT_ID_LENGTH = 40;

function sanitizeHints(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (typeof entry !== "string") continue;
    const id = entry.trim().slice(0, MAX_HINT_ID_LENGTH);
    if (id) seen.add(id);
    if (seen.size >= MAX_HINTS) break;
  }
  return [...seen];
}

function sanitizeStep(raw: unknown): OnboardingFlowStep | undefined {
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (n === 1 || n === 2 || n === 3 || n === 4 || n === 5) return n;
  return undefined;
}

export function sanitizeStudioOnboardingState(raw: unknown): StudioOnboardingState {
  const base = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const completedAt =
    typeof base.completedAt === "string" && base.completedAt.trim()
      ? base.completedAt.trim().slice(0, 40)
      : undefined;
  const currentStep = sanitizeStep(base.currentStep);
  const tourVersion =
    typeof base.tourVersion === "number" && Number.isFinite(base.tourVersion)
      ? Math.max(0, Math.min(99, Math.floor(base.tourVersion)))
      : undefined;
  const uiTourVersion =
    typeof base.uiTourVersion === "number" && Number.isFinite(base.uiTourVersion)
      ? Math.max(0, Math.min(99, Math.floor(base.uiTourVersion)))
      : undefined;
  return {
    v: 1,
    welcome: base.welcome === true,
    checklistDismissed: base.checklistDismissed === true,
    celebrated: base.celebrated === true,
    hints: sanitizeHints(base.hints),
    ...(base.flowVersion === 2 ? { flowVersion: 2 as const } : {}),
    ...(currentStep ? { currentStep } : {}),
    ...(completedAt ? { completedAt } : {}),
    ...(tourVersion !== undefined ? { tourVersion } : {}),
    ...(uiTourVersion !== undefined ? { uiTourVersion } : {}),
  };
}

export function mergeStudioOnboardingState(
  current: StudioOnboardingState,
  patch: Partial<StudioOnboardingState> & {
    completedAt?: string | null;
    tourVersion?: number | null;
    uiTourVersion?: number | null;
  },
): StudioOnboardingState {
  const merged: Record<string, unknown> = { ...current, ...patch };
  // Restart: completedAt explizit löschen (spread behält sonst den alten Wert).
  if (patch.completedAt === null || patch.completedAt === "") {
    delete merged.completedAt;
  }
  if (patch.tourVersion === null || patch.tourVersion === 0) {
    delete merged.tourVersion;
  }
  if (patch.uiTourVersion === null || patch.uiTourVersion === 0) {
    delete merged.uiTourVersion;
  }
  if (patch.currentStep === undefined && "currentStep" in patch) {
    delete merged.currentStep;
  }
  return sanitizeStudioOnboardingState(merged);
}

export function requiredTasksDone(progress: StudioOnboardingProgress): number {
  return STUDIO_ONBOARDING_REQUIRED_TASKS.filter((id) => progress[id]).length;
}

export function isStudioOnboardingComplete(progress: StudioOnboardingProgress): boolean {
  return requiredTasksDone(progress) === STUDIO_ONBOARDING_REQUIRED_TASKS.length;
}

/** Legacy-Nutzer: Welcome/Checklist/Celebrate schon bedient (nur noch Checkliste/Hinweise). */
export function isLegacyOnboardingSettled(state: StudioOnboardingState): boolean {
  return state.welcome || state.checklistDismissed || state.celebrated;
}

/** Product-Tour abgeschlossen — alte Abschlüsse ohne `tourVersion` zählen nicht. */
export function isOnboardingTourComplete(state: StudioOnboardingState): boolean {
  return Boolean(state.completedAt) && (state.tourVersion ?? 0) >= ONBOARDING_TOUR_VERSION;
}

/** Dashboard-UI-Rundgang bereits gesehen (Finish oder Skip). */
export function isUiTourComplete(state: StudioOnboardingState): boolean {
  return (state.uiTourVersion ?? 0) >= UI_TOUR_VERSION;
}

/** @deprecated Nutze isOnboardingTourComplete */
export function isFlowV2Complete(state: StudioOnboardingState): boolean {
  return isOnboardingTourComplete(state);
}

/**
 * Einrichtung solange nötig, bis die aktuelle Product-Tour abgeschlossen ist.
 * Legacy-Flags (welcome/checklist) blockieren den Flow nicht mehr.
 */
export function needsFullOnboardingFlow(state: StudioOnboardingState): boolean {
  return !isOnboardingTourComplete(state);
}

/** Nach Login / bei Studio-Entry: Einrichtung vor Dashboard, kein Shell-Flash. */
export function resolveStudioEntryPath(
  state: StudioOnboardingState,
  preferredPath = "/dashboard",
): string {
  if (needsFullOnboardingFlow(state)) return "/onboarding";
  return preferredPath;
}

/** Alte Tour-Overlays nicht mehr automatisch zeigen (Product-Tour aktiv oder abgeschlossen). */
export function shouldSuppressLegacyOnboardingUi(state: StudioOnboardingState): boolean {
  return needsFullOnboardingFlow(state) || isOnboardingTourComplete(state);
}

export function resolveOnboardingStep(state: StudioOnboardingState): OnboardingFlowStep {
  return state.currentStep ?? 1;
}
