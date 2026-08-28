"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

export function OnboardingCompleteStep({
  profileName,
  breweryName,
  brandReady,
  beerCount,
  teamCount,
  tokens,
  hasActivePlan,
  finishing,
  completed,
  bonusError,
  onRetryBonus,
  onCreate,
  onDashboard,
}: {
  profileName: string;
  breweryName: string;
  brandReady: boolean;
  beerCount: number;
  teamCount: number;
  tokens: number | null;
  hasActivePlan: boolean;
  finishing: boolean;
  completed: boolean;
  bonusError: string;
  onRetryBonus: () => void;
  onCreate: () => void;
  onDashboard: () => void;
}) {
  const reduced = useReducedMotion();
  const [displayTokens, setDisplayTokens] = useState<number | null>(null);

  useEffect(() => {
    if (tokens == null || !completed || reduced) return;
    const start = performance.now();
    const duration = 520;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayTokens(Math.round(tokens * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [tokens, reduced, completed]);

  const shown = !completed || reduced || tokens == null ? tokens : (displayTokens ?? tokens);

  const rows = [
    { label: "BRAUEREI", value: breweryName || "—" },
    { label: "MARKE", value: brandReady ? "Markenprofil aktiv" : "Noch offen" },
    { label: "SORTIMENT", value: beerCount > 0 ? `${beerCount} Sorte${beerCount === 1 ? "" : "n"}` : "Noch leer" },
    {
      label: "TEAM",
      value: teamCount > 0 ? `${teamCount} Mitglied${teamCount === 1 ? "" : "er"}` : "Nur du",
    },
  ];

  return (
    <div className="evg-onb-success">
      <div className="evg-onb-success-mark" aria-hidden>
        {!reduced && completed ? (
          <motion.div
            className="evg-onb-success-glow"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: [0, 0.08, 0], scale: 1.15 }}
            transition={{ duration: 0.9 }}
          />
        ) : null}
        <motion.div
          className="evg-onb-success-ring"
          initial={reduced || !completed ? false : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: reduced || !completed ? 0 : 0.26 }}
        >
          <svg width="28" height="28" viewBox="0 0 28 28">
            {completed ? (
              <motion.path
                d="M7 14.2L11.8 19L21 9.2"
                fill="none"
                stroke="var(--ac)"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={reduced ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: reduced ? 0 : 0.4, delay: reduced ? 0 : 0.1 }}
              />
            ) : (
              <circle cx="14" cy="14" r="6" fill="none" stroke="var(--line2)" strokeWidth="2" />
            )}
          </svg>
        </motion.div>
      </div>

      <div className="evg-onb-stack" style={{ gap: 0, width: "100%" }}>
        {rows.map((row, i) => (
          <motion.div
            key={row.label}
            className="evg-onb-summary-row"
            initial={reduced || !completed ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduced || !completed ? 0 : i * 0.05, duration: reduced || !completed ? 0 : 0.2 }}
          >
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: 100,
                background: "var(--ok-tint, rgba(111,169,111,.14))",
                display: "grid",
                placeItems: "center",
                flex: "none",
              }}
            >
              <svg width="11" height="11" viewBox="0 0 12 12">
                <path
                  d="M2.5 6.2L4.8 8.5L9.5 3.6"
                  stroke="var(--ok, #6FA96F)"
                  strokeWidth="1.8"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span className="evg-onb-summary-label">{row.label}</span>
            <span className="evg-onb-summary-value">{row.value}</span>
          </motion.div>
        ))}
      </div>

      {finishing && !bonusError ? (
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--t2)" }} role="status">
          Einrichtung wird abgeschlossen …
        </p>
      ) : null}

      {bonusError ? (
        <div className="evg-onb-stack" style={{ gap: 10, width: "100%" }}>
          <p className="evg-onb-error" role="alert">
            {bonusError}
          </p>
          <button
            type="button"
            className="evg-onb-btn evg-onb-btn--primary evg-onb-btn--lg"
            disabled={finishing}
            onClick={onRetryBonus}
          >
            {finishing ? "Wird geprüft …" : "Erneut versuchen"}
          </button>
        </div>
      ) : null}

      {completed && tokens != null ? (
        <div className="evg-onb-token-card">
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>
              {shown?.toLocaleString("de-DE") ?? "—"} Tokens verfügbar
            </div>
            <div style={{ marginTop: 4, fontSize: 11.5, color: "var(--t2)" }}>
              {profileName ? `${profileName}, d` : "D"}ein aktuelles Guthaben aus dem Billing-System.
            </div>
          </div>
          <span className="evg-onb-token-value">{shown?.toLocaleString("de-DE") ?? "—"}</span>
        </div>
      ) : null}

      {completed ? (
        <div className="evg-onb-cta-row" style={{ width: "100%" }}>
          <button
            type="button"
            className="evg-onb-btn evg-onb-btn--primary evg-onb-btn--lg"
            style={{ flex: "1 1 220px" }}
            onClick={onCreate}
          >
            {hasActivePlan ? "Erstes Motiv erstellen" : "Tarif wählen"}
          </button>
          <button
            type="button"
            className="evg-onb-btn evg-onb-btn--soft evg-onb-btn--lg"
            style={{ flex: "0 1 180px" }}
            onClick={onDashboard}
          >
            Zum Dashboard
          </button>
        </div>
      ) : null}
    </div>
  );
}
