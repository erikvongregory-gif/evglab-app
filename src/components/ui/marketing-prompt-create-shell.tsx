"use client";

/* eslint-disable @next/next/no-img-element */
import React from "react";
import { STUDIO_TOKENS, type StudioPalette } from "@/components/ui/dashboard-studio-shell";

export type PromptSegment = { text: string; highlight?: boolean };

export type VariantCardState = {
  src?: string;
  index: number;
  progress?: number;
  loading?: boolean;
};

type AspectOption = { label: string; value: string };

type MarketingPromptCreateShellProps = {
  P: StudioPalette;
  brandMeta: string;
  promptStepLabel: string;
  promptSegments: PromptSegment[];
  segmentTargets?: number[];
  onSegmentClick?: (target: number) => void;
  showCursor?: boolean;
  questionTitle: string;
  questionSubtitle?: string;
  children: React.ReactNode;
  aspectOptions: AspectOption[];
  aspectValue: string;
  onAspectChange: (value: string) => void;
  estimatedLabel: string;
  primaryLabel: string;
  primaryMode: "next" | "generate";
  onPrimary: () => void;
  onBack?: () => void;
  backLabel?: string;
  canBack?: boolean;
  primaryDisabled?: boolean;
  loading?: boolean;
  brandStyleActive: boolean;
  brandName: string;
  formatTag: string;
  tokensLabel: string;
  variants: VariantCardState[];
  onSelectVariant?: (index: number) => void;
  feedError?: string;
  generationStep?: string;
};

function aspectRatioCss(value: string): string {
  if (value === "9:16") return "9 / 16";
  if (value === "4:5") return "4 / 5";
  if (value === "16:9") return "16 / 9";
  return "1 / 1";
}

