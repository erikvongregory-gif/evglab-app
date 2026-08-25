"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";

const PROMPT = "Produktfoto mit Hopfen und warmem Licht";

const PHASES = [
  { label: "Prompt", duration: 3.4 },
  { label: "Generierung", duration: 3 },
  { label: "Ergebnis", duration: 2.4 },
] as const;

const TOTAL = PHASES.reduce((sum, phase) => sum + phase.duration, 0);
const TICK_SECONDS = 0.05;

function Frame({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <div className="studio-onb-demo-frame" data-active={active ? "true" : "false"}>
      {children}
    </div>
  );
}

function PromptFrame({ chars }: { chars: number }) {
  const shown = PROMPT.slice(0, chars);
  const done = chars >= PROMPT.length;
  return (
    <div className="studio-onb-demo-pad">
      <div className="studio-field-label">Neues Motiv</div>
      <div className="studio-accent-serif studio-onb-demo-headline">Was soll generiert werden?</div>
      <div className="studio-onb-demo-chips">
        {["Produktfoto", "Kampagne", "Social"].map((chip, index) => (
          <span key={chip} className="studio-onb-demo-chip" data-on={index === 0 ? "true" : "false"}>
            {chip}
          </span>
        ))}
      </div>
      <div className="studio-onb-demo-input">
        {shown}
        {!done ? <span className="studio-onb-demo-caret">|</span> : null}
      </div>
      <div className="studio-onb-demo-cta" data-ready={done ? "true" : "false"}>
        {done ? "Motiv generieren" : "Stil & Prompt wählen …"}
      </div>
    </div>
  );
}

function GenerateFrame({ pct }: { pct: number }) {
  const steps = ["Motiv komponieren", "Farben abstimmen", "Stil verfeinern", "Letzter Schliff"];
  const step = steps[Math.min(Math.floor((pct / 100) * steps.length), steps.length - 1)];
  return (
    <div className="studio-onb-demo-center">
      <svg
        width="36"
        height="24"
        viewBox="0 0 40 26"
        fill="none"
        stroke="var(--acc)"
        strokeWidth="2.5"
        strokeLinecap="round"
        className="studio-onb-demo-wave"
        aria-hidden="true"
      >
        <path d="M3 8c4-2.5 7 2.5 11 0s7-2.5 11 0 7 2.5 11 0" />
        <path d="M3 16c4-2.5 7 2.5 11 0s7-2.5 11 0 7 2.5 11 0" />
      </svg>
      <div className="studio-onb-demo-headline-sm">Generieren läuft …</div>
      <div className="studio-mono studio-onb-demo-step">{step}</div>
      <div className="studio-onb-demo-bar">
        <div className="studio-onb-demo-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="studio-mono studio-onb-demo-step">{Math.round(pct)} %</div>
    </div>
  );
}

function ResultFrame() {
  return (
    <div className="studio-onb-demo-result">
      <div className="studio-onb-demo-thumb" aria-hidden="true" />
      <div style={{ minWidth: 0 }}>
        <span className="studio-badge ok">Fertig</span>
        <div className="studio-onb-demo-headline-sm" style={{ marginTop: 10 }}>
          Produktfoto mit Hopfen
        </div>
        <div className="studio-faint" style={{ fontSize: 12 }}>
          Produktfoto · gerade eben
        </div>
        <div className="studio-onb-demo-result-actions">
          <span className="studio-onb-demo-cta" data-ready="true">
            Exportieren
          </span>
          <span className="studio-onb-demo-cta">Mediathek</span>
        </div>
      </div>
    </div>
  );
}

export function StudioOnboardingDemo() {
  const reduceMotion = useReducedMotion();
  const [time, setTime] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const id = setInterval(() => {
      setTime((prev) => (prev >= TOTAL ? 0 : +(prev + TICK_SECONDS).toFixed(2)));
    }, TICK_SECONDS * 1000);
    return () => clearInterval(id);
  }, [reduceMotion]);

  let phase = PHASES.length - 1;
  let elapsed = time;
  for (let i = 0; i < PHASES.length; i += 1) {
    if (elapsed < PHASES[i].duration) {
      phase = i;
      break;
    }
    elapsed -= PHASES[i].duration;
  }
  if (reduceMotion) phase = PHASES.length - 1;

  const phasePct = reduceMotion ? 1 : Math.min(1, elapsed / PHASES[phase].duration);
  const chars = phase === 0 ? Math.floor(phasePct * PROMPT.length) : PROMPT.length;
  const generatePct = phase === 1 ? phasePct * 100 : phase > 1 ? 100 : 0;

  return (
    <div className="studio-onb-demo">
      <div className="studio-onb-demo-stage">
        <Frame active={phase === 0}>
          <PromptFrame chars={chars} />
        </Frame>
        <Frame active={phase === 1}>
          <GenerateFrame pct={generatePct} />
        </Frame>
        <Frame active={phase === 2}>
          <ResultFrame />
        </Frame>
      </div>
      <div className="studio-onb-demo-steps">
        {PHASES.map((entry, index) => (
          <span
            key={entry.label}
            className="studio-mono studio-onb-demo-steplabel"
            data-on={index <= phase ? "true" : "false"}
          >
            {entry.label}
          </span>
        ))}
      </div>
    </div>
  );
}
