"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { StudioButton, StudioIconButton } from "@/components/studio/ui";
import { StudioIcon } from "@/components/studio/icons";
import { getMediaDisplayTitle } from "@/lib/dashboard/metadata";
import type { StudioPalette } from "@/components/ui/dashboard-studio-shell";

export type MediaItem = {
  id: string;
  imageUrl: string;
  title?: string;
  prompt: string;
  createdAt: string;
  aspectRatio: string;
  resolution: "1K" | "2K" | "4K";
  outputFormat: "png" | "jpg";
  generation?: { chargeNumber?: number | null } | null;
};

const STUDIO_EASE = [0.22, 0.68, 0.2, 1] as const;
const MEDIA_LIGHTBOX_SPRING = { type: "spring" as const, stiffness: 420, damping: 36, mass: 0.85 };

function clampText(v: string, max: number) {
  const s = (v ?? "").trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function formatRelativeTime(iso: string) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diffMs = Date.now() - t;
  if (diffMs < 60_000) return "gerade eben";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `vor ${mins} Min.`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "gestern";
  return `vor ${days} Tagen`;
}

export function getMediaAssetUrl(item: MediaItem): string {
  if (item.imageUrl.startsWith("data:") || item.imageUrl.startsWith("/api/kie/download?")) {
    return item.imageUrl;
  }
  return `/api/kie/download?url=${encodeURIComponent(item.imageUrl)}&format=${item.outputFormat}&taskId=${encodeURIComponent(item.id)}`;
}

export async function downloadMediaItem(item: MediaItem): Promise<string | null> {
  const response = await fetch(getMediaAssetUrl(item));
  if (!response.ok) {
    try {
      const payload = (await response.json()) as { error?: string };
      return payload.error ?? "Download fehlgeschlagen.";
    } catch {
      return "Download fehlgeschlagen.";
    }
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = `brewai-${item.id}.${item.outputFormat}`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);
  return null;
}

export type StudioMediaLibraryProps = {
  P: StudioPalette;
  items: MediaItem[];
  loaded?: boolean;
  onItemsChange: (next: MediaItem[]) => void;
  hasActivePlan?: boolean;
  initialQuery?: string;
  /** QA only: skip real download fetch */
  mockDownload?: boolean;
};

