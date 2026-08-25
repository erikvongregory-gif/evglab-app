"use client";

import { useEffect, useRef, useState } from "react";
import { StudioButton, StudioEyebrow, StudioFieldLabel } from "@/components/studio/ui";
import { StudioIcon } from "@/components/studio/icons";
import {
  computeProfileStrength,
  formatConfidenceLabel,
  parseHexSwatches,
  parseRuleSentences,
  parseToneTags,
  reviewReferencePreviews,
} from "./brand-review-utils";
import type { BrandScanSuggestion } from "./BrandProfileSetupModal";

type BrandReviewPanelProps = {
  review: BrandScanSuggestion;
  sourceMeta: { confidence?: string; pageTitle?: string } | null;
  busy: boolean;
  error?: string;
  onChange: (patch: Partial<BrandScanSuggestion>) => void;
  onBack: () => void;
  onActivate: () => void;
};

export function BrandReviewPanel({ review, sourceMeta, busy, error, onChange, onBack, onActivate }: BrandReviewPanelProps) {
  const [tones, setTones] = useState<string[]>(() => parseToneTags(review.brandTone));
  const [colors, setColors] = useState<string[]>(() => parseHexSwatches(review.brandColors));
  const [addingTone, setAddingTone] = useState(false);
  const [newTone, setNewTone] = useState("");
  const toneRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTones(parseToneTags(review.brandTone));
    setColors(parseHexSwatches(review.brandColors));
  }, [review.brandTone, review.brandColors]);

  useEffect(() => {
    if (addingTone) toneRef.current?.focus();
  }, [addingTone]);

  const refs = reviewReferencePreviews(review);
  const dos = parseRuleSentences(review.brandDos);
  const donts = parseRuleSentences(review.brandDonts);
  const confidenceLabel = formatConfidenceLabel(sourceMeta?.confidence);
  const strength = computeProfileStrength({
    breweryName: review.breweryName,
    brandTone: review.brandTone,
    brandColors: review.brandColors,
    brandDos: review.brandDos,
    brandDonts: review.brandDonts,
    referenceImageCount: refs.length,
  });

  const syncTones = (next: string[]) => {
    setTones(next);
    onChange({ brandTone: next.join(", ") });
  };

  const syncColors = (next: string[]) => {
    setColors(next);
    onChange({ brandColors: next.join(", ") });
  };

  const commitTone = () => {
    const trimmed = newTone.trim();
    if (trimmed && !tones.includes(trimmed)) syncTones([...tones, trimmed]);
    setNewTone("");
    setAddingTone(false);
  };

  const removeTone = (tone: string) => syncTones(tones.filter((t) => t !== tone));

  const removeColor = (idx: number) => syncColors(colors.filter((_, i) => i !== idx));

  const addColor = (hex: string) => {
    const normalized = hex.trim().toUpperCase();
    if (!/^#[0-9A-F]{6}$/.test(normalized)) return;
    if (colors.some((c) => c.toUpperCase() === normalized)) return;
    syncColors([...colors, normalized]);
  };

  const sourceLabel = [review.breweryName, sourceMeta?.pageTitle].filter(Boolean).join(" · ") || review.breweryName;

  return (
    <div className="studio-brand-review">
      <div className="studio-brand-review-head">
        <StudioEyebrow>Vorschau</StudioEyebrow>
        <h2 className="studio-modal-title">Profil prüfen</h2>
        <p className="studio-modal-sub">Passe den KI-Vorschlag an, bevor du dein Markenprofil aktivierst.</p>

        {sourceLabel ? (
          <div className="studio-brand-review-source">
            <div className="studio-brand-review-source-left">
              <StudioIcon name="globe" size={13} />
              <span>{sourceLabel}</span>
            </div>
            {confidenceLabel ? <span className="studio-brand-review-confidence">{confidenceLabel}</span> : null}
          </div>
        ) : null}

        <div className="studio-brand-review-strength" title="Wie tragfähig dein Profil für die Bildgenerierung ist">
          <div className="studio-brand-review-strength-bar">
            <div className="studio-brand-review-strength-fill" style={{ width: `${strength.percent}%` }} />
          </div>
          <span className="studio-brand-review-strength-label">
            Profil-Stärke · {strength.label}
          </span>
        </div>
      </div>

      <div className="studio-hr" />

      <div className="studio-brand-review-body">
        {refs.length > 0 ? (
          <div>
            <StudioFieldLabel className="studio-brand-review-label">Referenzbilder</StudioFieldLabel>
            <div className="studio-brand-review-refs">
              {refs.slice(0, 6).map((url, index) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={`${url.slice(0, 48)}-${index}`} src={url} alt="" className="studio-brand-review-ref" />
              ))}
            </div>
          </div>
        ) : null}

        <div>
          <StudioFieldLabel>Markenname</StudioFieldLabel>
          <input
            className="studio-field"
            style={{ marginTop: 8 }}
            value={review.breweryName}
            onChange={(e) => onChange({ breweryName: e.target.value })}
            disabled={busy}
          />
        </div>

        <div>
          <StudioFieldLabel className="studio-brand-review-label">Tonalität</StudioFieldLabel>
          <div className="studio-brand-review-chips">
            {tones.map((tone) => (
              <span key={tone} className="studio-brand-review-chip">
                {tone}
                <button type="button" disabled={busy} onClick={() => removeTone(tone)} aria-label={`${tone} entfernen`}>
                  <StudioIcon name="x" size={9} />
                </button>
              </span>
            ))}
            {addingTone ? (
              <input
                ref={toneRef}
                className="studio-brand-review-tone-input"
                value={newTone}
                onChange={(e) => setNewTone(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitTone();
                  if (e.key === "Escape") {
                    setAddingTone(false);
                    setNewTone("");
                  }
                }}
                onBlur={commitTone}
                placeholder="Eigenschaft …"
                disabled={busy}
              />
            ) : (
              <button type="button" className="studio-brand-review-add-chip" disabled={busy} onClick={() => setAddingTone(true)}>
                <StudioIcon name="plus" size={12} />
                Hinzufügen
              </button>
            )}
          </div>
        </div>

        <div>
          <StudioFieldLabel className="studio-brand-review-label">Markenfarben</StudioFieldLabel>
          <div className="studio-brand-review-colors">
            {colors.map((color, i) => (
              <div key={`${color}-${i}`} className="studio-brand-review-color">
                <div className="studio-brand-review-color-swatch-wrap">
                  <div
                    className="studio-brand-review-color-swatch"
                    style={{ background: color }}
                    title={color}
                  />
                  <button type="button" disabled={busy} onClick={() => removeColor(i)} aria-label="Farbe entfernen">
                    <StudioIcon name="x" size={9} />
                  </button>
                </div>
                <span className="studio-brand-review-color-hex">{color.replace("#", "")}</span>
              </div>
            ))}
            {colors.length < 8 ? (
              <label className="studio-brand-review-add-chip studio-brand-review-color-add">
                <input
                  type="color"
                  disabled={busy}
                  onChange={(e) => addColor(e.target.value)}
                  aria-label="Farbe hinzufügen"
                />
                <StudioIcon name="plus" size={12} />
                Farbe
              </label>
            ) : null}
          </div>
        </div>

        <div className="studio-brand-review-rules-wrap">
          <StudioFieldLabel className="studio-brand-review-label">Bildregeln</StudioFieldLabel>
          <div className="studio-brand-review-rules">
            <div className="studio-brand-review-rules-dos">
              <div className="studio-brand-review-rules-heading ok">Dos</div>
              <div className="studio-brand-review-rules-list">
                {(dos.length ? dos : ["—"]).map((line, i) => (
                  <div key={`do-${i}`} className="studio-brand-review-rule-line">
                    <span className="studio-brand-review-rule-icon ok">
                      <StudioIcon name="check" size={9} />
                    </span>
                    <span>{line}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="studio-brand-review-rules-donts">
              <div className="studio-brand-review-rules-heading warn">Don&apos;ts</div>
              <div className="studio-brand-review-rules-list">
                {(donts.length ? donts : ["—"]).map((line, i) => (
                  <div key={`dont-${i}`} className="studio-brand-review-rule-line">
                    <span className="studio-brand-review-rule-icon warn">
                      <StudioIcon name="x" size={9} />
                    </span>
                    <span>{line}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <details className="studio-brand-review-edit-details">
            <summary>Bildregeln bearbeiten</summary>
            <div className="studio-brand-review-edit-fields">
              <label>
                <StudioFieldLabel>Dos</StudioFieldLabel>
                <textarea
                  className="studio-field"
                  style={{ marginTop: 6, minHeight: 72 }}
                  value={review.brandDos}
                  onChange={(e) => onChange({ brandDos: e.target.value })}
                  disabled={busy}
                  rows={3}
                />
              </label>
              <label>
                <StudioFieldLabel>Don&apos;ts</StudioFieldLabel>
                <textarea
                  className="studio-field"
                  style={{ marginTop: 6, minHeight: 72 }}
                  value={review.brandDonts}
                  onChange={(e) => onChange({ brandDonts: e.target.value })}
                  disabled={busy}
                  rows={3}
                />
              </label>
            </div>
          </details>
        </div>
      </div>

      <div className="studio-brand-review-foot">
        {error ? <p className="studio-brand-review-error">{error}</p> : null}
        <div className="studio-brand-review-foot-actions">
          <StudioButton type="button" variant="ghost" size="sm" disabled={busy} onClick={onBack}>
            <StudioIcon name="chevL" size={15} />
            Zurück
          </StudioButton>
          <StudioButton type="button" variant="primary" size="sm" disabled={busy} onClick={onActivate}>
            <StudioIcon name="shield" size={15} />
            {busy ? "Speichert…" : "Profil aktivieren"}
          </StudioButton>
        </div>
      </div>
    </div>
  );
}
