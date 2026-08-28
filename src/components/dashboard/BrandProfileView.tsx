"use client";



import React, { useState } from "react";

import { StudioBadge, StudioButton, StudioCard, StudioEyebrow } from "@/components/studio/ui";

import { StudioIcon } from "@/components/studio/icons";

import {

  formatDomain,

  parseBildregeln,

  parseHexSwatches,

  parseToneTags,

} from "@/lib/brand/brand-profile-display";



type BrandSettings = {

  brandProfileMode: "undecided" | "guided" | "skip";

  brandInstagramUrl: string;

  brandWebsiteUrl: string;

  brandProfileSource: "url" | "instagram" | "manual" | "skip";

  brandLockLevel: "strict" | "balanced" | "loose";

  breweryName: string;

  brandTone: string;

  brandColors: string;

  brandDos: string;

  brandDonts: string;

  brandReferenceImageUrls: string[];

  brandAnalyzedAt?: string;

};



function formatAnalyzedLabel(iso?: string, fallbackNotice?: string): string {

  if (fallbackNotice?.trim()) return fallbackNotice;

  if (!iso?.trim()) return "Zuletzt analysiert · aktiv";

  const t = new Date(iso).getTime();

  if (!Number.isFinite(t)) return "Zuletzt analysiert · aktiv";

  const diffMs = Date.now() - t;

  if (diffMs < 60_000) return "Zuletzt analysiert · gerade eben";

  const mins = Math.floor(diffMs / 60_000);

  if (mins < 60) return `Zuletzt analysiert · vor ${mins} Min.`;

  const hours = Math.floor(mins / 60);

  if (hours < 24) return `Zuletzt analysiert · vor ${hours} Std.`;

  const days = Math.floor(hours / 24);

  if (days === 1) return "Zuletzt analysiert · gestern";

  return `Zuletzt analysiert · vor ${days} Tagen`;

}



const LOCK_OPTIONS: Array<{ id: BrandSettings["brandLockLevel"]; label: string; sub: string }> = [

  { id: "strict", label: "Strict", sub: "Maximale Markenbindung" },

  { id: "balanced", label: "Balanced", sub: "Stil + kreativer Spielraum" },

  { id: "loose", label: "Frei", sub: "Profil als lose Inspiration" },

];

