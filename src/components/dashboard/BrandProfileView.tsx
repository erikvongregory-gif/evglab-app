"use client";

import React, { useEffect, useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { BrandingCard } from "@/components/ui/branding-card";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { ColorPaletteCard } from "@/components/ui/color-palette-card";
import FileUpload from "@/components/ui/file-upload";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProgressBar } from "@/components/ui/progress-bar";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { StudioIcon } from "@/components/studio/icons";
import { StudioButton, StudioPageHeader } from "@/components/studio/ui";
import {
  computeProfileStrength,
  formatDomain,
  parseBildregeln,
  parseHexSwatches,
  parseToneTags,
} from "@/lib/brand/brand-profile-display";
import { BrandCharactersSection } from "@/components/dashboard/BrandCharactersSection";

const BRAND_FONT_FAMILY = "BrewAiBrandHeadline";

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
  brandHeadlineFontName?: string;
  brandFontFileUrl?: string;
  brandFontWeight?: string;
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

function BrandQuickStart({
  onQuickAnalyze,
  onOpenBrandSetup,
  onSkipBrandProfile,
}: {
  onQuickAnalyze?: (url: string) => void;
  onOpenBrandSetup: () => void;
  onSkipBrandProfile?: () => void;
}) {
  const [url, setUrl] = useState("");
  const inputId = useId();

  const submit = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (onQuickAnalyze) onQuickAnalyze(trimmed);
    else onOpenBrandSetup();
  };

  return (
    <div className="studio-brand-quick">
      <div className="studio-brand-quick__copy">
        <div className="studio-brand-quick__t">Website einlesen</div>
        <p className="studio-brand-quick__s">
          Ein Link genügt — BrewAI erstellt daraus Farben, Tonalität und Bildregeln.
        </p>
      </div>
      <form
        className="studio-brand-quick__form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Input
          id={inputId}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="www.deine-brauerei.de"
          inputMode="url"
          autoComplete="url"
          aria-label="Website deiner Marke"
          className="h-11"
        />
        <StudioButton type="submit" variant="primary" disabled={!url.trim()}>
          Profil erstellen
        </StudioButton>
      </form>
      <div className="studio-brand-quick__alt">
        <button type="button" onClick={onOpenBrandSetup}>
          Instagram oder Screenshots
        </button>
        {onSkipBrandProfile ? (
          <button type="button" onClick={onSkipBrandProfile}>
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
  const [fontUploadError, setFontUploadError] = useState<string | null>(null);
  const [fontReady, setFontReady] = useState(false);
  const fontFieldId = useId();
  const lockId = useId();

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

  async function uploadFont(file: File) {
    if (!value) throw new Error("Kein Markenprofil geladen.");
    setFontUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("fontName", value.brandHeadlineFontName?.trim() || file.name.replace(/\.[^.]+$/, ""));
      const res = await fetch("/api/dashboard/brand-font", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const json = (await res.json()) as { error?: string; url?: string; fontName?: string };
      if (!res.ok) throw new Error(json.error ?? "Schrift-Upload fehlgeschlagen.");
      const patch = {
        brandFontFileUrl: json.url ?? "",
        brandHeadlineFontName: json.fontName ?? value.brandHeadlineFontName,
      };
      onChange(patch);
      await onSave(patch);
    } catch (uploadErr) {
      const message = uploadErr instanceof Error ? uploadErr.message : "Schrift-Upload fehlgeschlagen.";
      setFontUploadError(message);
      throw uploadErr instanceof Error ? uploadErr : new Error(message);
    }
  }

  async function clearFont() {
    if (!value) return;
    const patch = { brandFontFileUrl: "", brandHeadlineFontName: value.brandHeadlineFontName ?? "" };
    onChange(patch);
    setFontReady(false);
    try {
      await onSave(patch);
    } catch (e) {
      setFontUploadError(e instanceof Error ? e.message : "Schrift konnte nicht entfernt werden.");
    }
  }

  useEffect(() => {
    const url = value?.brandFontFileUrl?.trim();
    if (!url || typeof document === "undefined") {
      setFontReady(false);
      return;
    }
    let cancelled = false;
    const face = new FontFace(BRAND_FONT_FAMILY, `url(${JSON.stringify(url)})`, {
      weight: "100 900",
      style: "normal",
      display: "swap",
    });
    void face
      .load()
      .then((loaded) => {
        if (cancelled) return;
        document.fonts.add(loaded);
        setFontReady(true);
      })
      .catch(() => {
        if (!cancelled) setFontReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, [value?.brandFontFileUrl]);

  if (!value) {
    return (
      <div className="studio-brand-page">
        {!loaded ? (
          <div className="studio-brand-skeleton" aria-busy="true" aria-label="Markenprofil wird geladen">
            <div className="studio-brand-skeleton__board studio-brand-skeleton__shimmer" />
            <div className="studio-brand-skeleton__rows">
              <div className="studio-brand-skeleton__line studio-brand-skeleton__shimmer" />
              <div className="studio-brand-skeleton__line studio-brand-skeleton__shimmer" />
            </div>
          </div>
        ) : loadError ? (
          <div className="studio-brand-quick">
            <div className="studio-brand-quick__copy">
              <div className="studio-brand-quick__t" style={{ color: "var(--warn)" }}>
                {loadError}
              </div>
            </div>
            <StudioButton type="button" variant="ghost" size="sm" onClick={() => window.location.reload()}>
              Erneut versuchen
            </StudioButton>
          </div>
        ) : (
          <p className="studio-faint">Keine Daten verfügbar.</p>
        )}
      </div>
    );
  }

  if (skipped || !active) {
    return (
      <div className="studio-brand-page">
        <StudioPageHeader
          eyebrow={skipped ? "Markenprofil · deaktiviert" : "Markenprofil · ausstehend"}
          title="Markenprofil"
          subtitle={
            skipped
              ? "Du generierst ohne festes Markenprofil. Du kannst jederzeit eine Website einlesen lassen."
              : "Die Grundlage jeder Generierung — einmal sauber gepflegt, dauerhaft konsistente Motive."
          }
          action={
            <StudioButton type="button" variant="primary" size="sm" onClick={onOpenBrandSetup}>
              Marke einlesen
            </StudioButton>
          }
        />
        <BrandQuickStart
          onQuickAnalyze={onQuickAnalyze}
          onOpenBrandSetup={onOpenBrandSetup}
          onSkipBrandProfile={skipped ? undefined : onSkipBrandProfile}
        />
      </div>
    );
  }

  const swatches = parseHexSwatches(value.brandColors);
  const hexOnly = swatches.map((c) => c.replace(/^#/, ""));
  const tags = parseToneTags(value.brandTone);
  const rules = parseBildregeln(value.brandDos, value.brandDonts);
  const domain = value.brandWebsiteUrl
    ? formatDomain(value.brandWebsiteUrl)
    : value.breweryName || "beispiel.de";
  const analyzedLabel = formatAnalyzedLabel(value.brandAnalyzedAt, brandProfileNotice);
  const fontName = value.brandHeadlineFontName?.trim() || "Markenschrift";
  const strength = computeProfileStrength({
    breweryName: value.breweryName,
    brandTone: value.brandTone,
    brandColors: value.brandColors,
    brandDos: value.brandDos,
    brandDonts: value.brandDonts,
    referenceImageCount: value.brandReferenceImageUrls.length,
  });

  return (
    <div className="studio-brand-page">
      <StudioPageHeader
        eyebrow="Markenprofil · aktiv"
        title={value.breweryName.trim() || "Markenprofil"}
        subtitle="Diese Vorgaben fließen automatisch in jede Generierung ein."
        action={
          <StudioButton type="button" variant="ghost" size="sm" onClick={onOpenBrandSetup}>
            <StudioIcon name="pencil" size={15} />
            Neu einlesen
          </StudioButton>
        }
      />

      {/* 21st Branding Card + Color Palette Card */}
      <div className="studio-brand-21st">
        <BrandingCard
          category="Branding"
          title="Typography"
          subtitle={fontName}
          displayElement={
            <span>
              Aa<span className="text-white/40">Bb</span>
            </span>
          }
          colors={swatches}
          className="border-neutral-800 bg-[#1c1c1c] text-white shadow-none hover:shadow-xl [&_.text-muted-foreground]:text-neutral-400"
        />
        <ColorPaletteCard
          colors={hexOnly}
          statsText={`${domain} · ${analyzedLabel}`}
          className="border border-[var(--line)] bg-[var(--s1)] shadow-sm"
          icon={
            value.brandWebsiteUrl ? (
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--ok)]">Verbunden</span>
            ) : undefined
          }
        />
      </div>

      <div className="mb-8 max-w-md">
        <ProgressBar
          value={strength.percent}
          label={`Profilstärke · ${strength.label}`}
          completeLabel="Sehr stark"
        />
      </div>

      <div className="studio-brand-layout">
        <div className="studio-brand-main">
          <section className="studio-brand-sec space-y-5">
            <div className="studio-brand-sec__head">
              <h2>Vorgaben</h2>
            </div>

            <div className="relative w-full rounded-[14px] border border-[var(--line)] bg-[var(--s1)] p-5">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--t3)]">
                      Marken-Schrift
                    </p>
                    <p className="mt-1 text-sm text-[var(--t3)]">Live-Vorschau für Bildexporte</p>
                  </div>
                  {value.brandFontFileUrl ? (
                    <Badge variant="outline" className="border-[var(--ok)] text-[var(--ok)]">
                      Aktiv
                    </Badge>
                  ) : null}
                </div>

                <div
                  className="rounded-xl border border-[var(--line)] bg-[var(--s2)] px-5 py-6"
                  style={
                    fontReady
                      ? { fontFamily: `"${BRAND_FONT_FAMILY}", var(--font-sans, system-ui)` }
                      : undefined
                  }
                >
                  <div className="flex items-end justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--t3)]">
                        Typography
                      </p>
                      <p className="mt-1 truncate text-lg font-semibold text-[var(--t1)]">{fontName}</p>
                      <p className="mt-1 text-sm text-[var(--t3)]">
                        {value.brandFontFileUrl
                          ? fontReady
                            ? "Eigene Datei geladen"
                            : "Schrift wird vorbereitet …"
                          : "Noch System-Fallback (Work Sans)"}
                      </p>
                    </div>
                    <span
                      className="shrink-0 text-5xl font-bold tracking-tighter text-[var(--t1)]"
                      aria-hidden
                    >
                      Aa
                      <span className="text-[var(--t3)]">Bb</span>
                    </span>
                  </div>
                  <p className="mt-5 text-[1.35rem] leading-snug tracking-tight text-[var(--t1)]">
                    Die Brauerei braut Charakter.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={fontFieldId} className="text-xs text-[var(--t3)]">
                    Schriftname
                  </Label>
                  <Input
                    id={fontFieldId}
                    placeholder="z. B. Work Sans"
                    value={value.brandHeadlineFontName ?? ""}
                    onChange={(e) => onChange({ brandHeadlineFontName: e.target.value })}
                    onBlur={() => void onSave({ brandHeadlineFontName: value.brandHeadlineFontName })}
                    className="h-11 text-[15px]"
                  />
                </div>

                <FileUpload
                  multiple={false}
                  maxFiles={1}
                  accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf"
                  titleIdle="Schrift hochladen"
                  titleDragging="Schrift hier ablegen"
                  titleHasFiles="Andere Schrift wählen"
                  hint="Loslassen zum Hochladen"
                  supportHint=".woff2, .woff, .ttf, .otf · max. 2 MB"
                  uploadedLabel="Schriftdatei"
                  clearAllLabel="Entfernen"
                  onUpload={async (file) => {
                    await uploadFont(file);
                  }}
                  onRemove={() => void clearFont()}
                  onClearAll={() => void clearFont()}
                />
                {fontUploadError ? (
                  <p className="studio-brand-inline-error" role="alert">
                    {fontUploadError}
                  </p>
                ) : null}
              </div>
            </div>

            <Card size="sm" className="border-[var(--line)] bg-[var(--s1)] shadow-none ring-0">
              <CardHeader className="gap-1">
                <CardDescription className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--t3)]">
                  Tonalität
                </CardDescription>
                <p className="text-sm text-[var(--t3)]">Stimme der Marke</p>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {(tags.length > 0 ? tags : [value.brandTone || "—"]).map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="h-auto rounded-full border-[var(--line2)] bg-[var(--s2)] px-3.5 py-1.5 text-sm font-medium text-[var(--t1)]"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="studio-brand-sec space-y-4">
            <div className="studio-brand-sec__head">
              <h2>Bildregeln</h2>
              <span className="studio-brand-sec__note">Abgeleitet · anpassbar</span>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {(
                [
                  { key: "Bildlicht", val: rules.bildlicht },
                  { key: "Komposition", val: rules.komposition },
                  { key: "Tabu", val: rules.tabu },
                ] as const
              ).map((rule) => (
                <Card
                  key={rule.key}
                  size="sm"
                  className="origin-center border-[var(--line)] bg-[var(--s1)] shadow-none ring-1 ring-foreground/10 transition-[transform,box-shadow,ring-color] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-[1.02] hover:shadow-sm hover:ring-foreground/15 motion-reduce:transition-none motion-reduce:hover:scale-100"
                >
                  <CardHeader className="gap-0 pb-0">
                    <CardDescription className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--ac)]">
                      {rule.key}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-[14px] leading-relaxed text-[var(--t2)]">{rule.val}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {value.brandReferenceImageUrls.length > 0 ? (
            <section className="studio-brand-sec">
              <div className="studio-brand-sec__head">
                <h2>Referenzbilder</h2>
              </div>
              <div className="studio-brand-refs-grid">
                {value.brandReferenceImageUrls.map((url) => (
                  <div key={url} className="studio-brand-ref-tile">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" />
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <BrandCharactersSection />

          <div className="studio-brand-danger">
            <div>
              <div className="studio-brand-danger__t">Generisch weitermachen</div>
              <p className="studio-brand-danger__s">
                Profil deaktivieren und Stil-Vorgaben entfernen. Neue Bilder ohne festes Markenprofil.
              </p>
            </div>
            <StudioButton
              type="button"
              variant="ghost"
              size="sm"
              disabled={resetting || saving}
              className="evg-btn--danger"
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
                  .finally(() => setResetting(false));
              }}
            >
              {resetting ? "Wird zurückgesetzt…" : "Markenprofil löschen"}
            </StudioButton>
          </div>
        </div>

        {/* 21st OriginUI segmented radio cards */}
        <aside className="studio-brand-aside">
          <fieldset className="space-y-4">
            <legend className="text-sm font-medium leading-none">Brand-Lock</legend>
            <p className="studio-brand-aside__desc">Wie streng BrewAI sich an dein Markenprofil hält.</p>
            <RadioGroup
              className="flex flex-col gap-2"
              value={value.brandLockLevel}
              onValueChange={(v) => void selectLock(v as BrandSettings["brandLockLevel"])}
              disabled={saving}
            >
              {LOCK_OPTIONS.map((opt) => (
                <div
                  key={opt.id}
                  className="relative flex flex-col gap-1 rounded-lg border border-input p-3 shadow-sm shadow-black/5 has-[[data-state=checked]]:border-ring"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem
                      id={`${lockId}-${opt.id}`}
                      value={opt.id}
                      className="after:absolute after:inset-0"
                    />
                    <Label htmlFor={`${lockId}-${opt.id}`} className="font-medium">
                      {opt.label}
                    </Label>
                  </div>
                  <p className="pl-6 text-xs text-muted-foreground">{opt.sub}</p>
                </div>
              ))}
            </RadioGroup>
            {error ? (
              <p className="studio-brand-inline-error">{error}</p>
            ) : saving ? (
              <p className="text-xs text-muted-foreground">Speichert…</p>
            ) : null}
          </fieldset>
        </aside>
      </div>
    </div>
  );
}
