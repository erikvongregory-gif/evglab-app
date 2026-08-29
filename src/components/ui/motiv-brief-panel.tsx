"use client";

import React from "react";
import styles from "./motiv-brief-panel.module.css";

export type BriefStepId = "produkt" | "szene" | "stimmung" | "extras" | "brief";

export type MotivBriefPanelProps = {
  brandName: string;
  brandStyleActive: boolean;
  productLabel: string;
  productMeta?: string;
  sceneLabel: string;
  moodLabel: string;
  extras: string[];
  onRemoveExtra: (label: string) => void;
  completenessScore: number;
  completenessLabel: string;
  openItems: Array<{ label: string; target: string }>;
  doneItems: Array<{ label: string }>;
  note: string;
  noteMaxLength: number;
  onNoteChange: (value: string) => void;
  aspectOptions: Array<{ label: string; value: string }>;
  aspectValue: string;
  onAspectChange: (value: string) => void;
  variantOptions: Array<{ value: number; label: string }>;
  variantCount: number;
  onVariantChange: (value: number) => void;
  tokenCost: number;
  tokensRemaining: number | null;
  formatToken: (n: number) => string;
  onJump: (target: BriefStepId | string) => void;
  onGenerate: () => void;
  onBack: () => void;
  loading?: boolean;
  generateDisabled?: boolean;
  generationStep?: string;
  error?: string | null;
  durationHint?: string;
};

const STEP_LABELS: Array<{ id: BriefStepId; label: string }> = [
  { id: "produkt", label: "Produkt" },
  { id: "szene", label: "Szene" },
  { id: "stimmung", label: "Stimmung" },
  { id: "extras", label: "Extras" },
  { id: "brief", label: "Brief" },
];

function aspectCssRatio(aspect: string): string {
  const [w, h] = aspect.split(":").map(Number);
  if (!w || !h) return "4 / 5";
  return `${w} / ${h}`;
}

