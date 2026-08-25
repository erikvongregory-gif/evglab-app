"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { StudioPalette } from "@/components/ui/dashboard-studio-shell";
import { STUDIO_TOKENS } from "@/components/ui/dashboard-studio-shell";
import { StudioIcon } from "@/components/studio/icons";
import { hasUsableBeerEtikett, type DashboardBeer } from "@/lib/dashboard/metadata";
import { FLASCHEN_TYPEN } from "@/app/(dashboard)/inhalte-erstellen/lib/brewing-knowledge";
import {
  BEER_STYLE_OPTIONS,
  beerStyleLabel,
} from "@/app/(dashboard)/inhalte-erstellen/lib/beer-styles";
import {
  OCCASION_TEMPLATES,
  seasonBadgeLabel,
  sortTemplatesForDate,
  type OccasionTemplate,
} from "@/app/(dashboard)/inhalte-erstellen/lib/occasion-templates";
import { readAndCompressImage, splitDataUrl } from "@/lib/images/compress-image";

const FLASCHEN_CHOICES = Object.entries(FLASCHEN_TYPEN).map(([code, item]) => ({
  code,
  label: item.pillLabel,
}));

const FARBE_CHOICES = [
  { code: "braun" as const, label: "Braun" },
  { code: "gruen" as const, label: "Grün" },
  { code: "klar" as const, label: "Klar" },
];

type BeerDraft = {
  name: string;
  bierstil: string;
  flaschenTyp: string;
  flaschenfarbe: "braun" | "gruen" | "klar";
  etikettDataUrl: string;
  etikettName: string;
};

const EMPTY_DRAFT: BeerDraft = {
  name: "",
  bierstil: "helles",
  flaschenTyp: "nrw_500",
  flaschenfarbe: "braun",
  etikettDataUrl: "",
  etikettName: "",
};

function flaschenLabel(code: string): string {
  return FLASCHEN_CHOICES.find((f) => f.code === code)?.label ?? code;
}

function beerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join("") || "B";
}

