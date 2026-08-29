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

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div className={styles.headerBrand}>
          <p className={styles.kicker}>Motiv-Composer</p>
          <h1 className={styles.title}>Brief &amp; Start</h1>
          <p className={styles.brandMeta}>
            {brandStyleActive ? `Markenstil aktiv · ${brandName || "Brauerei"}` : brandName || "Ohne Markenstil"}
          </p>
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
      </header>

      <div className={styles.grid}>
        <div className={styles.main}>
          <section className={styles.section} aria-labelledby="brief-summary-title">
            <div className={styles.sectionHead}>
              <h2 id="brief-summary-title" className={styles.sectionTitle}>
                Das hast du gebrieft
              </h2>
            </div>

            <div className={styles.sectionHead}>
              <h3 className={styles.sectionTitle}>Produkt</h3>
              <button type="button" className={styles.change} onClick={() => onJump("produkt")} disabled={loading}>
                Ändern
              </button>
            </div>
            <p className={styles.value}>
              <span className={styles.valueStrong}>{productLabel}</span>
              {productMeta ? ` · ${productMeta}` : null}
            </p>

            <div className={styles.sectionHead} style={{ marginTop: 14 }}>
              <h3 className={styles.sectionTitle}>Szene</h3>
              <button type="button" className={styles.change} onClick={() => onJump("szene")} disabled={loading}>
                Ändern
              </button>
            </div>
            <p className={styles.value}>{sceneLabel}</p>

            <div className={styles.sectionHead} style={{ marginTop: 14 }}>
              <h3 className={styles.sectionTitle}>Stimmung</h3>
              <button type="button" className={styles.change} onClick={() => onJump("stimmung")} disabled={loading}>
                Ändern
              </button>
            </div>
            <p className={styles.value}>{moodLabel}</p>

            <div className={styles.sectionHead} style={{ marginTop: 14 }}>
              <h3 className={styles.sectionTitle}>Extras</h3>
              <button type="button" className={styles.change} onClick={() => onJump("extras")} disabled={loading}>
                Ändern
              </button>
            </div>
            {extras.length ? (
              <div className={styles.chips}>
                {extras.map((extra) => (
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
                ))}
              </div>
            ) : (
              <p className={styles.value}>Keine Extras gewählt</p>
            )}
          </section>

          <section className={styles.section} aria-labelledby="brief-readiness-title">
            <div className={styles.sectionHead}>
              <h2 id="brief-readiness-title" className={styles.sectionTitle}>
                Brief-Vollständigkeit
              </h2>
            </div>
            <div className={styles.readiness}>
              <div className={styles.readinessMeta}>
                <span>{completenessLabel}</span>
                <span>{completenessScore}/100</span>
              </div>
              <div className={styles.bar} aria-hidden>
                <div className={styles.barFill} style={{ width: `${Math.min(100, completenessScore)}%` }} />
              </div>
              <p className={styles.hint}>
                Transparente Checkliste aus deinen Angaben — keine KI-Qualitätsbewertung.
              </p>
            </div>

            {openItems.length ? (
              <>
                <h3 className={styles.sectionTitle} style={{ marginTop: 14 }}>
                  Offene Punkte
                </h3>
                <ul className={styles.todoList}>
                  {openItems.map((item) => (
                    <li key={item.label} className={styles.todo}>
                      <span>{item.label}</span>
                      <button type="button" className={styles.change} onClick={() => onJump(item.target)} disabled={loading}>
                        Öffnen
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            {doneItems.length ? (
              <>
                <h3 className={styles.sectionTitle} style={{ marginTop: 14 }}>
                  Erledigt
                </h3>
                <ul className={styles.todoList}>
                  {doneItems.slice(0, 4).map((item) => (
                    <li key={item.label} className={`${styles.todo} ${styles.todoDone}`}>
                      <span>{item.label}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </section>

          <section className={styles.section} aria-labelledby="brief-note-title">
            <div className={styles.sectionHead}>
              <h2 id="brief-note-title" className={styles.sectionTitle}>
                Feinschliff in eigenen Worten
              </h2>
            </div>
            <label className={styles.hint} htmlFor="motiv-brief-note">
              Optionaler Zusatzwunsch (wie bisher im Create-Flow)
            </label>
            <textarea
              id="motiv-brief-note"
              className={styles.textarea}
              value={note}
              maxLength={noteMaxLength}
              disabled={loading}
              placeholder='z. B. „mit Blick auf unseren Kirchturm“ oder „Etikett zur Kamera gedreht“'
              onChange={(e) => onNoteChange(e.target.value)}
            />
            <p className={styles.hint}>
              {note.length}/{noteMaxLength}
            </p>
          </section>
        </div>

        <aside className={styles.rail} aria-label="Ausgabe und Generieren">
          <p className={styles.kicker}>So kommt es raus</p>
          <h2 className={styles.railTitle}>Format &amp; Varianten</h2>
          <div
            className={styles.preview}
            style={{ ["--preview-ratio" as string]: aspectCssRatio(aspectValue) }}
            aria-hidden
          >
            Vorschau · {aspectValue}
            <br />
            keine Fake-KI-Motive
          </div>
          <p className={styles.previewCaption}>{brandName || "Dein Motiv"} · {variantCount} Variante(n)</p>

          <div>
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

          <div>
            <p className={styles.kicker}>Varianten</p>
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