export function StudioMediaLibrary({
  items,
  loaded = true,
  onItemsChange,
  hasActivePlan = true,
  initialQuery = "",
  mockDownload = false,
}: StudioMediaLibraryProps) {
  const reduceMotion = useReducedMotion();
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState(initialQuery);
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [titleSaving, setTitleSaving] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    // Sync URL query param when navigating with ?q=
    // eslint-disable-next-line react-hooks/set-state-in-effect -- controlled by route search param
    setSearch(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (!selectedItem) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset form when opening detail
    setTitleDraft(getMediaDisplayTitle(selectedItem));
    setTitleError(null);
    const focusTimer = window.setTimeout(() => titleInputRef.current?.focus(), reduceMotion ? 0 : 180);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedItem(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedItem, reduceMotion]);

  const openMediaItem = useCallback((item: MediaItem) => {
    setDownloadError(null);
    setTitleError(null);
    setSelectedItem(item);
  }, []);

  const saveMediaTitle = useCallback(
    async (item: MediaItem, nextTitle: string) => {
      const trimmed = nextTitle.trim();
      if (!trimmed) {
        setTitleError("Bitte einen Titel eingeben.");
        return;
      }
      if (trimmed === getMediaDisplayTitle(item)) return;

      setTitleSaving(true);
      setTitleError(null);
      try {
        const res = await fetch("/api/dashboard/media", {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: item.id, title: trimmed }),
        });
        const json = (await res.json().catch(() => null)) as { error?: string; items?: MediaItem[] } | null;
        if (!res.ok) {
          setTitleError(json?.error ?? "Titel konnte nicht gespeichert werden.");
          return;
        }
        const nextItems = Array.isArray(json?.items)
          ? json.items
          : items.map((entry) => (entry.id === item.id ? { ...entry, title: trimmed } : entry));
        onItemsChange(nextItems);
        setSelectedItem((current) => (current?.id === item.id ? { ...current, title: trimmed } : current));
      } catch {
        setTitleError("Titel konnte nicht gespeichert werden.");
      } finally {
        setTitleSaving(false);
      }
    },
    [items, onItemsChange],
  );

  const handleDownload = useCallback(
    async (item: MediaItem) => {
      setDownloading(true);
      setDownloadError(null);
      try {
        if (mockDownload) {
          await new Promise((r) => setTimeout(r, 400));
          return;
        }
        const error = await downloadMediaItem(item);
        if (error) setDownloadError(error);
      } catch {
        setDownloadError("Download fehlgeschlagen.");
      } finally {
        setDownloading(false);
      }
    },
    [mockDownload],
  );

  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        getMediaDisplayTitle(it).toLowerCase().includes(q) ||
        it.prompt.toLowerCase().includes(q) ||
        it.aspectRatio.toLowerCase().includes(q) ||
        it.resolution.toLowerCase().includes(q),
    );
  }, [items, search]);

  const createHref = hasActivePlan ? "/inhalte-erstellen" : "/dashboard?tab=pricing";
  const createLabel = hasActivePlan ? "Motiv generieren" : "Tarif wählen";

  return (
    <div className="studio-media-page">
      <header className="studio-media-head">
        <div className="studio-media-head__main">
          <span className="studio-media-head__eyebrow">Mediathek</span>
          <h1>Mediathek</h1>
          <p>Alle generierten Motive deiner Brauerei — sortiert nach Datum.</p>
        </div>
        <div className="studio-media-head__actions">
          <Link href={createHref} className="evg-btn evg-btn--primary">
            {createLabel}
          </Link>
        </div>
      </header>

      {loaded && items.length > 0 ? (
        <div className="studio-media-toolbar">
          <label className="studio-media-search">
            <span className="studio-media-search__icon" aria-hidden>
              <StudioIcon name="search" size={14} />
            </span>
            <input
              className="studio-media-search__input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nach Motiv, Bier oder Anlass suchen …"
              aria-label="Mediathek durchsuchen"
            />
          </label>
          <div className="studio-media-filters" aria-label="Medienfilter">
            <span className="studio-media-filter studio-media-filter--active">Bilder · {items.length}</span>
          </div>
        </div>
      ) : null}

      <LayoutGroup id="studio-media-library">
        {!loaded ? (
          <div className="studio-media-skeleton-grid" aria-busy="true" aria-label="Motive werden geladen">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="studio-media-skeleton-card">
                <div className="studio-media-skeleton-card__img" />
                <div className="studio-media-skeleton-card__line" />
                <div className="studio-media-skeleton-card__line studio-media-skeleton-card__line--short" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="studio-media-empty">
            <div className="studio-media-empty__icon" aria-hidden>
              <StudioIcon name="image" size={18} />
            </div>
            <h2 className="studio-media-empty__title">Noch keine Motive in der Mediathek</h2>
            <p className="studio-media-empty__text">
              Wähle Sortiment und Anlass und generiere dein erstes Motiv — es landet automatisch hier.
            </p>
            <div className="studio-media-empty__actions">
              <Link href={createHref} className="evg-btn evg-btn--primary">
                {hasActivePlan ? "Erstes Motiv erstellen" : "Tarif wählen"}
              </Link>
              <Link href="/dashboard?tab=brand" className="evg-btn">
                Markenprofil prüfen
              </Link>
            </div>
          </div>
        ) : visibleItems.length === 0 ? (
          <p className="studio-media-search-empty">Keine Motive passen zur Suche.</p>
        ) : (
          <div className="studio-media-grid">
            {visibleItems.map((it) => (
              <button
                key={it.id}
                type="button"
                className="studio-media-card"
                onClick={() => openMediaItem(it)}
                aria-label={`${getMediaDisplayTitle(it)} in Großansicht öffnen`}
              >
                <div className="studio-media-card__frame">
                  <motion.img
                    className="studio-media-card__img"
                    layoutId={reduceMotion ? undefined : `studio-media-${it.id}`}
                    src={getMediaAssetUrl(it)}
                    alt=""
                    transition={reduceMotion ? { duration: 0 } : MEDIA_LIGHTBOX_SPRING}
                  />
                </div>
                <div className="studio-media-card__cap">
                  <span className="studio-media-card__title">{clampText(getMediaDisplayTitle(it), 48)}</span>
                  <span className="studio-media-card__meta">
                    {it.aspectRatio} · {formatRelativeTime(it.createdAt)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        <AnimatePresence>
          {selectedItem ? (
            <motion.div
              key="studio-media-lightbox"
              role="dialog"
              aria-modal="true"
              aria-label="Bild in Großansicht"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0.12 : 0.22, ease: STUDIO_EASE }}
              onClick={() => setSelectedItem(null)}
              className="evg-scrim studio-media-detail-scrim"
            >
              <motion.div
                onClick={(event) => event.stopPropagation()}
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                transition={{ duration: reduceMotion ? 0.12 : 0.22, ease: STUDIO_EASE }}
                className="studio-media-detail"
              >
                <div className="studio-media-detail__stage">
                  <motion.img
                    className="studio-media-detail__img"
                    layoutId={reduceMotion ? undefined : `studio-media-${selectedItem.id}`}
                    src={getMediaAssetUrl(selectedItem)}
                    alt={getMediaDisplayTitle(selectedItem)}
                    transition={reduceMotion ? { duration: 0 } : MEDIA_LIGHTBOX_SPRING}
                  />
                </div>
                <aside className="studio-media-detail__aside">
                  <div className="studio-media-detail__head">
                    <div className="studio-media-detail__title-row">
                      <label htmlFor={`media-title-${selectedItem.id}`} className="evg-rubrik">
                        Motiv-Titel
                      </label>
                      <input
                        id={`media-title-${selectedItem.id}`}
                        ref={titleInputRef}
                        className="evg-input"
                        value={titleDraft}
                        onChange={(event) => setTitleDraft(event.target.value)}
                        onBlur={() => {
                          if (selectedItem) void saveMediaTitle(selectedItem, titleDraft);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            if (selectedItem) void saveMediaTitle(selectedItem, titleDraft);
                          }
                        }}
                        maxLength={120}
                        disabled={titleSaving}
                        placeholder="z. B. Hefeweizen · Hero-Glas · Public Viewing"
                        style={{ marginTop: 8, height: 36, fontWeight: 500 }}
                      />
                      <div className="studio-media-detail__save-hint">
                        <span>Enter oder Speichern</span>
                        <StudioButton
                          size="sm"
                          variant="soft"
                          disabled={titleSaving || titleDraft.trim() === getMediaDisplayTitle(selectedItem)}
                          onClick={() => void saveMediaTitle(selectedItem, titleDraft)}
                        >
                          Titel speichern
                        </StudioButton>
                      </div>
                      <dl className="evg-sheet" style={{ marginTop: 14 }}>
                        <dt>Format</dt>
                        <dd>
                          {selectedItem.resolution} · {selectedItem.aspectRatio} ·{" "}
                          {selectedItem.outputFormat.toUpperCase()}
                        </dd>
                        <dt>Zeit</dt>
                        <dd>{formatRelativeTime(selectedItem.createdAt)}</dd>
                      </dl>
                    </div>
                    <StudioIconButton aria-label="Schließen" onClick={() => setSelectedItem(null)}>
                      <StudioIcon name="x" size={16} />
                    </StudioIconButton>
                  </div>
                  {titleError ? (
                    <p className="evg-note" style={{ margin: 0, fontSize: 12.5 }}>
                      {titleError}
                    </p>
                  ) : null}
                  {titleSaving ? (
                    <p style={{ margin: 0, fontSize: 12.5, color: "var(--fg-5)" }}>Titel wird gespeichert …</p>
                  ) : null}
                  {downloadError ? (
                    <p className="evg-note" style={{ margin: 0, fontSize: 12.5 }}>
                      {downloadError}
                    </p>
                  ) : null}
                  <div className="studio-media-detail__actions">
                    <StudioButton disabled={downloading} onClick={() => void handleDownload(selectedItem)}>
                      {downloading ? "Wird heruntergeladen …" : "Herunterladen"}
                    </StudioButton>
                    <StudioButton variant="ghost" onClick={() => setSelectedItem(null)}>
                      Schließen
                    </StudioButton>
                  </div>
                </aside>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </LayoutGroup>
    </div>
  );
}

/** @deprecated Use StudioMediaLibrary */
export const MediaView = StudioMediaLibrary;