function splitMeta(meta?: string): string[] {
  if (!meta?.trim()) return [];
  return meta
    .split("·")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function MotivBriefPanel({
  brandName,
  brandStyleActive,
  productLabel,
  productMeta,
  sceneLabel,
  moodLabel,
  extras,
  onRemoveExtra,
  completenessScore,
  completenessLabel,
  openItems,
  doneItems,
  note,
  noteMaxLength,
  onNoteChange,
  aspectOptions,
  aspectValue,
  onAspectChange,
  variantOptions,
  variantCount,
  onVariantChange,
  tokenCost,
  tokensRemaining,
  formatToken,
  onJump,
  onGenerate,
  onBack,
  loading = false,
  generateDisabled = false,
  generationStep,
  error,
  durationHint,
}: MotivBriefPanelProps) {
  const balanceAfter =
    tokensRemaining === null ? null : Math.max(0, tokensRemaining - tokenCost);
  const productChips = [productLabel, ...splitMeta(productMeta)].filter(Boolean);
  const sceneChips = splitMeta(sceneLabel).length ? splitMeta(sceneLabel) : sceneLabel ? [sceneLabel] : [];
  const moodChips = moodLabel ? [moodLabel] : [];
  const brandInitial = (brandName || "B").trim().charAt(0).toUpperCase() || "B";

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div className={styles.headerBrand}>
          <p className={styles.kicker}>Motiv-Composer</p>
          <h1 className={styles.title}>Brief &amp; Start</h1>
        </div>
        <nav className={styles.steps} aria-label="Brief-Schritte">
          {STEP_LABELS.map((step) => {
            const current = step.id === "brief";
            return (
              <button
                key={step.id}
                type="button"
                className={`${styles.step} ${current ? styles.stepCurrent : ""}`}
                aria-current={current ? "step" : undefined}
                onClick={() => onJump(step.id)}
                disabled={loading && !current}
              >
                {step.label}
              </button>
            );
          })}
        </nav>
        <div className={styles.brandPill} title={brandName || "Brauerei"}>
          <span className={styles.brandMark} aria-hidden>
            {brandInitial}
          </span>
          <span className={styles.brandPillText}>
            Markenstil{" "}
            <strong>{brandStyleActive ? brandName || "Brauerei" : "inaktiv"}</strong>
            {brandStyleActive ? " aktiv" : ""}
          </span>
        </div>
      </header>

      <div className={styles.grid}>
        <div className={styles.main}>
          <section className={styles.section} aria-labelledby="brief-summary-title">
            <div className={styles.sectionIntro}>
              <h2 id="brief-summary-title" className={styles.sectionTitleLg}>
                Das hast du gebrieft
              </h2>
              <p className={styles.sectionLead}>
                Vier Bausteine, aus denen der Prompt gebaut wird. Klick eine Zeile an, um sie zu ändern —
                du landest wieder hier.
              </p>
            </div>

            <div className={styles.rows}>
              <div className={styles.row}>
                <div className={styles.rowLabel}>Produkt</div>
                <div className={styles.chips}>
                  {productChips.map((chip, i) => (
                    <span key={chip} className={`${styles.chip} ${i === 0 ? styles.chipStrong : ""}`}>
                      {chip}
                    </span>
                  ))}
                </div>
                <button type="button" className={styles.change} onClick={() => onJump("produkt")} disabled={loading}>
                  Ändern
                </button>
              </div>

              <div className={styles.row}>
                <div className={styles.rowLabel}>Szene</div>
                <div className={styles.chips}>
                  {sceneChips.map((chip, i) => (
                    <span key={chip} className={`${styles.chip} ${i === 0 ? styles.chipStrong : ""}`}>
                      {chip}
                    </span>
                  ))}
                </div>
                <button type="button" className={styles.change} onClick={() => onJump("szene")} disabled={loading}>
                  Ändern
                </button>
              </div>

              <div className={styles.row}>
                <div className={styles.rowLabel}>Stimmung</div>
                <div className={styles.chips}>
                  {moodChips.map((chip) => (
                    <span key={chip} className={`${styles.chip} ${styles.chipAccent}`}>
                      {chip}
                    </span>
                  ))}
                </div>
                <button type="button" className={styles.change} onClick={() => onJump("stimmung")} disabled={loading}>
                  Ändern
                </button>
              </div>

              <div className={`${styles.row} ${styles.rowLast}`}>
                <div className={styles.rowLabel}>Extras</div>
                <div className={styles.chips}>
                  {extras.length ? (
                    extras.map((extra) => (
                      <span key={extra} className={styles.chip}>
                        {extra}
                        <button
                          type="button"
                          className={styles.remove}
                          aria-label={`${extra} entfernen`}
                          disabled={loading}
                          onClick={() => onRemoveExtra(extra)}
                        >
                          ×
                        </button>
                      </span>
                    ))
                  ) : (
                    <span className={styles.chipMuted}>Keine Extras gewählt</span>
                  )}
                  <button
                    type="button"
                    className={styles.addExtra}
                    onClick={() => onJump("extras")}
                    disabled={loading}
                  >
                    + Extra
                  </button>
                </div>
                <div className={styles.extraCount}>{extras.length}</div>
              </div>
            </div>
          </section>

          <section className={styles.section} aria-labelledby="brief-readiness-title">
            <div className={styles.readinessHead}>
              <h2 id="brief-readiness-title" className={styles.sectionTitleLg}>
                {completenessLabel || "Brief-Vollständigkeit"}
              </h2>
              <span className={styles.scoreNum}>Brief-Vollständigkeit {completenessScore}/100</span>
            </div>
            <p className={styles.sectionLead}>
              Transparente Checkliste aus deinen Angaben — keine KI-Qualitätsbewertung.
            </p>
            <div className={styles.bar} aria-hidden>
              <div className={styles.barFill} style={{ width: `${Math.min(100, completenessScore)}%` }} />
            </div>
            <div className={styles.barScale} aria-hidden>
              <span>Roh</span>
              <span>Solide</span>
              <span>Markenreif</span>
            </div>

            {openItems.length ? (
              <div className={styles.todoStack}>
                {openItems.map((item) => (
                  <div key={item.label} className={styles.todoWarn}>
                    <span className={styles.todoWarnIcon} aria-hidden>
                      !
                    </span>
                    <div className={styles.todoWarnBody}>
                      <div className={styles.todoWarnTitle}>{item.label}</div>
                    </div>
                    <button type="button" className={styles.todoCta} onClick={() => onJump(item.target)} disabled={loading}>
                      Öffnen
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            {doneItems.length ? (
              <div className={styles.doneBlock}>
                <p className={styles.doneSummary}>{doneItems.length} Punkte erledigt</p>
                <ul className={styles.doneList}>
                  {doneItems.slice(0, 6).map((item) => (
                    <li key={item.label}>{item.label}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <section className={styles.section} aria-labelledby="brief-note-title">
            <div className={styles.noteHead}>
              <h2 id="brief-note-title" className={styles.sectionTitleLg}>
                Feinschliff in eigenen Worten
              </h2>
              <span className={styles.noteMeta}>
                Optional · {note.length}/{noteMaxLength}
              </span>
            </div>
            <p className={styles.sectionLead}>
              Ein Satz, der die Stimmung genauer trifft. Deutsch oder Englisch — beides funktioniert.
            </p>
            <textarea
              id="motiv-brief-note"
              className={styles.textarea}
              value={note}
              maxLength={noteMaxLength}
              disabled={loading}
              placeholder="z. B. Kastanien über dem Tisch, Lichterketten weich außerhalb des Fokus"
              onChange={(e) => onNoteChange(e.target.value)}
            />
          </section>
        </div>

        <aside className={styles.rail} aria-label="Ausgabe und Generieren">
          <div className={styles.railBlock}>
            <p className={styles.kicker}>So kommt es raus</p>
            <div
              className={styles.preview}
              style={{ ["--preview-ratio" as string]: aspectCssRatio(aspectValue) }}
              aria-hidden
            >
              <span className={styles.previewTag}>{aspectValue}</span>
            </div>
            <p className={styles.previewCaption}>
              {brandName || "Dein Motiv"} · {variantCount} Variante(n)
            </p>
          </div>

          <div className={styles.railBlock}>
            <p className={styles.kicker}>Format</p>
            <div className={styles.formats} role="radiogroup" aria-label="Bildformat">
              {aspectOptions.map((opt) => {
                const active = opt.value === aspectValue;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={`${styles.formatBtn} ${active ? styles.formatBtnActive : ""}`}
                    disabled={loading}
                    onClick={() => onAspectChange(opt.value)}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.railBlock}>
            <div className={styles.variantHead}>
              <p className={styles.kicker}>Varianten</p>
              <span className={styles.hintInline}>1–3 verfügbar</span>
            </div>
            <div className={styles.variants} role="radiogroup" aria-label="Anzahl Varianten">
              {variantOptions.map((opt) => {
                const active = opt.value === variantCount;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={`${styles.variantBtn} ${active ? styles.variantBtnActive : ""}`}
                    disabled={loading}
                    onClick={() => onVariantChange(opt.value)}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.costRow}>
            <span>Kosten</span>
            <strong>{formatToken(tokenCost)} Tokens</strong>
          </div>
          <div className={styles.costRow}>
            <span>Guthaben danach</span>
            <strong>{balanceAfter === null ? "—" : formatToken(balanceAfter)}</strong>
          </div>
          {durationHint ? <p className={styles.hint}>{durationHint}</p> : null}

          <button
            type="button"
            className={styles.generate}
            disabled={generateDisabled || loading}
            aria-busy={loading}
            onClick={onGenerate}
          >
            {loading ? "Generiere …" : "Generieren"}
          </button>
          <button type="button" className={styles.back} disabled={loading} onClick={onBack}>
            Zurück
          </button>

          {generationStep && loading ? (
            <p className={styles.status} aria-live="polite">
              {generationStep}
            </p>
          ) : null}
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
