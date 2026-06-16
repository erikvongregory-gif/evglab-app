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



export function BrandProfileView({

  value,

  loaded,

  loadError,

  brandProfileComplete,

  brandProfileNotice,

  onOpenBrandSetup,

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

      <div className="studio-pop">

        <StudioCard pad>

          {!loaded ? (

            <span className="studio-faint">Lade Markenprofil…</span>

          ) : loadError ? (

            <>

              <span style={{ color: "var(--warn)", fontWeight: 600 }}>{loadError}</span>

              <StudioButton type="button" variant="soft" size="sm" style={{ marginTop: 12 }} onClick={() => window.location.reload()}>

                Erneut versuchen

              </StudioButton>

            </>

          ) : (

            <span className="studio-faint">Keine Daten verfügbar.</span>

          )}

        </StudioCard>

      </div>

    );

  }



  if (skipped) {

    return (

      <div className="studio-pop">

        <header className="studio-brand-header">

          <div>

            <StudioEyebrow>Markenprofil · deaktiviert</StudioEyebrow>

            <h1 className="studio-brand-title">Marke & Stil</h1>

            <p className="studio-brand-sub">Du generierst ohne festes Markenprofil. Du kannst jederzeit eine Website einlesen lassen.</p>

          </div>

          <StudioButton type="button" variant="primary" size="sm" onClick={onOpenBrandSetup}>

            Marke einlesen

          </StudioButton>

        </header>

        <StudioCard pad>

          <StudioButton type="button" variant="ghost" size="sm" onClick={onOpenBrandSetup}>

            Markenprofil anlegen

          </StudioButton>

        </StudioCard>

      </div>

    );

  }



  if (!active) {

    return (

      <div className="studio-pop">

        <header className="studio-brand-header">

          <div>

            <StudioEyebrow>Markenprofil · ausstehend</StudioEyebrow>

            <h1 className="studio-brand-title">Marke & Stil</h1>

            <p className="studio-brand-sub">

              Gib die Website deiner Marke ein — EvGlab erkennt Tonalität, Farben und Bildsprache für konsistente Motive.

            </p>

          </div>

          <StudioButton type="button" variant="primary" size="sm" onClick={onOpenBrandSetup}>

            Marke einlesen

          </StudioButton>

        </header>

        <StudioCard pad style={{ textAlign: "center" }}>

          <p className="studio-muted" style={{ fontSize: 14, lineHeight: 1.5 }}>

            Noch kein Markenprofil aktiv. Ein Link zu deiner Website reicht für den ersten Scan.

          </p>

          <div style={{ marginTop: 16, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>

            <StudioButton type="button" variant="primary" onClick={onOpenBrandSetup}>

              Website analysieren

            </StudioButton>

            <StudioButton type="button" variant="ghost" size="sm" onClick={onSkipBrandProfile}>

              Ohne Profil fortfahren

            </StudioButton>

          </div>

        </StudioCard>

      </div>

    );

  }



  const swatches = parseHexSwatches(value.brandColors);

  const tags = parseToneTags(value.brandTone);

  const rules = parseBildregeln(value.brandDos, value.brandDonts);

  const domain = value.brandWebsiteUrl ? formatDomain(value.brandWebsiteUrl) : value.breweryName || "beispiel.de";

  const analyzedLabel = formatAnalyzedLabel(value.brandAnalyzedAt, brandProfileNotice);



  return (

    <div className="studio-pop">

      <header className="studio-brand-header">

        <div>

          <StudioEyebrow dot="ok">Markenprofil · Aktiv</StudioEyebrow>

          <h1 className="studio-brand-title">Marke & Stil</h1>

          <p className="studio-brand-sub">

            EvGlab hat deine Website analysiert. Diese Vorgaben fließen automatisch in jede Generierung ein.

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

          <p className="studio-brand-lock-desc">Wie streng EvGlab sich an dein Markenprofil hält.</p>

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

