"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { studioFontClassName } from "@/lib/fonts/studio-fonts";
import { useStudioOnboarding } from "@/components/studio/onboarding/onboarding-context";

const CELEBRATION_MS = 5_000;

function Dock({ children }: { children: ReactNode }) {
  return <div className={`evg-studio ${studioFontClassName} studio-onb-dock`}>{children}</div>;
}

function CheckIcon({ done }: { done: boolean }) {
  return (
    <span className="studio-onb-check" data-done={done ? "true" : "false"} aria-hidden="true">
      {done ? (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 8.5 L6.5 11.5 L12.5 4.5" />
        </svg>
      ) : null}
    </span>
  );
}

export function StudioOnboardingChecklist() {
  const onboarding = useStudioOnboarding();
  // Auf Handys startet die Checkliste eingeklappt — sie liegt dort über dem Inhalt.
  const [expanded, setExpanded] = useState(
    () => typeof window === "undefined" || !window.matchMedia("(max-width: 639px)").matches,
  );

  const celebrating = Boolean(onboarding?.complete) && !onboarding?.state.celebrated;
  const markCelebrated = onboarding?.markCelebrated;

  useEffect(() => {
    if (!celebrating || !markCelebrated) return;
    const timer = window.setTimeout(markCelebrated, CELEBRATION_MS);
    return () => window.clearTimeout(timer);
  }, [celebrating, markCelebrated]);

  if (!onboarding || !onboarding.ready) return null;
  if (onboarding.welcomeOpen || onboarding.state.checklistDismissed) return null;
  if (onboarding.complete && !celebrating) return null;

  if (celebrating) {
    return (
      <Dock>
        <aside className="studio-onb-widget studio-tour-sheet-in" aria-live="polite">
          <div className="studio-onb-dialog-accent" aria-hidden="true" />
          <div className="studio-onb-done">
            <CheckIcon done />
            <div>
              <div className="studio-onb-widget-title">Alles erledigt</div>
              <p className="studio-faint studio-onb-done-text">
                Du bist startklar. Die Checkliste blendet sich jetzt aus.
              </p>
            </div>
          </div>
        </aside>
      </Dock>
    );
  }

  const { tasks, doneCount, totalCount } = onboarding;
  const firstOpen = tasks.find((task) => !task.optional && !task.done);
  const pct = Math.round((doneCount / totalCount) * 100);

  return (
    <Dock>
      <aside
        className="studio-onb-widget studio-tour-sheet-in"
        data-expanded={expanded ? "true" : "false"}
        aria-label="Erste Schritte"
      >
        <div className="studio-onb-widget-head">
          <button
            type="button"
            className="studio-onb-widget-toggle"
            onClick={() => setExpanded((prev) => !prev)}
            aria-expanded={expanded}
          >
            <span className="studio-onb-widget-title">Erste Schritte</span>
            <span className="studio-mono studio-onb-widget-count">
              {doneCount}/{totalCount}
            </span>
            <svg
              className="studio-onb-widget-chevron"
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 6 L8 10 L12 6" />
            </svg>
          </button>
          <button
            type="button"
            className="studio-onb-widget-close"
            onClick={onboarding.dismissChecklist}
            aria-label="Checkliste ausblenden"
            title="Checkliste ausblenden"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M4 4 L12 12 M12 4 L4 12" />
            </svg>
          </button>
        </div>

        <div
          className="studio-onb-progress"
          role="progressbar"
          aria-label="Onboarding-Fortschritt"
          aria-valuemin={0}
          aria-valuemax={totalCount}
          aria-valuenow={doneCount}
        >
          <div className="studio-onb-progress-fill" style={{ width: `${pct}%` }} />
        </div>

        {expanded ? (
          <ul className="studio-onb-tasks">
            {tasks.map((task) => (
              <li key={task.id}>
                <Link
                  href={task.href}
                  scroll={false}
                  className="studio-onb-task"
                  data-done={task.done ? "true" : "false"}
                >
                  <CheckIcon done={task.done} />
                  <span className="studio-onb-task-body">
                    <span className="studio-onb-task-label">
                      {task.label}
                      {task.optional ? <span className="studio-onb-task-optional">Optional</span> : null}
                    </span>
                    {!task.done && task.id === firstOpen?.id ? (
                      <span className="studio-faint studio-onb-task-desc">{task.description}</span>
                    ) : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </aside>
    </Dock>
  );
}
