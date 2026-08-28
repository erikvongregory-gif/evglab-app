"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { StudioButton } from "@/components/studio/ui";
import { studioFontClassName } from "@/lib/fonts/studio-fonts";
import { useStudioOnboarding } from "@/components/studio/onboarding/onboarding-context";

type TourPlacement = "right" | "bottom" | "bottom-left" | "top";

type TourStep = {
  id: string;
  selector: string;
  title: string;
  body: string;
  placement: TourPlacement;
};

/**
 * Geführte Tour pro Bereich. Jeder Bereich läuft einmal durch; gesehene Schritte
 * liegen als IDs in `state.hints`, damit die Tour nach einem Reload dort
 * weitergeht, wo sie war.
 */
const TOURS: Record<string, TourStep[]> = {
  dashboard: [
    {
      id: "dash-nav",
      selector: '[data-tour="nav"]',
      title: "Alles liegt links",
      body: "Bilder und Videos erstellen, Mediathek, Markenprofil, Team. Die Reihenfolge entspricht dem üblichen Arbeitsweg.",
      placement: "right",
    },
    {
      id: "dash-create",
      selector: '[data-tour="create"]',
      title: "Dein wichtigster Knopf",
      body: "Von hier startest du jede Generierung — Stil wählen, Fragen beantworten, fertig.",
      placement: "bottom-left",
    },
    {
      id: "dash-tokens",
      selector: '[data-tour="tokens"]',
      title: "Dein Token-Budget",
      body: "Tokens sind dein monatliches KI-Guthaben. Jede Generierung zeigt dir vorher, was sie kostet.",
      placement: "bottom-left",
    },
    {
      id: "dash-search",
      selector: '[data-tour="search"]',
      title: "Schnellsuche",
      body: "Motive und Bereiche blitzschnell finden — oder drück ⌘K von überall.",
      placement: "bottom",
    },
  ],
  create: [
    {
      id: "create-prompt",
      selector: '[data-tour="prompt"]',
      title: "Der Prompt baut sich mit",
      body: "Jede Antwort landet oben im Prompt. Klick auf einen Baustein, um ihn zu ändern.",
      placement: "bottom",
    },
    {
      id: "create-generate",
      selector: '[data-tour="generate"]',
      title: "Weiter bis zur Generierung",
      body: "Am Ende siehst du eine kurze Zusammenfassung samt Token-Kosten, bevor es losgeht.",
      placement: "top",
    },
  ],
  media: [
    {
      id: "media-grid",
      selector: ".evg-grid",
      title: "Deine Mediathek",
      body: "Jedes Motiv landet hier. Klick es an, um es umzubenennen oder herunterzuladen.",
      placement: "top",
    },
  ],
};

const SPOT_PAD = 10;
const GAP = 16;
const CARD_W = 320;
const SETTLE_MS = 800;
const PROBE_MS = 600;

type SpotRect = { x: number; y: number; w: number; h: number };

function sameRect(a: SpotRect, b: SpotRect) {
  return (
    Math.round(a.x) === Math.round(b.x) &&
    Math.round(a.y) === Math.round(b.y) &&
    Math.round(a.w) === Math.round(b.w) &&
    Math.round(a.h) === Math.round(b.h)
  );
}

function measure(selector: string): SpotRect | null {
  if (typeof document === "undefined") return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width < 4 || rect.height < 4) return null;
  return { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
}

function scrollIntoView(selector: string) {
  const el = document.querySelector(selector);
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const offscreen = rect.top < 72 || rect.bottom > window.innerHeight - 72;
  if (offscreen) el.scrollIntoView({ behavior: "smooth", block: "center" });
}

function cardPosition(rect: SpotRect, placement: TourPlacement): CSSProperties {
  const base: CSSProperties = { position: "fixed", width: CARD_W, zIndex: 1002 };
  if (placement === "right") {
    return { ...base, left: rect.x + rect.w + SPOT_PAD + GAP, top: Math.max(16, rect.y - 8) };
  }
  if (placement === "top") {
    const cx = rect.x + rect.w / 2;
    return {
      ...base,
      left: Math.max(16, Math.min(cx - CARD_W / 2, window.innerWidth - CARD_W - 16)),
      top: Math.max(16, rect.y - SPOT_PAD - GAP),
      transform: "translateY(-100%)",
    };
  }
  if (placement === "bottom-left") {
    return {
      ...base,
      left: Math.max(16, rect.x + rect.w - CARD_W),
      top: rect.y + rect.h + SPOT_PAD + GAP,
    };
  }
  const cx = rect.x + rect.w / 2;
  return {
    ...base,
    left: Math.max(16, Math.min(cx - CARD_W / 2, window.innerWidth - CARD_W - 16)),
    top: rect.y + rect.h + SPOT_PAD + GAP,
  };
}