/** Schnellstart: URL direkt im Marken-Tab eingeben — Analyse startet ohne Umweg. */
function BrandQuickStartCard({
  onQuickAnalyze,
  onOpenBrandSetup,
  onSkipBrandProfile,
}: {
  onQuickAnalyze?: (url: string) => void;
  onOpenBrandSetup: () => void;
  onSkipBrandProfile?: () => void;
}) {
  const [url, setUrl] = useState("");

  const submit = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (onQuickAnalyze) onQuickAnalyze(trimmed);
    else onOpenBrandSetup();
  };

  return (
    <div className="studio-brand-empty-card">
      <div className="studio-brand-empty-card__icon" aria-hidden>
        <StudioIcon name="shield" size={18} />
      </div>
      <p className="studio-muted" style={{ fontSize: 14, lineHeight: 1.5, margin: 0 }}>
        Ein Link genügt — BrewAI liest deine Website und erstellt daraus dein komplettes Markenprofil.
      </p>
      <form
        className="studio-brand-quickstart"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="studio-field-with-icon">
          <span className="studio-field-icon">
            <StudioIcon name="globe" size={16} />
          </span>
          <input
            className="studio-field"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="www.deine-brauerei.de"
            aria-label="Website deiner Marke"
            inputMode="url"
            autoComplete="url"
          />
        </div>
        <StudioButton type="submit" variant="primary" disabled={!url.trim()}>
          <StudioIcon name="spark" size={15} />
          Profil erstellen
        </StudioButton>
      </form>
      <p className="studio-faint" style={{ marginTop: 12, fontSize: 11.5 }}>
        Dauert meist unter einer Minute · alles jederzeit anpassbar
      </p>
      <div style={{ marginTop: 14, display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          className="studio-faint"
          style={{ fontSize: 12, textDecoration: "underline", textUnderlineOffset: 3 }}
          onClick={onOpenBrandSetup}
        >
          Instagram oder Screenshots nutzen
        </button>
        {onSkipBrandProfile ? (
          <button
            type="button"
            className="studio-faint"
            style={{ fontSize: 12, textDecoration: "underline", textUnderlineOffset: 3 }}
            onClick={onSkipBrandProfile}
          >
            Ohne Profil fortfahren
          </button>
        ) : null}
      </div>
    </div>
  );
}



export function BrandProfileView({

  value,

  loaded,

  loadError,

  brandProfileComplete,

  brandProfileNotice,

  onOpenBrandSetup,

  onQuickAnalyze,

  onSkipBrandProfile,

  onResetBrandProfile,

  onChange,

  onSave,

}: {

  value: BrandSettings | null;

  loaded: boolean;

  loadError: string | null;

  brandProfileComplete: boolean;

  brandProfileNotice: string;

  onOpenBrandSetup: () => void;

  onQuickAnalyze?: (url: string) => void;

  onSkipBrandProfile: () => void;

  onResetBrandProfile: () => void | Promise<void>;

  onChange: (patch: Partial<BrandSettings>) => void;

  onSave: (patch?: Partial<BrandSettings>) => Promise<void>;

}) {

  const [saving, setSaving] = useState(false);

  const [resetting, setResetting] = useState(false);

  const [error, setError] = useState<string | null>(null);



  const mode = value?.brandProfileMode ?? "undecided";

  const skipped = mode === "skip";

  const hasBrandData = Boolean(

    value?.brandTone?.trim() &&

      value?.brandColors?.trim() &&

      value?.brandDos?.trim() &&

      value?.brandDonts?.trim() &&

      (value?.breweryName?.trim() || value?.brandWebsiteUrl?.trim()),

  );

  const active = !skipped && (brandProfileComplete || (value?.brandProfileMode === "guided" && hasBrandData));



  async function selectLock(id: BrandSettings["brandLockLevel"]) {

    if (!value || skipped || value.brandLockLevel === id) return;

    onChange({ brandLockLevel: id });

    setSaving(true);

    setError(null);

    try {

      await onSave({ brandLockLevel: id });

    } catch (e) {

      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");

    } finally {

      setSaving(false);

    }

  }



  if (!value) {
    return (
      <div className="studio-brand-page">
        {!loaded ? (
          <div className="studio-brand-skeleton" aria-busy="true" aria-label="Markenprofil wird geladen">
            <div className="studio-brand-skeleton__block">
              <div className="studio-brand-skeleton__line studio-brand-skeleton__line--title studio-brand-skeleton__shimmer" />
              <div className="studio-brand-skeleton__line studio-brand-skeleton__shimmer" />
              <div className="studio-brand-skeleton__line studio-brand-skeleton__line--short studio-brand-skeleton__shimmer" />
            </div>
            <div className="studio-brand-skeleton__block">
              <div className="studio-brand-skeleton__line studio-brand-skeleton__line--title studio-brand-skeleton__shimmer" />
              <div className="studio-brand-skeleton__line studio-brand-skeleton__shimmer" />
            </div>
          </div>
        ) : loadError ? (
          <div className="studio-brand-empty-card">
            <span style={{ color: "var(--warn)", fontWeight: 600 }}>{loadError}</span>
            <StudioButton type="button" variant="soft" size="sm" style={{ marginTop: 12 }} onClick={() => window.location.reload()}>
              Erneut versuchen
            </StudioButton>
          </div>
        ) : (
          <div className="studio-brand-empty-card">
            <span className="studio-faint">Keine Daten verfügbar.</span>
          </div>
        )}
      </div>
    );
  }



  if (skipped) {
    return (
      <div className="studio-brand-page">
        <header className="studio-brand-header">
          <div>
            <StudioEyebrow>Markenprofil · deaktiviert</StudioEyebrow>
            <h1 className="studio-brand-title">Markenprofil</h1>
            <p className="studio-brand-sub">Du generierst ohne festes Markenprofil. Du kannst jederzeit eine Website einlesen lassen.</p>
          </div>
          <StudioButton type="button" variant="primary" size="sm" onClick={onOpenBrandSetup}>
            Marke einlesen
          </StudioButton>
        </header>
        <BrandQuickStartCard onQuickAnalyze={onQuickAnalyze} onOpenBrandSetup={onOpenBrandSetup} />
      </div>
    );
  }

  if (!active) {
    return (
      <div className="studio-brand-page">
        <header className="studio-brand-header">
          <div>
            <StudioEyebrow>Markenprofil · ausstehend</StudioEyebrow>
            <h1 className="studio-brand-title">Markenprofil</h1>
            <p className="studio-brand-sub">
              Die Grundlage jeder Generierung — einmal sauber gepflegt, dauerhaft konsistente Motive.
            </p>
          </div>
          <StudioButton type="button" variant="primary" size="sm" onClick={onOpenBrandSetup}>
            Marke einlesen
          </StudioButton>
        </header>
        <BrandQuickStartCard
          onQuickAnalyze={onQuickAnalyze}
          onOpenBrandSetup={onOpenBrandSetup}
          onSkipBrandProfile={onSkipBrandProfile}
        />
      </div>
    );
  }



  const swatches = parseHexSwatches(value.brandColors);

  const tags = parseToneTags(value.brandTone);

  const rules = parseBildregeln(value.brandDos, value.brandDonts);

  const domain = value.brandWebsiteUrl ? formatDomain(value.brandWebsiteUrl) : value.breweryName || "beispiel.de";

  const analyzedLabel = formatAnalyzedLabel(value.brandAnalyzedAt, brandProfileNotice);



  return (
    <div className="studio-brand-page">
      <header className="studio-brand-header">
        <div>
          <StudioEyebrow dot="ok">Markenprofil · aktiv</StudioEyebrow>
          <h1 className="studio-brand-title">Markenprofil</h1>
          <p className="studio-brand-sub">
            BrewAI hat deine Website analysiert. Diese Vorgaben fließen automatisch in jede Generierung ein.
          </p>
        </div>
        <StudioButton type="button" variant="ghost" size="sm" onClick={onOpenBrandSetup}>
          <StudioIcon name="pencil" size={15} />
          Neu einlesen
        </StudioButton>
      </header>



      <div className="studio-brand-grid">

        <div className="studio-brand-stack">

          <StudioCard pad>

            <div className="studio-brand-website-head">

              <div className="studio-brand-website-left">

                <div className="studio-brand-website-icon ok">

                  <StudioIcon name="globe" size={18} />

                </div>

                <div style={{ minWidth: 0 }}>

                  <div className="studio-brand-domain">{domain}</div>

                  <div className="studio-brand-meta">{analyzedLabel}</div>

                </div>

              </div>

              {value.brandWebsiteUrl ? <StudioBadge tone="ok">Verbunden</StudioBadge> : null}

            </div>



            <div className="studio-hr studio-brand-divider" />



            <div className="studio-brand-section-label">Markenfarben</div>

            <div className="studio-brand-swatch-row">

              {swatches.map((color, i) => (

                <div key={`${color}-${i}`} className="studio-brand-swatch-bar" style={{ background: color }} title={color} />

              ))}

            </div>



            <div className="studio-brand-section-label studio-brand-tones-label">Tonalität</div>

            <div className="studio-brand-tags">

              {tags.length > 0 ? (

                tags.map((tag) => (

                  <span key={tag} className="studio-brand-tag">

                    {tag}

                  </span>

                ))

              ) : (

                <span className="studio-brand-tag">{value.brandTone || "—"}</span>

              )}

            </div>

          </StudioCard>



          <StudioCard pad className="studio-brand-rules-card">

            <div className="studio-brand-rules-head">

              <div className="studio-brand-rules-title">Bildregeln</div>

              <div className="studio-brand-rules-sub">Automatisch abgeleitet — jederzeit anpassbar.</div>

            </div>

            <div className="studio-brand-rule-row">

              <div className="studio-brand-rule-key">Bildlicht</div>

              <div className="studio-brand-rule-val">{rules.bildlicht}</div>

            </div>

            <div className="studio-brand-rule-row">

              <div className="studio-brand-rule-key">Komposition</div>

              <div className="studio-brand-rule-val">{rules.komposition}</div>

            </div>

            <div className="studio-brand-rule-row">

              <div className="studio-brand-rule-key">Tabu</div>

              <div className="studio-brand-rule-val">{rules.tabu}</div>

            </div>

          </StudioCard>

        </div>



        <StudioCard pad className="studio-brand-lock-card">

          <div className="studio-brand-lock-label">Brand-Lock</div>

          <p className="studio-brand-lock-desc">Wie streng BrewAI sich an dein Markenprofil hält.</p>

          <div className="studio-brand-lock-list studio-brand-lock-list--flat" role="radiogroup" aria-label="Brand-Lock Stufe">

            {LOCK_OPTIONS.map((opt) => (

              <button

                key={opt.id}

                type="button"

                role="radio"

                aria-checked={value.brandLockLevel === opt.id}

                disabled={saving}

                className={`studio-brand-lock-opt${value.brandLockLevel === opt.id ? " on" : ""}`}

                onClick={() => void selectLock(opt.id)}

              >

                <span className="studio-brand-lock-radio" aria-hidden="true" />

                <span>

                  <div className="studio-brand-lock-name">{opt.label}</div>

                  <div className="studio-brand-lock-sub">{opt.sub}</div>

                </span>

              </button>

            ))}

          </div>

          {error ? (

            <p style={{ marginTop: 10, fontSize: 12, color: "var(--warn)" }}>{error}</p>

          ) : saving ? (

            <p className="studio-faint" style={{ marginTop: 10, fontSize: 12 }}>

              Speichert…

            </p>

          ) : null}

        </StudioCard>

      </div>



      {value.brandReferenceImageUrls.length > 0 ? (

        <div className="studio-brand-refs-section">

          <div className="studio-brand-section-label">Referenzbilder</div>

          <div className="studio-brand-refs-grid">

            {value.brandReferenceImageUrls.map((url) => (

              <div key={url} className="studio-card studio-brand-ref-tile">

                {/* eslint-disable-next-line @next/next/no-img-element */}

                <img src={url} alt="" />

              </div>

            ))}

          </div>

        </div>

      ) : null}



      <StudioCard pad className="studio-brand-reset-card" style={{ marginTop: 20 }}>

        <div className="studio-brand-rules-title">Generisch weitermachen</div>

        <p className="studio-brand-rules-sub" style={{ marginTop: 6 }}>

          Markenprofil deaktivieren und gespeicherte Stil-Vorgaben entfernen. Neue Bilder werden ohne festes Markenprofil erzeugt.

        </p>

        <StudioButton

          type="button"

          variant="ghost"

          size="sm"

          disabled={resetting || saving}

          style={{ marginTop: 14, color: "var(--warn)" }}

          onClick={() => {

            const confirmed = window.confirm(

              "Markenprofil wirklich löschen und generisch weitermachen? Gespeicherte Farben, Tonalität und Bildregeln werden entfernt.",

            );

            if (!confirmed) return;

            setResetting(true);

            setError(null);

            void Promise.resolve(onResetBrandProfile())

              .catch((e) => {

                setError(e instanceof Error ? e.message : "Zurücksetzen fehlgeschlagen.");

              })

              .finally(() => {

                setResetting(false);

              });

          }}

        >

          {resetting ? "Wird zurückgesetzt…" : "Markenprofil löschen"}

        </StudioButton>

      </StudioCard>

    </div>

  );

}

