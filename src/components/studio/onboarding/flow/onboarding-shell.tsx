"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ONBOARDING_STEPS, type OnboardingBootstrap } from "./onboarding-types";
import type { OnboardingFlowStep } from "@/lib/dashboard/onboarding";

const EASE = [0.2, 0.7, 0.2, 1] as const;

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

function staggerItem(reducedMotion: boolean, delayMs: number) {
  if (reducedMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { duration: 0.08 } },
    };
  }
  return {
    initial: { opacity: 0, y: 6 },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        delay: delayMs / 1000,
        duration: 0.22,
        ease: EASE,
      },
    },
  };
}

export function OnboardingShell({
  step,
  direction,
  maxReached,
  reducedMotion,
  profileName,
  onJump,
  children,
  footer,
}: {
  step: OnboardingFlowStep;
  direction: 1 | -1;
  maxReached: OnboardingFlowStep;
  reducedMotion: boolean;
  profileName: string;
  onJump: (s: OnboardingFlowStep) => void;
  children: React.ReactNode;
  footer: React.ReactNode | null;
}) {
  const meta = ONBOARDING_STEPS[step - 1]!;
  const pct = step / 5;

  const stepVariants = {
    enter: (dir: number) =>
      reducedMotion
        ? { opacity: 0 }
        : { x: dir > 0 ? 14 : -14, y: dir > 0 ? 4 : 0 },
    center: { opacity: 1, x: 0, y: 0 },
    exit: (dir: number) =>
      reducedMotion
        ? { opacity: 0 }
        : { opacity: 0, x: dir > 0 ? -10 : 10 },
  };

  return (
    <div className="evg-onb">
      <div className="evg-onb-shell">
        <motion.aside
          className="evg-onb-rail"
          aria-label="Einrichtung"
          initial={reducedMotion ? false : { opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={
            reducedMotion
              ? { duration: 0 }
              : { duration: 0.28, ease: EASE }
          }
        >
          <motion.div
            className="evg-onb-brand"
            {...staggerItem(reducedMotion, 0)}
          >
            <div className="evg-onb-brand-mark">
              <BrewMark />
            </div>
            <div>
              <div className="evg-onb-brand-name">BrewAI</div>
              <div className="evg-onb-brand-sub">STUDIO</div>
            </div>
          </motion.div>

          <div>
            <motion.div className="evg-onb-rail-label" {...staggerItem(reducedMotion, 40)}>
              EINRICHTUNG
            </motion.div>
            <nav className="evg-onb-rail-steps">
              {ONBOARDING_STEPS.map((item, index) => {
                const active = item.id === step;
                const done = item.id < step;
                const reachable = item.id <= maxReached;
                return (
                  <motion.button
                    key={item.id}
                    type="button"
                    className="evg-onb-rail-step"
                    data-active={active}
                    data-done={done}
                    disabled={!reachable}
                    onClick={() => reachable && onJump(item.id)}
                    {...staggerItem(reducedMotion, 70 + index * 35)}
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
                  </motion.button>
                );
              })}
            </nav>
          </div>

          <motion.div className="evg-onb-rail-foot" {...staggerItem(reducedMotion, 260)}>
            <div className="evg-onb-progress-track" aria-hidden>
              <div className="evg-onb-progress-fill" style={{ transform: `scaleX(${pct})` }} />
            </div>
            <div className="evg-onb-progress-label">SCHRITT {step} VON 5</div>
            <p className="evg-onb-rail-note">
              Alles später im Markenprofil änderbar. Die Einrichtung verbraucht keine Tokens.
            </p>
          </motion.div>
        </motion.aside>

        <div className="evg-onb-main">
          <motion.div
            className="evg-onb-topbar"
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: reducedMotion ? 0 : 0.08, duration: reducedMotion ? 0 : 0.2 }}
          >
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
          </motion.div>

          <div className="evg-onb-content">
            <div className="evg-onb-content-inner">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={`step-${step}`}
                  custom={direction}
                  variants={stepVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{
                    duration: reducedMotion ? 0.08 : direction > 0 ? 0.24 : 0.22,
                    ease: EASE,
                  }}
                >
                  {/* Spec §42: Eyebrow 0 → Headline 30 → Description 55 → Panel 85 → Secondary 115 */}
                  <motion.div className="evg-onb-kicker" {...staggerItem(reducedMotion, 0)}>
                    {meta.kicker}
                  </motion.div>
                  <motion.h1
                    className="evg-onb-title"
                    tabIndex={-1}
                    id="onboarding-step-title"
                    {...staggerItem(reducedMotion, 30)}
                  >
                    {step === 5 && profileName ? `Alles bereit, ${profileName}` : meta.headline}
                  </motion.h1>
                  <motion.p className="evg-onb-lead" {...staggerItem(reducedMotion, 55)}>
                    {meta.lead}
                  </motion.p>
                  <motion.div className="evg-onb-rule" aria-hidden {...staggerItem(reducedMotion, 70)} />
                  <motion.div {...staggerItem(reducedMotion, 85)}>{children}</motion.div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {footer ? (
            <motion.div
              initial={reducedMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: reducedMotion ? 0 : 0.12,
                duration: reducedMotion ? 0 : 0.22,
                ease: EASE,
              }}
            >
              {footer}
            </motion.div>
          ) : null}
        </div>
      </div>
      <div className="evg-onb-sr" aria-live="polite">
        Schritt {step} von 5 · {meta.title}
      </div>
    </div>
  );
}

export type { OnboardingBootstrap };
