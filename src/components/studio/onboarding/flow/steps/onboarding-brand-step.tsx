"use client";

import { useEffect, useState } from "react";

export function OnboardingBrandStep({
  websiteUrl,
  draft,
  scanning,
  scanIndex,
  scanSteps,
  reveal,
  error,
  onAnalyze,
  onChangeTone,
  onChangeColors,
}: {
  websiteUrl: string;
  draft: {
    breweryName: string;
    brandTone: string;
    brandColors: string;
    brandDos: string;
    brandDonts: string;
  };
  scanning: boolean;
  scanIndex: number;
  scanSteps: string[];
  reveal: boolean;
  error: string;
  onAnalyze: () => void;
  onChangeTone: (v: string) => void;
  onChangeColors: (v: string) => void;
}) {
  const hasDraft = Boolean(draft.brandTone && draft.brandColors && draft.brandDos);

  return (
    <div className="evg-onb-stack evg-onb-stack--lg">
      <div
        className="evg-onb-panel"
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>
            {websiteUrl.trim() ? `Website: ${websiteUrl.trim()}` : "Keine Website hinterlegt"}
          </div>
          <div style={{ marginTop: 4, fontSize: 11.5, color: "var(--t3)" }}>
            Analyse nutzt den bestehenden Marken-Scan — ohne Fake-Prozentwerte.
          </div>
        </div>
        <button
          type="button"
          className="evg-onb-btn evg-onb-btn--soft"
          disabled={scanning || !websiteUrl.trim()}
          onClick={onAnalyze}
        >
          {scanning ? "Analysiert …" : hasDraft ? "Erneut analysieren" : "Website analysieren"}
        </button>
      </div>

      {scanning ? (
        <div className="evg-onb-scan" role="status" aria-live="polite">
          <div className="evg-onb-scan-head">
            <span className="evg-onb-scan-pulse" aria-hidden />
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>Markenprofil wird vorbereitet</span>
          </div>
          <ul className="evg-onb-scan-list">
            {scanSteps.map((label, i) => (
              <li key={label} data-active={i === scanIndex} data-done={i < scanIndex}>
                <span aria-hidden>{i < scanIndex ? "✓" : i === scanIndex ? "·" : "○"}</span>
                {label}
              </li>
            ))}
          </ul>
          <div style={{ marginTop: 14 }} className="evg-onb-skeleton" />
        </div>
      ) : null}

      {!scanning && hasDraft ? (
        <div
          className="evg-onb-stack"
          style={{
            opacity: reveal ? 1 : 0,
            transition: "opacity 200ms cubic-bezier(0.2, 0.7, 0.2, 1)",
          }}
        >
          <div>
            <div className="evg-onb-label" style={{ marginBottom: 8 }}>
              MARKE
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--t1)" }}>{draft.breweryName || "—"}</div>
          </div>

          <div>
            <div className="evg-onb-label" style={{ marginBottom: 8 }}>
              MARKENFARBEN
            </div>
            <Swatches text={draft.brandColors} />
            <label className="evg-onb-field" style={{ marginTop: 10 }}>
              <span className="evg-onb-label">FARBEN BEARBEITEN</span>
              <input
                className="evg-onb-input"
                value={draft.brandColors}
                onChange={(e) => onChangeColors(e.target.value)}
                maxLength={300}
              />
            </label>
          </div>

          <label className="evg-onb-field">
            <span className="evg-onb-label">TONALITÄT</span>
            <textarea
              className="evg-onb-textarea"
              rows={3}
              value={draft.brandTone}
              onChange={(e) => onChangeTone(e.target.value)}
              maxLength={300}
            />
          </label>

          <div className="evg-onb-panel">
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--t1)", marginBottom: 6 }}>Bildregeln</div>
            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.65, color: "var(--t2)" }}>{draft.brandDos}</p>
            {draft.brandDonts ? (
              <p style={{ margin: "8px 0 0", fontSize: 12, lineHeight: 1.65, color: "var(--t3)" }}>
                Vermeiden: {draft.brandDonts}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {!scanning && !hasDraft ? (
        <div className="evg-onb-empty">
          <h3>Noch kein Markenprofil</h3>
          <p>Starte die Website-Analyse oder gehe zurück und hinterlege eine URL.</p>
        </div>
      ) : null}

      {error ? <p className="evg-onb-error">{error}</p> : null}
    </div>
  );
}

function Swatches({ text }: { text: string }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setShown(true), 40);
    return () => window.clearTimeout(t);
  }, [text]);
  const hex = [...text.matchAll(/#(?:[0-9a-fA-F]{3}){1,2}\b/g)].map((m) => m[0]).slice(0, 8);
  if (hex.length === 0) {
    return <p style={{ margin: 0, fontSize: 12.5, color: "var(--t2)" }}>{text || "—"}</p>;
  }
  return (
    <div className="evg-onb-swatches">
      {hex.map((c, i) => (
        <div
          key={`${c}-${i}`}
          className="evg-onb-swatch"
          style={{
            opacity: shown ? 1 : 0,
            transform: shown ? "scale(1)" : "scale(0.94)",
            transition: `opacity 160ms cubic-bezier(0.2, 0.7, 0.2, 1) ${i * 50}ms, transform 160ms cubic-bezier(0.2, 0.7, 0.2, 1) ${i * 50}ms`,
          }}
        >
          <span className="evg-onb-swatch-dot" style={{ background: c }} />
          <span className="evg-onb-swatch-hex">{c.toUpperCase()}</span>
        </div>
      ))}
    </div>
  );
}
