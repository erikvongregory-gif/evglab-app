"use client";

import { useEffect, useRef, useState } from "react";
import { StudioButton, StudioEyebrow, StudioFieldLabel } from "@/components/studio/ui";
import { StudioIcon } from "@/components/studio/icons";
import { ArchGallery } from "@/components/ui/arch-gallery";
import { ColorPaletteCard } from "@/components/ui/color-palette-card";
import { ProfileStrengthProgress } from "@/components/ui/profile-strength-progress";
import { RemovableBadges } from "@/components/ui/removable-badges";
import {
  computeProfileStrength,
  formatConfidenceLabel,
  parseHexSwatches,
  parseRuleSentences,
  parseToneTags,
  reviewReferencePreviews,
} from "./brand-review-utils";
import type { BrandScanSuggestion } from "./BrandProfileSetupModal";
import { GETRANKEART_OPTIONS, sanitizeProduktKategorie } from "@/lib/dashboard/metadata";

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

        <div className="mt-5">
          <ProfileStrengthProgress
            value={strength.percent}
            statusLabel={strength.label}
            label="Profil-Stärke"
          />
        </div>
      </div>

      <div className="studio-hr" />

      <div className="studio-brand-review-body">
        <div>
          <StudioFieldLabel className="studio-brand-review-label">Referenzbilder</StudioFieldLabel>
          {refs.length > 0 ? (
            <>
              <ArchGallery
                items={refs.slice(0, 7).map((src, index) => ({
                  image: { src, alt: `Referenzbild ${index + 1}` },
                }))}
                cardWidth={148}
                cardHeight={188}
                cornerRadius={14}
                className="py-3"
                label="Referenzbilder"
              />
              {refs.length < 2 ? (
                <p className="studio-modal-sub" style={{ marginTop: 8 }}>
                  Wenige passende Motive von der Website — optional manuell ergänzen oder mit einer
                  Sortiment-/Über-uns-URL erneut scannen.
                </p>
              ) : null}
            </>
          ) : (
            <p className="studio-modal-sub" style={{ marginTop: 8 }}>
              Keine brauchbaren Szenen gefunden — Logos und Gate-Bilder werden ignoriert. Du kannst
              Referenzbilder später im Markenprofil hochladen.
            </p>
          )}
        </div>

        {review.suggestedBeers ? (
          <div>
            <StudioFieldLabel className="studio-brand-review-label">Sortiment</StudioFieldLabel>
            <p className="studio-modal-sub" style={{ marginTop: 8, marginBottom: 8 }}>
              {review.suggestedBeers.length
                ? `${review.suggestedBeers.length} Sorten von der Website erkannt — Kategorie korrigieren oder Falschtreffer entfernen.`
                : "Keine Sorten übernommen — du kannst sie später im Dashboard anlegen."}
            </p>
            {review.suggestedBeers.length > 0 ? (
              <div className="studio-brand-review-beers">
                {review.suggestedBeers.map((beer, index) => (
                  <div key={`${beer.name}-${index}`} className="studio-brand-review-beer">
                    {beer.etikettUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={beer.etikettUrl} alt="" className="studio-brand-review-ref" />
                    ) : (
                      <div className="studio-brand-review-ref studio-brand-review-ref--empty">{beer.name.slice(0, 1)}</div>
                    )}
                    <div className="studio-brand-review-beer-copy">
                      <div className="truncate" title={beer.name}>{beer.name}</div>
                      <select
                        className="studio-field"
                        value={sanitizeProduktKategorie(beer.produktKategorie)}
                        disabled={busy}
                        aria-label={`Kategorie für ${beer.name}`}
                        onChange={(e) => {
                          const produktKategorie = sanitizeProduktKategorie(e.target.value);
                          onChange({
                            suggestedBeers: review.suggestedBeers?.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    produktKategorie,
                                    bierstil: produktKategorie === "bier" ? item.bierstil : produktKategorie,
                                  }
                                : item,
                            ),
                          });
                        }}
                      >
                        {GETRANKEART_OPTIONS.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      className="studio-brand-review-beer-remove"
                      disabled={busy}
                      onClick={() =>
                        onChange({
                          suggestedBeers: review.suggestedBeers?.filter((_, itemIndex) => itemIndex !== index),
                        })
                      }
                      aria-label={`${beer.name} entfernen`}
                    >
                      <StudioIcon name="x" size={12} />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
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
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <RemovableBadges
              items={tones.map((tone) => ({ id: tone, label: tone }))}
              onRemove={(id) => {
                if (!busy) removeTone(id);
              }}
            />
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
          <div className="mt-3">
            <ColorPaletteCard
              colors={colors.map((c) => c.replace(/^#/, ""))}
              statsText={`${colors.length} Farben · tippen zum Hex`}
              className="h-[160px] shadow-sm"
            />
          </div>
          <div className="studio-brand-review-colors mt-3">
            {colors.map((color, i) => (
              <div key={`${color}-${i}`} className="studio-brand-review-color">
                <div className="studio-brand-review-color-swatch-wrap">
                  <div className="studio-brand-review-color-swatch" style={{ background: color }} title={color} />
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

        {review.brandHeadlineFontName?.trim() ? (
          <div>
            <StudioFieldLabel className="studio-brand-review-label">Typografie</StudioFieldLabel>
            <p className="mt-2 text-sm text-[var(--t2)]">
              {review.brandHeadlineFontName.trim()}
              {review.brandFontFileUrl?.trim() ? (
                <span className="text-[var(--t3)]"> · Schrift geladen</span>
              ) : (
                <span className="text-[var(--t3)]"> · Name erkannt</span>
              )}
            </p>
          </div>
        ) : null}

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
