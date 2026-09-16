"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { studioFontClassName } from "@/lib/fonts/studio-fonts";
import { useStudioOnboarding } from "@/components/studio/onboarding/onboarding-context";

const CELEBRATION_MS = 5_000;
const RING_R = 10.5;
const RING_C = 2 * Math.PI * RING_R;

function Dock({ children }: { children: ReactNode }) {
  return <div className={`evg-studio ${studioFontClassName} studio-onb-dock`}>{children}</div>;
}

function CheckIcon({ done }: { done: boolean }) {
  return (
    <span className="studio-onb-check" data-done={done ? "true" : "false"} aria-hidden="true">
      {done ? (
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <path
            d="M2.5 6.2l2.4 2.4 4.6-5.2"
            stroke="var(--ac-ink)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </span>
  );
}

function ProgressRing({ done, total }: { done: number; total: number }) {
  const frac = total > 0 ? done / total : 0;
  return (
    <div
      className="studio-onb-ring"
      role="progressbar"
      aria-label="Onboarding-Fortschritt"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
    >
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
        <circle cx="13" cy="13" r={RING_R} fill="none" stroke="var(--line2)" strokeWidth="2.4" />
        <circle
          className="studio-onb-ring-fill"
          cx="13"
          cy="13"
          r={RING_R}
          fill="none"
          stroke="var(--ac)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeDasharray={`${RING_C * frac} ${RING_C}`}
        />
      </svg>
      <span className="studio-onb-ring-count">{done}</span>
    </div>
  );
}

export function StudioOnboardingChecklist({
  placement = "dock",
}: {
  placement?: "dock" | "inline";
}) {
  const onboarding = useStudioOnboarding();
  // Auf Handys startet die Checkliste eingeklappt — sie liegt dort über dem Inhalt.
  const [expanded, setExpanded] = useState(
    () =>
      placement === "inline" ||
      typeof window === "undefined" ||
      !window
        .matchMedia(
          "(max-width: 767px), ((hover: none) and (pointer: coarse) and (max-width: 1023px))",
        )
        .matches,
  );

  const celebrating = Boolean(onboarding?.complete) && !onboarding?.state.celebrated;
  const markCelebrated = onboarding?.markCelebrated;

  useEffect(() => {
    if (!celebrating || !markCelebrated) return;
    const timer = window.setTimeout(markCelebrated, CELEBRATION_MS);
    return () => window.clearTimeout(timer);
  }, [celebrating, markCelebrated]);

  if (!onboarding || !onboarding.ready) return null;
  if (onboarding.suppressLegacyUi) return null;
  if (onboarding.welcomeOpen || onboarding.state.checklistDismissed) return null;
  if (onboarding.complete && !celebrating) return null;

  const widgetClass =
    placement === "inline" ? "studio-onb-widget studio-onb-widget--inline" : "studio-onb-widget";

  if (celebrating) {
    const done = (
      <aside className={widgetClass} aria-live="polite">
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
    );
    return placement === "inline" ? done : <Dock>{done}</Dock>;
  }

  const { tasks, doneCount, totalCount } = onboarding;
  const firstOpen = tasks.find((task) => !task.optional && !task.done);

  const body = (
    <aside
      className={widgetClass}
      data-expanded={expanded ? "true" : "false"}
      aria-label="Erste Schritte"
    >
      <div className="studio-onb-widget-head">
        <ProgressRing done={doneCount} total={totalCount} />
        <button
          type="button"
          className="studio-onb-widget-toggle"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
        >
          <span className="studio-onb-widget-title">Erste Schritte</span>
          <span className="evg-mono studio-onb-widget-count">
            {doneCount}/{totalCount}
          </span>
          <svg
            className="studio-onb-widget-chevron"
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M1.5 6.5l3.5-3 3.5 3"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          className="studio-onb-widget-close"
          onClick={onboarding.dismissChecklist}
          aria-label="Checkliste ausblenden"
          title="Checkliste ausblenden"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
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
  );

  return placement === "inline" ? body : <Dock>{body}</Dock>;
}
