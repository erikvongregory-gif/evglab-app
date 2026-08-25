export type StudioOnboardingTaskId = "brand" | "motif" | "plan" | "team";

/**
 * Nur kompakte Flags — landet in `user_metadata.dashboard.onboarding` und darf
 * das Auth-JWT nicht aufblähen.
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

export function sanitizeStudioOnboardingState(raw: unknown): StudioOnboardingState {
  const base = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    v: 1,
    welcome: base.welcome === true,
    checklistDismissed: base.checklistDismissed === true,
    celebrated: base.celebrated === true,
    hints: sanitizeHints(base.hints),
  };
}

export function mergeStudioOnboardingState(
  current: StudioOnboardingState,
  patch: Partial<StudioOnboardingState>,
): StudioOnboardingState {
  return sanitizeStudioOnboardingState({ ...current, ...patch });
}

export function requiredTasksDone(progress: StudioOnboardingProgress): number {
  return STUDIO_ONBOARDING_REQUIRED_TASKS.filter((id) => progress[id]).length;
}

export function isStudioOnboardingComplete(progress: StudioOnboardingProgress): boolean {
  return requiredTasksDone(progress) === STUDIO_ONBOARDING_REQUIRED_TASKS.length;
}
