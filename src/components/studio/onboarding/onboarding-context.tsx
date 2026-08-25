"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import {
  EMPTY_STUDIO_ONBOARDING_STATE,
  isStudioOnboardingComplete,
  requiredTasksDone,
  sanitizeStudioOnboardingState,
  STUDIO_ONBOARDING_REQUIRED_TASKS,
  type StudioOnboardingProgress,
  type StudioOnboardingState,
  type StudioOnboardingTaskId,
} from "@/lib/dashboard/onboarding";

const EMPTY_PROGRESS: StudioOnboardingProgress = {
  brand: false,
  motif: false,
  plan: false,
  team: false,
};

export type StudioOnboardingTask = {
  id: StudioOnboardingTaskId;
  label: string;
  description: string;
  href: string;
  done: boolean;
  optional: boolean;
};

type StudioOnboardingContextValue = {
  ready: boolean;
  state: StudioOnboardingState;
  progress: StudioOnboardingProgress;
  tasks: StudioOnboardingTask[];
  doneCount: number;
  totalCount: number;
  complete: boolean;
  welcomeOpen: boolean;
  closeWelcome: () => void;
  dismissChecklist: () => void;
  markCelebrated: () => void;
  /** Gesehene Tour-Schritte setzen — die Tour rechnet die Liste selbst aus. */
  setHints: (hintIds: string[]) => void;
  restart: () => void;
};

const StudioOnboardingContext = createContext<StudioOnboardingContextValue | null>(null);

export function useStudioOnboarding(): StudioOnboardingContextValue | null {
  return useContext(StudioOnboardingContext);
}

type OnboardingSnapshot = { state: StudioOnboardingState; progress: StudioOnboardingProgress };

async function loadOnboarding(): Promise<OnboardingSnapshot | null> {
  try {
    const res = await fetch("/api/dashboard/onboarding", {
      cache: "no-store",
      credentials: "include",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      state?: unknown;
      progress?: Partial<StudioOnboardingProgress>;
    };
    return {
      state: sanitizeStudioOnboardingState(json.state),
      progress: { ...EMPTY_PROGRESS, ...(json.progress ?? {}) },
    };
  } catch {
    return null;
  }
}

function buildTasks(progress: StudioOnboardingProgress): StudioOnboardingTask[] {
  return [
    {
      id: "brand",
      label: "Markenprofil anlegen",
      description: "Tonalität, Farben und Bildregeln — damit jedes Motiv nach dir aussieht.",
      href: "/dashboard?tab=brand&openBrand=1",
      done: progress.brand,
      optional: false,
    },
    {
      id: "motif",
      label: "Erstes Motiv erstellen",
      description: "Stil wählen, Prompt beantworten, generieren. Dauert keine zwei Minuten.",
      href: progress.plan ? "/inhalte-erstellen" : "/dashboard?tab=pricing",
      done: progress.motif,
      optional: false,
    },
    {
      id: "plan",
      label: "Tarif wählen",
      description: "Schaltet Generierungen frei und legt dein monatliches Token-Budget fest.",
      href: "/dashboard?tab=pricing",
      done: progress.plan,
      optional: false,
    },
    {
      id: "team",
      label: "Team einladen",
      description: "Hol Kolleginnen und Kollegen dazu — Rollen vergibst du später jederzeit.",
      href: "/dashboard?tab=team",
      done: progress.team,
      optional: true,
    },
  ];
}

export function StudioOnboardingProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<StudioOnboardingState>(EMPTY_STUDIO_ONBOARDING_STATE);
  const [progress, setProgress] = useState<StudioOnboardingProgress>(EMPTY_PROGRESS);

  useEffect(() => {
    let ignore = false;

    const apply = (snapshot: OnboardingSnapshot | null) => {
      if (ignore) return;
      if (snapshot) {
        setState(snapshot.state);
        setProgress(snapshot.progress);
      }
      setReady(true);
    };

    void loadOnboarding().then(apply);

    const onBillingUpdated = () => {
      void loadOnboarding().then(apply);
    };
    window.addEventListener("evglab-billing-updated", onBillingUpdated);

    return () => {
      ignore = true;
      window.removeEventListener("evglab-billing-updated", onBillingUpdated);
    };
  }, [pathname]);

  const patch = useCallback((changes: Partial<StudioOnboardingState>) => {
    setState((prev) => sanitizeStudioOnboardingState({ ...prev, ...changes }));
    void fetch("/api/dashboard/onboarding", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    }).catch(() => {
      /* Optimistisch — der nächste Abruf korrigiert */
    });
  }, []);

  const tasks = useMemo(() => buildTasks(progress), [progress]);

  const value = useMemo<StudioOnboardingContextValue>(
    () => ({
      ready,
      state,
      progress,
      tasks,
      doneCount: requiredTasksDone(progress),
      totalCount: STUDIO_ONBOARDING_REQUIRED_TASKS.length,
      complete: isStudioOnboardingComplete(progress),
      welcomeOpen: ready && !state.welcome,
      closeWelcome: () => patch({ welcome: true }),
      dismissChecklist: () => patch({ checklistDismissed: true }),
      markCelebrated: () => patch({ celebrated: true, checklistDismissed: true }),
      setHints: (hintIds: string[]) => {
        const next = [...new Set(hintIds)];
        const unchanged =
          next.length === state.hints.length && next.every((id) => state.hints.includes(id));
        if (unchanged) return;
        patch({ hints: next });
      },
      restart: () =>
        patch({ welcome: false, checklistDismissed: false, celebrated: false, hints: [] }),
    }),
    [ready, state, progress, tasks, patch],
  );

  return (
    <StudioOnboardingContext.Provider value={value}>{children}</StudioOnboardingContext.Provider>
  );
}