export function StudioOnboardingHints({ area }: { area: string }) {
  const onboarding = useStudioOnboarding();
  const [spot, setSpot] = useState<{ id: string; rect: SpotRect } | null>(null);
  const [settledArea, setSettledArea] = useState<string | null>(null);

  const steps = useMemo(() => TOURS[area] ?? [], [area]);
  const hints = onboarding?.state.hints;
  const seen = useMemo(() => hints ?? [], [hints]);
  const active =
    Boolean(onboarding?.ready) &&
    !onboarding?.suppressLegacyUi &&
    !onboarding?.welcomeOpen &&
    settledArea === area;

  const stepIndex = spot ? steps.findIndex((entry) => entry.id === spot.id) : -1;
  const step = stepIndex >= 0 ? steps[stepIndex] : undefined;
  const setHints = onboarding?.setHints;

  useEffect(() => {
    const timer = window.setTimeout(() => setSettledArea(area), SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [area]);

  // Anker werden wiederholt geprüft, nicht nur einmal: manche entstehen erst
  // später (Prompt-Panel im Wizard) oder fehlen dauerhaft (Desktop-Suche auf
  // Mobile). Fehlende Anker überspringen wir still, ohne die Tour zu blockieren.
  useEffect(() => {
    if (!active || steps.length === 0) return;
    const evaluate = () => {
      for (const entry of steps) {
        if (seen.includes(entry.id)) continue;
        const rect = measure(entry.selector);
        if (!rect) continue;
        setSpot((prev) => (prev && prev.id === entry.id && sameRect(prev.rect, rect) ? prev : { id: entry.id, rect }));
        return;
      }
      setSpot((prev) => (prev === null ? prev : null));
    };
    const frame = window.requestAnimationFrame(evaluate);
    const probe = window.setInterval(evaluate, PROBE_MS);
    window.addEventListener("resize", evaluate);
    window.addEventListener("scroll", evaluate, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(probe);
      window.removeEventListener("resize", evaluate);
      window.removeEventListener("scroll", evaluate, true);
    };
  }, [active, steps, seen]);

  const scrolledFor = useRef<string | null>(null);
  useEffect(() => {
    if (!step || scrolledFor.current === step.id) return;
    scrolledFor.current = step.id;
    scrollIntoView(step.selector);
  }, [step]);

  const goNext = useCallback(() => {
    if (!step || !setHints) return;
    setHints([...seen, step.id]);
  }, [step, setHints, seen]);

  const goBack = useCallback(() => {
    if (stepIndex <= 0 || !setHints) return;
    const previous = steps[stepIndex - 1].id;
    setHints(seen.filter((id) => id !== previous));
  }, [stepIndex, steps, setHints, seen]);

  const endTour = useCallback(() => {
    if (!setHints) return;
    setHints([...seen, ...steps.map((entry) => entry.id)]);
  }, [setHints, seen, steps]);

  // Kein Autofokus und kein globales Enter: die Tour kann mitten im Tippen
  // erscheinen und darf Eingaben nicht abfangen.
  useEffect(() => {
    if (!step) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName ?? "")) {
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        endTour();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        goBack();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [step, goNext, goBack, endTour]);

  if (!onboarding || !step || !spot) return null;

  const rect = spot.rect;
  const isLast = stepIndex === steps.length - 1;

  return createPortal(
    <div className={`evg-studio ${studioFontClassName} studio-onb-hint-layer`}>
      <div
        className="studio-onb-spot"
        style={{
          left: rect.x - SPOT_PAD,
          top: rect.y - SPOT_PAD,
          width: rect.w + SPOT_PAD * 2,
          height: rect.h + SPOT_PAD * 2,
        }}
        aria-hidden="true"
      />
      <div
        className="evg-dialog studio-onb-hint"
        style={cardPosition(rect, step.placement)}
        role="dialog"
        aria-modal="false"
        aria-label={`${step.title} — Schritt ${stepIndex + 1} von ${steps.length}`}
      >
        <div className="studio-onb-hint-body">
          <div className="studio-onb-hint-title">{step.title}</div>
          <p className="studio-faint studio-onb-hint-text">{step.body}</p>
          <div className="studio-onb-tour-foot">
            <div className="studio-onb-tour-dots" aria-hidden="true">
              {steps.map((entry, index) => (
                <span
                  key={entry.id}
                  className="studio-onb-tour-dot"
                  data-state={index === stepIndex ? "current" : index < stepIndex ? "done" : "todo"}
                />
              ))}
            </div>
            <span className="evg-mono studio-onb-tour-count">
              {stepIndex + 1}/{steps.length}
            </span>
          </div>
          <div className="studio-onb-hint-actions">
            <button type="button" className="studio-onb-tour-skip" onClick={endTour}>
              Tour beenden
            </button>
            <div className="studio-onb-tour-nav">
              {stepIndex > 0 ? (
                <StudioButton variant="ghost" size="sm" onClick={goBack}>
                  Zurück
                </StudioButton>
              ) : null}
              <StudioButton variant="primary" size="sm" onClick={goNext}>
                {isLast ? "Fertig" : "Weiter"}
              </StudioButton>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