export function InhalteErstellenStart({
  P,
  breweryName,
  selectedBeerId,
  onSelectBeer,
  onPickTemplate,
  onPickCustom,
}: {
  P: StudioPalette;
  breweryName: string;
  selectedBeerId: string | null;
  onSelectBeer: (beer: DashboardBeer | null) => void;
  onPickTemplate: (template: OccasionTemplate) => void;
  onPickCustom: () => void;
}) {
  const [beers, setBeers] = useState<DashboardBeer[]>([]);
  const [beersLoaded, setBeersLoaded] = useState(false);
  const [beersError, setBeersError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<BeerDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const sortedTemplates = useMemo(() => sortTemplatesForDate(OCCASION_TEMPLATES, new Date()), []);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch("/api/dashboard/my-beers", { cache: "no-store", credentials: "include" });
        if (ignore) return;
        if (res.ok) {
          const json = (await res.json()) as { beers?: DashboardBeer[] };
          const loaded = Array.isArray(json.beers) ? json.beers : [];
          setBeers(loaded);
          if (loaded.length > 0 && !selectedBeerId) onSelectBeer(loaded[0]);
        }
      } catch {
        if (!ignore) setBeersError("Sortiment konnte nicht geladen werden.");
      } finally {
        if (!ignore) setBeersLoaded(true);
      }
    })();
    return () => {
      ignore = true;
    };
    // Nur einmal beim Mount laden — die Auswahl-Synchronisation läuft über Props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistBeers = useCallback(
    async (next: Array<DashboardBeer & { etikettPayload?: { base64: string; mime: string } }>) => {
      const res = await fetch("/api/dashboard/my-beers", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ beers: next }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string; beers?: DashboardBeer[] } | null;
      if (!res.ok) throw new Error(json?.error ?? "Speichern fehlgeschlagen.");
      return Array.isArray(json?.beers) ? json.beers : [];
    },
    [],
  );

  const handleSaveDraft = useCallback(async () => {
    const name = draft.name.trim();
    if (!name) {
      setFormError("Bitte gib deinem Bier einen Namen.");
      return;
    }
    if (!draft.etikettDataUrl) {
      setFormError("Bitte lade ein Flaschenfoto mit Etikett hoch — das wird 1:1 ins generierte Bild übernommen.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const payload = draft.etikettDataUrl ? splitDataUrl(draft.etikettDataUrl) : null;
      const newBeer = {
        id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `beer-${Date.now()}`,
        name,
        bierstil: draft.bierstil,
        flaschenTyp: draft.flaschenTyp,
        flaschenfarbe: draft.flaschenfarbe,
        etikettUrl: "",
        createdAt: new Date().toISOString(),
        ...(payload ? { etikettPayload: payload } : {}),
      };
      const saved = await persistBeers([...beers, newBeer]);
      setBeers(saved);
      const created = saved.find((b) => b.id === newBeer.id) ?? saved[saved.length - 1] ?? null;
      if (created) onSelectBeer(created);
      setDraft(EMPTY_DRAFT);
      setFormOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }, [beers, draft, onSelectBeer, persistBeers]);

  const handleDeleteBeer = useCallback(
    async (beer: DashboardBeer) => {
      if (!window.confirm(`„${beer.name}“ aus dem Sortiment entfernen?`)) return;
      const next = beers.filter((b) => b.id !== beer.id);
      try {
        const saved = await persistBeers(next);
        setBeers(saved);
        if (selectedBeerId === beer.id) onSelectBeer(saved[0] ?? null);
      } catch (err) {
        setBeersError(err instanceof Error ? err.message : "Löschen fehlgeschlagen.");
      }
    },
    [beers, onSelectBeer, persistBeers, selectedBeerId],
  );

  const handleEtikettFile = useCallback(async (file: File) => {
    setFormError("");
    try {
      if (!file.type.startsWith("image/")) throw new Error("Bitte ein Bild auswählen (PNG, JPG, WEBP).");
      if (file.size > 12 * 1024 * 1024) throw new Error("Datei zu groß — bitte unter 12 MB.");
      const dataUrl = await readAndCompressImage(file);
      setDraft((d) => ({ ...d, etikettDataUrl: dataUrl, etikettName: file.name }));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Upload fehlgeschlagen.");
    }
  }, []);

  const handleAttachEtikett = useCallback(
    async (beer: DashboardBeer, file: File) => {
      setBeersError("");
      try {
        const dataUrl = await readAndCompressImage(file);
        const payload = splitDataUrl(dataUrl);
        if (!payload) throw new Error("Bild konnte nicht gelesen werden.");
        const saved = await persistBeers(
          beers.map((b) => (b.id === beer.id ? { ...b, etikettPayload: payload } : b)),
        );
        setBeers(saved);
        const updated = saved.find((b) => b.id === beer.id);
        if (updated) onSelectBeer(updated);
      } catch (err) {
        setBeersError(err instanceof Error ? err.message : "Etikett konnte nicht gespeichert werden.");
      }
    },
    [beers, onSelectBeer, persistBeers],
  );

  const handlePickTemplate = useCallback(
    (template: OccasionTemplate) => {
      const beer = beers.find((b) => b.id === selectedBeerId);
      if (beer && !hasUsableBeerEtikett(beer.etikettUrl)) {
        setBeersError(
          `„${beer.name}“ braucht ein Flaschenfoto mit Etikett. Bitte oben hochladen — genau dieses Etikett kommt 1:1 ins Bild.`,
        );
        return;
      }
      setBeersError("");
      onPickTemplate(template);
    },
    [beers, onPickTemplate, selectedBeerId],
  );

  const greeting = breweryName ? `Was zeigen wir heute, ${breweryName}?` : "Was zeigen wir heute?";

  return (
    <div className="studio-create-start">
      <header className="studio-create-start-head">
        <span className="studio-eyebrow">Bilder erstellen</span>
        <h1 style={{ fontFamily: STUDIO_TOKENS.serif ?? STUDIO_TOKENS.sans }}>{greeting}</h1>
        <p>
          Bier wählen, Anlass antippen — Szene, Licht und Markenstil übernimmt die KI. Feinjustieren kannst du
          jederzeit vor dem Generieren.
        </p>
      </header>

      <section className="studio-create-section">
        <div className="studio-create-section-head">
          <h2>Dein Bier</h2>
          <span>Einmal anlegen — Stil, Flasche und Etikett sind ab dann immer vorausgefüllt.</span>
        </div>

        <div className="studio-beer-row" role="listbox" aria-label="Sortiment">
          {!beersLoaded ? (
            <div className="studio-beer-card studio-beer-card--ghost" aria-hidden="true" />
          ) : (
            beers.map((beer) => {
              const active = beer.id === selectedBeerId;
              return (
                <div key={beer.id} className={active ? "studio-beer-card on" : "studio-beer-card"}>
                  <button
                    type="button"
                    className="studio-beer-card-main"
                    role="option"
                    aria-selected={active}
                    onClick={() => onSelectBeer(active ? null : beer)}
                  >
                    {beer.etikettUrl ? (
                      <span className="studio-beer-thumb">
                        <img src={beer.etikettUrl} alt="" loading="lazy" />
                      </span>
                    ) : (
                      <span className="studio-beer-thumb studio-beer-thumb--initials">{beerInitials(beer.name)}</span>
                    )}
                    <span className="studio-beer-card-text">
                      <strong>{beer.name}</strong>
                      <small>
                        {beerStyleLabel(beer.bierstil)} · {flaschenLabel(beer.flaschenTyp)}
                      </small>
                    </span>
                    {active ? (
                      <span className="studio-beer-card-check" aria-hidden="true">
                        <StudioIcon name="check" size={13} />
                      </span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    className="studio-beer-card-remove"
                    aria-label={`${beer.name} entfernen`}
                    onClick={() => void handleDeleteBeer(beer)}
                  >
                    <StudioIcon name="x" size={12} />
                  </button>
                  {!hasUsableBeerEtikett(beer.etikettUrl) ? (
                    <label className="studio-beer-card-etikett">
                      {beer.etikettUrl ? "Etikett erneut hochladen" : "Etikett hochladen"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        style={{ display: "none" }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void handleAttachEtikett(beer, file);
                          e.currentTarget.value = "";
                        }}
                      />
                    </label>
                  ) : null}
                </div>
              );
            })
          )}

          {beersLoaded && beers.length < 8 ? (
            <button
              type="button"
              className="studio-beer-card studio-beer-card--add"
              onClick={() => {
                setFormOpen((v) => !v);
                setFormError("");
              }}
            >
              <span className="studio-beer-thumb studio-beer-thumb--add">
                <StudioIcon name="plus" size={16} />
              </span>
              <span className="studio-beer-card-text">
                <strong>{beers.length === 0 ? "Erstes Bier anlegen" : "Bier hinzufügen"}</strong>
                <small>{beers.length === 0 ? "Dein Sortiment, ein Klick" : `${beers.length} von 8 angelegt`}</small>
              </span>
            </button>
          ) : null}
        </div>

        {beersError ? (
          <p className="studio-create-error" role="alert">
            {beersError}
          </p>
        ) : null}

        {formOpen ? (
          <div className="studio-beer-form">
            <div className="studio-beer-form-grid">
              <label className="studio-beer-form-field studio-beer-form-field--wide">
                <span className="studio-field-label">Name der Sorte</span>
                <input
                  type="text"
                  value={draft.name}
                  maxLength={80}
                  placeholder="z. B. Falter Hell"
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleSaveDraft();
                  }}
                />
              </label>
              <label className="studio-beer-form-field">
                <span className="studio-field-label">Bierstil</span>
                <select
                  value={draft.bierstil}
                  onChange={(e) => setDraft((d) => ({ ...d, bierstil: e.target.value }))}
                >
                  {BEER_STYLE_OPTIONS.map((o) => (
                    <option key={o.bierstil} value={o.bierstil}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="studio-beer-form-field">
                <span className="studio-field-label">Flasche / Dose</span>
                <select
                  value={draft.flaschenTyp}
                  onChange={(e) => setDraft((d) => ({ ...d, flaschenTyp: e.target.value }))}
                >
                  {FLASCHEN_CHOICES.map((o) => (
                    <option key={o.code} value={o.code}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="studio-beer-form-field">
                <span className="studio-field-label">Glasfarbe</span>
                <div className="studio-beer-form-pills">
                  {FARBE_CHOICES.map((o) => (
                    <button
                      key={o.code}
                      type="button"
                      className={draft.flaschenfarbe === o.code ? "studio-chip on" : "studio-chip"}
                      onClick={() => setDraft((d) => ({ ...d, flaschenfarbe: o.code }))}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="studio-beer-form-field">
                <span className="studio-field-label">Etikett (Pflicht)</span>
                <div className="studio-beer-form-pills">
                  <label className="studio-chip" style={{ cursor: "pointer" }}>
                    {draft.etikettName ? "Anderes Bild" : "Etikett hochladen"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleEtikettFile(file);
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>
                  {draft.etikettDataUrl ? (
                    <span className="studio-beer-form-etikett-preview">
                      <img src={draft.etikettDataUrl} alt="Etikett Vorschau" />
                    </span>
                  ) : (
                    <small style={{ color: P.ink3, alignSelf: "center" }}>Flaschenfoto mit lesbarem Etikett — wird 1:1 übernommen.</small>
                  )}
                </div>
              </div>
            </div>
            {formError ? (
              <p className="studio-create-error" role="alert">
                {formError}
              </p>
            ) : null}
            <div className="studio-beer-form-actions">
              <button type="button" className="studio-btn studio-btn-primary studio-btn-sm" disabled={saving} onClick={() => void handleSaveDraft()}>
                {saving ? "Speichere …" : "Bier speichern"}
              </button>
              <button
                type="button"
                className="studio-btn studio-btn-ghost studio-btn-sm"
                disabled={saving}
                onClick={() => {
                  setFormOpen(false);
                  setFormError("");
                }}
              >
                Abbrechen
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="studio-create-section">
        <div className="studio-create-section-head">
          <h2>Anlass wählen</h2>
          <span>Saisonales steht automatisch vorn — ein Klick, und alles ist eingestellt.</span>
        </div>

        <div className="studio-occasion-grid">
          {sortedTemplates.map(({ template, status }) => {
            const badge = seasonBadgeLabel(status);
            return (
              <button
                key={template.id}
                type="button"
                className={status.state === "off" ? "studio-occasion-card is-off" : "studio-occasion-card"}
                style={{ ["--occasion-accent" as string]: template.accent }}
                onClick={() => handlePickTemplate(template)}
              >
                <span className="studio-occasion-card-top">
                  <span className="studio-occasion-icon" aria-hidden="true">
                    <StudioIcon name={template.icon} size={16} />
                  </span>
                  {badge ? <span className="studio-occasion-badge">{badge}</span> : null}
                </span>
                <span className="studio-occasion-card-body">
                  <strong>{template.title}</strong>
                  <em>{template.subtitle}</em>
                  <small>{template.motifLine}</small>
                </span>
                <span className="studio-occasion-card-cta">
                  Direkt zum Check
                  <StudioIcon name="arrowR" size={13} />
                </span>
              </button>
            );
          })}

          <button type="button" className="studio-occasion-card studio-occasion-card--custom" onClick={onPickCustom}>
            <span className="studio-occasion-card-top">
              <span className="studio-occasion-icon" aria-hidden="true">
                <StudioIcon name="plus" size={16} />
              </span>
            </span>
            <span className="studio-occasion-card-body">
              <strong>Eigenes Motiv</strong>
              <em>Profi-Modus</em>
              <small>Alle Optionen Schritt für Schritt selbst wählen — Szene, Personen, Licht, Kamera.</small>
            </span>
            <span className="studio-occasion-card-cta">
              Wizard starten
              <StudioIcon name="arrowR" size={13} />
            </span>
          </button>
        </div>
      </section>
    </div>
  );
}