function FeedColumn({
  variants,
  cardAspect,
  loading,
  generationStep,
  feedError,
  onBack,
  backLabel,
  onSelectVariant,
  P,
}: {
  variants: VariantCardState[];
  cardAspect: string;
  loading: boolean;
  generationStep?: string;
  feedError?: string;
  onBack?: () => void;
  backLabel?: string;
  onSelectVariant?: (index: number) => void;
  P: StudioPalette;
}) {
  if (feedError) {
    return (
      <div className="studio-create-feed-error" role="alert">
        <div className="studio-create-feed-error__title">Generierung fehlgeschlagen</div>
        <p className="studio-create-feed-error__text">{feedError}</p>
      </div>
    );
  }

  if (loading && variants.length > 0 && variants.every((v) => !v.src)) {
    return (
      <div className="studio-create-feed-panel studio-create-feed-loading">
        <div className="studio-create-feed-loading__head">
          <span className="studio-create-feed-loading__spinner" aria-hidden="true" />
          <span>{variants.length} Motive werden erzeugt …</span>
        </div>
        <div className="studio-create-feed-loading__bar" aria-hidden="true">
          <span />
        </div>
        {generationStep ? <p className="studio-create-feed-loading__hint">{generationStep}</p> : null}
        <div className="evg-marketing-create__results">
          {variants.map((variant) => (
            <div
              key={variant.index}
              className="evg-marketing-create__result"
              style={{ aspectRatio: cardAspect }}
            >
              <div className="evg-marketing-create__rendering">
                <div className="evg-marketing-create__render-ring" aria-hidden="true">
                  <svg viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(245,237,223,0.08)" strokeWidth="6" />
                    <circle
                      cx="40"
                      cy="40"
                      r="34"
                      fill="none"
                      stroke={P.accent}
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={`${Math.max(8, (variant.progress ?? 12) * 2.13)} 213`}
                      transform="rotate(-90 40 40)"
                    />
                  </svg>
                </div>
                <div className="evg-marketing-create__render-label">KI generiert</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variants.length > 0) {
    return (
      <div className="studio-create-feed-panel">
        <div className="studio-create-feed-panel__head">
          <div>
            <div className="studio-create-feed-panel__title">Ergebnisse</div>
            <div className="studio-create-feed-panel__meta">Tippe auf ein Motiv zum Vergrößern</div>
          </div>
        </div>
        <div className="evg-marketing-create__results" style={{ marginTop: 14 }}>
          {variants.map((variant) => (
            <div
              key={variant.index}
              className={variant.src ? "evg-marketing-create__result evg-marketing-create__result--done" : "evg-marketing-create__result"}
              style={{ aspectRatio: cardAspect }}
            >
              {variant.src ? (
                <>
                  <img src={variant.src} alt={`Variante ${variant.index + 1}`} className="evg-marketing-create__result-img" />
                  <div className="evg-marketing-create__result-badge">Fertig</div>
                  <div className="evg-marketing-create__result-bar">
                    <span>Variante {variant.index + 1}</span>
                    <button type="button" className="evg-marketing-create__select" onClick={() => onSelectVariant?.(variant.index)}>
                      Öffnen
                    </button>
                  </div>
                </>
              ) : (
                <div className="evg-marketing-create__rendering">
                  <div className="evg-marketing-create__render-ring" aria-hidden="true">
                    <svg viewBox="0 0 80 80">
                      <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(245,237,223,0.08)" strokeWidth="6" />
                      <circle
                        cx="40"
                        cy="40"
                        r="34"
                        fill="none"
                        stroke={P.accent}
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={`${Math.max(8, (variant.progress ?? 12) * 2.13)} 213`}
                        transform="rotate(-90 40 40)"
                      />
                    </svg>
                  </div>
                  <div className="evg-marketing-create__render-label">KI generiert</div>
                </div>
              )}
            </div>
          ))}
        </div>
        {variants.some((variant) => variant.src) && onBack && !loading ? (
          <div className="evg-marketing-create__results-nav" style={{ marginTop: 12 }}>
            <button type="button" className="evg-marketing-create__back" onClick={onBack}>
              {backLabel}
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="studio-create-feed-empty">
      <div className="studio-create-feed-empty__title">Noch keine Motive</div>
      <p className="studio-create-feed-empty__text">
        Konfiguriere links dein Motiv — die Ergebnisse erscheinen hier nach der Generierung.
      </p>
    </div>
  );
}

export function MarketingPromptCreateShell({
  P,
  brandMeta,
  promptStepLabel,
  promptSegments,
  segmentTargets,
  onSegmentClick,
  showCursor = true,
  questionTitle,
  questionSubtitle,
  children,
  aspectOptions,
  aspectValue,
  onAspectChange,
  estimatedLabel,
  primaryLabel,
  primaryMode,
  onPrimary,
  onBack,
  backLabel = "Zurück",
  canBack = false,
  primaryDisabled = false,
  loading = false,
  brandStyleActive,
  brandName,
  formatTag,
  tokensLabel,
  variants,
  onSelectVariant,
  feedError,
  generationStep,
}: MarketingPromptCreateShellProps) {
  const cardAspect = aspectRatioCss(aspectValue);

  return (
    <div className="evg-marketing-create">
      <div className="studio-create-workspace">
        <div className="studio-create-composer">
          <header className="studio-create-page-head" style={{ marginBottom: 0 }}>
            <div className="studio-create-page-head__main">
              <span className="studio-eyebrow">Motiv-Composer</span>
              <h1 style={{ fontSize: "var(--t-15)", margin: 0 }}>Brief &amp; Einstellungen</h1>
              <p className="studio-create-composer-meta">{brandMeta}</p>
            </div>
          </header>

          <div className="studio-create-composer-surface">
            <div className="evg-marketing-create__prompt-head">
              <div className="evg-marketing-create__prompt-label">
                <span className="evg-marketing-create__prompt-accent">Prompt</span>
                <span> · Schritt {promptStepLabel}</span>
              </div>
            </div>

            <div className="evg-marketing-create__prompt-text" data-tour="prompt" aria-live="polite">
              {promptSegments.length === 0 ? (
                <span style={{ color: P.ink3 }}>Dein Motiv entsteht Schritt für Schritt …</span>
              ) : (
                promptSegments.map((seg, i) => {
                  const target = segmentTargets?.[i];
                  const clickable = Boolean(onSegmentClick) && typeof target === "number";
                  const color = seg.highlight ? STUDIO_TOKENS.amber2 : P.ink;
                  const weight = seg.highlight ? 650 : 400;
                  return (
                    <React.Fragment key={`${seg.text}-${i}`}>
                      {i > 0 ? <span style={{ color: P.ink2 }}> · </span> : null}
                      {clickable ? (
                        <button
                          type="button"
                          title="Zu diesem Schritt springen"
                          onClick={() => onSegmentClick?.(target as number)}
                          style={{
                            color,
                            fontWeight: weight,
                            background: "none",
                            border: "none",
                            padding: 0,
                            margin: 0,
                            font: "inherit",
                            cursor: "pointer",
                            textDecoration: "underline",
                            textDecorationStyle: "dotted",
                            textUnderlineOffset: 3,
                            textDecorationColor: P.ink3,
                          }}
                        >
                          {seg.text}
                        </button>
                      ) : (
                        <span style={{ color, fontWeight: weight }}>{seg.text}</span>
                      )}
                    </React.Fragment>
                  );
                })
              )}
              {showCursor ? (
                <span className="evg-marketing-create__cursor" aria-hidden="true">
                  |
                </span>
              ) : null}
            </div>

            <div className="evg-marketing-create__question">
              <h2 className="evg-marketing-create__question-title">{questionTitle}</h2>
              {questionSubtitle ? <p className="evg-marketing-create__question-sub">{questionSubtitle}</p> : null}
              <div className="evg-marketing-create__choices">{children}</div>
            </div>

            <div className="evg-marketing-create__prompt-foot">
              <div className="evg-marketing-create__ratios">
                {aspectOptions.map((opt) => {
                  const active = opt.value === aspectValue;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => onAspectChange(opt.value)}
                      className={active ? "evg-marketing-create__ratio evg-marketing-create__ratio--active" : "evg-marketing-create__ratio"}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <div className="evg-marketing-create__foot-actions">
                {canBack ? (
                  <button type="button" className="evg-marketing-create__back" onClick={onBack}>
                    {backLabel}
                  </button>
                ) : null}
                <span className="evg-marketing-create__eta">{estimatedLabel}</span>
                <button
                  type="button"
                  className="evg-marketing-create__primary"
                  data-tour="generate"
                  disabled={primaryDisabled || loading}
                  onClick={onPrimary}
                >
                  {loading ? "…" : primaryLabel}
                  {!loading && primaryMode === "generate" ? (
                    <span className="evg-marketing-create__primary-arrow" aria-hidden="true">
                      ↵
                    </span>
                  ) : null}
                </button>
              </div>
            </div>
          </div>

          <div className="evg-marketing-create__statusbar">
            <div className="evg-marketing-create__brand-chip">
              <div className={`evg-marketing-create__brand-icon${brandStyleActive ? " evg-marketing-create__brand-icon--active" : ""}`} />
              <div>
                <div className="evg-marketing-create__brand-kicker">
                  {brandStyleActive ? "Markenstil aktiv" : "Ohne Markenprofil"}
                </div>
                <div className="evg-marketing-create__brand-name">{brandName}</div>
              </div>
            </div>
            <div className="evg-marketing-create__status-tags">{formatTag}</div>
            <div className="evg-marketing-create__tokens">{tokensLabel}</div>
          </div>
        </div>

        <aside className="studio-create-feed" aria-label="Generierte Motive">
          <FeedColumn
            variants={variants}
            cardAspect={cardAspect}
            loading={loading}
            generationStep={generationStep}
            feedError={feedError}
            onBack={onBack}
            backLabel={backLabel}
            onSelectVariant={onSelectVariant}
            P={P}
          />
        </aside>
      </div>
    </div>
  );
}
