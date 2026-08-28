"use client";

import { motion } from "framer-motion";
import { ONBOARDING_STEPS, type OnboardingBootstrap } from "./onboarding-types";
import type { OnboardingFlowStep } from "@/lib/dashboard/onboarding";

const BrewMark = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={Math.round(size * 0.62)} viewBox="0 0 26 16" aria-hidden>
    <path
      d="M1 12C4 4 7 4 9 8C11 12 14 12 16 8C18 4 21 4 25 12"
      fill="none"
      stroke="var(--ac)"
      strokeWidth="2.4"
      strokeLinecap="round"
    />
  </svg>
);

export function OnboardingShell({
  step,
  maxReached,
  reducedMotion,
  profileName,
  onJump,
  children,
  footer,
}: {
  step: OnboardingFlowStep;
  maxReached: OnboardingFlowStep;
  reducedMotion: boolean;
  profileName: string;
  onJump: (s: OnboardingFlowStep) => void;
  children: React.ReactNode;
  footer: React.ReactNode | null;
}) {
  const meta = ONBOARDING_STEPS[step - 1]!;
  const pct = step / 5;

  return (
    <div className="evg-onb">
      <div className="evg-onb-shell">
        <aside className="evg-onb-rail" aria-label="Einrichtung">
          <div className="evg-onb-brand">
            <div className="evg-onb-brand-mark">
              <BrewMark />
            </div>
            <div>
              <div className="evg-onb-brand-name">BrewAI</div>
              <div className="evg-onb-brand-sub">STUDIO</div>
            </div>
          </div>

          <div>
            <div className="evg-onb-rail-label">EINRICHTUNG</div>
            <nav className="evg-onb-rail-steps">
              {ONBOARDING_STEPS.map((item) => {
                const active = item.id === step;
                const done = item.id < step;
                const reachable = item.id <= maxReached;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="evg-onb-rail-step"
                    data-active={active}
                    data-done={done}
                    disabled={!reachable}
                    onClick={() => reachable && onJump(item.id)}
                  >
                    {active ? (
                      <motion.span
                        className="evg-onb-rail-active"
                        layoutId={reducedMotion ? undefined : "onboarding-active-step"}
                        transition={
                          reducedMotion
                            ? { duration: 0 }
                            : { type: "spring", stiffness: 430, damping: 36, mass: 0.7 }
                        }
                      />
                    ) : null}
                    <span className="evg-onb-rail-dot" aria-hidden>
                      {done ? (
                        <svg width="11" height="11" viewBox="0 0 12 12">
                          <path
                            d="M2.5 6.2L4.8 8.5L9.5 3.6"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            fill="none"
                            strokeLinecap="round"
                          />
                        </svg>
                      ) : (
                        item.id
                      )}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="evg-onb-rail-step-title">{item.title}</span>
                      <span className="evg-onb-rail-step-sub">{item.sub}</span>
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="evg-onb-rail-foot">
            <div className="evg-onb-progress-track" aria-hidden>
              <div className="evg-onb-progress-fill" style={{ transform: `scaleX(${pct})` }} />
            </div>
            <div className="evg-onb-progress-label">SCHRITT {step} VON 5</div>
            <p className="evg-onb-rail-note">
              Alles später im Markenprofil änderbar. Die Einrichtung verbraucht keine Tokens.
            </p>
          </div>
        </aside>

        <div className="evg-onb-main">
          <div className="evg-onb-topbar">
            <div className="evg-onb-topbar-row">
              <div className="evg-onb-topbar-brand">
                <div className="evg-onb-brand-mark" style={{ width: 24, height: 24, borderRadius: 6 }}>
                  <BrewMark size={15} />
                </div>
                <span>Einrichtung{profileName ? ` · ${profileName}` : ""}</span>
              </div>
              <span className="evg-onb-progress-label">SCHRITT {step} VON 5</span>
            </div>
            <div className="evg-onb-progress-track" aria-hidden>
              <div className="evg-onb-progress-fill" style={{ transform: `scaleX(${pct})` }} />
            </div>
          </div>

          <div className="evg-onb-content">
            <div className="evg-onb-content-inner">
              <div className="evg-onb-kicker">{meta.kicker}</div>
              <h1 className="evg-onb-title" tabIndex={-1} id="onboarding-step-title">
                {step === 5 && profileName ? `Alles bereit, ${profileName}` : meta.headline}
              </h1>
              <p className="evg-onb-lead">{meta.lead}</p>
              <div className="evg-onb-rule" />
              {children}
            </div>
          </div>

          {footer}
        </div>
      </div>
      <div className="evg-onb-sr" aria-live="polite">
        Schritt {step} von 5 · {meta.title}
      </div>
    </div>
  );
}

export type { OnboardingBootstrap };
