export type StudioOnboardingTaskId = "brand" | "motif" | "plan" | "team";

export type OnboardingFlowStep = 1 | 2 | 3 | 4 | 5;

/**
 * Nur kompakte Flags — landet in `user_metadata.dashboard.onboarding` und darf
 * das Auth-JWT nicht aufblähen.
 *
 * v1: Welcome / Checklist / Hints
 * v2: Fullscreen-Flow (`flowVersion`, `currentStep`, `completedAt`)
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
  /** 2 = neuer Fullscreen-Flow. Fehlt → Legacy. */
  flowVersion?: 2;
  /** Letzter erreichter / aktiver Schritt (1–5). */
  currentStep?: OnboardingFlowStep;
  /** ISO — Flow abgeschlossen. */
  completedAt?: string;
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
  return {
    v: 1,
    welcome: base.welcome === true,
    checklistDismissed: base.checklistDismissed === true,
    celebrated: base.celebrated === true,
    hints: sanitizeHints(base.hints),
    ...(base.flowVersion === 2 ? { flowVersion: 2 as const } : {}),
    ...(currentStep ? { currentStep } : {}),
    ...(completedAt ? { completedAt } : {}),
  };
}

export function mergeStudioOnboardingState(
  current: StudioOnboardingState,
  patch: Partial<StudioOnboardingState> & { completedAt?: string | null },
): StudioOnboardingState {
  const merged: Record<string, unknown> = { ...current, ...patch };
  // Restart: completedAt explizit löschen (spread behält sonst den alten Wert).
  if (patch.completedAt === null || patch.completedAt === "") {
    delete merged.completedAt;
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

/** Legacy-Nutzer: Welcome/Checklist/Celebrate schon bedient → kein Zwangs-v2-Flow. */
export function isLegacyOnboardingSettled(state: StudioOnboardingState): boolean {
  return state.welcome || state.checklistDismissed || state.celebrated;
}

export function isFlowV2Complete(state: StudioOnboardingState): boolean {
  return Boolean(state.completedAt);
}

/**
 * Neue Nutzer ohne Legacy-Flags und ohne completedAt müssen den Fullscreen-Flow
 * durchlaufen. Restart setzt Flags zurück und setzt flowVersion=2.
 */
export function needsFullOnboardingFlow(state: StudioOnboardingState): boolean {
  if (isFlowV2Complete(state)) return false;
  if (state.flowVersion === 2) return true;
  if (isLegacyOnboardingSettled(state)) return false;
  return true;
}

/** Alte Tour-Overlays nicht mehr automatisch zeigen (v2 aktiv oder abgeschlossen). */
export function shouldSuppressLegacyOnboardingUi(state: StudioOnboardingState): boolean {
  return state.flowVersion === 2 || isFlowV2Complete(state) || needsFullOnboardingFlow(state);
}

export function resolveOnboardingStep(state: StudioOnboardingState): OnboardingFlowStep {
  return state.currentStep ?? 1;
}
