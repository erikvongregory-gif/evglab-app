"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { ImagePlus, Search, X } from "lucide-react";
import { getMediaDisplayTitle } from "@/lib/dashboard/metadata";
import { clearActiveGeneration, readActiveGeneration } from "@/lib/inhalte-erstellen/active-generation";
import {
  isLandscapeAspect,
  jobAspectStyle,
  leadingMediaForJobs,
  shouldShowJobCard,
  type MediaJobCard,
} from "@/lib/inhalte-erstellen/media-job-cards";
import { jobProgressMessage, pollGenerationJob, type PolledJobResult } from "@/lib/inhalte-erstellen/poll-generation-job";
import { StudioCreateComposer } from "@/components/ui/inhalte-erstellen-studio";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Frosted-Reveal: Wipe erst, wenn das Motiv-Bild geladen ist. */
function MediaJobRevealThumb({
  job,
  message,
}: {
  job: MediaJobCard;
  message: string;
}) {
  const imageUrl = job.images[job.images.length - 1]?.imageUrl?.trim() || null;
  const done = job.status === "completed" && Boolean(imageUrl);
  const failed = job.status === "failed";
  const [imageReady, setImageReady] = useState(false);
  const [reveal, setReveal] = useState(0);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setImageReady(false);
    setReveal(0);
  }, [imageUrl]);

  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0) setImageReady(true);
  }, [imageUrl]);

  useEffect(() => {
    if (!imageReady || failed) return;
    if (done) {
      setReveal(100);
      return;
    }
    const id = window.setInterval(() => {
      setReveal((prev) => {
        if (prev >= 100) return 100;
        const step = prev < 40 ? 2.2 : prev < 75 ? 1.4 : 0.9;
        return Math.min(100, prev + step);
      });
    }, 48);
    return () => window.clearInterval(id);
  }, [imageReady, done, failed]);

  const wipe = Math.max(0, Math.min(100, reveal));
  const showWipe = Boolean(imageUrl) && imageReady && !failed && wipe < 100;

  return (
    <div className="relative w-full overflow-hidden bg-muted" style={jobAspectStyle(job.aspectRatio)}>
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(120% 90% at 85% 100%, rgba(199, 105, 30, 0.55) 0%, transparent 55%),
            radial-gradient(90% 70% at 15% 20%, rgba(180, 175, 210, 0.55) 0%, transparent 50%),
            radial-gradient(70% 60% at 50% 50%, rgba(230, 228, 235, 0.9) 0%, #d8d6de 100%)
          `,
        }}
      />
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          className="absolute inset-0 size-full object-cover"
          src={imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={() => setImageReady(true)}
        />
      ) : null}
      {showWipe ? (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          initial={false}
          animate={{
            clipPath: `polygon(0 ${wipe}%, 100% ${wipe}%, 100% 100%, 0 100%)`,
          }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          style={{
            backdropFilter: "blur(28px)",
            WebkitBackdropFilter: "blur(28px)",
            background:
              "linear-gradient(105deg, rgba(245,244,248,0.72) 0%, rgba(232,180,130,0.5) 55%, rgba(199,105,30,0.4) 100%)",
            maskImage: `linear-gradient(to bottom, transparent ${Math.max(0, wipe - 4)}%, black ${Math.min(100, wipe + 6)}%)`,
            WebkitMaskImage: `linear-gradient(to bottom, transparent ${Math.max(0, wipe - 4)}%, black ${Math.min(100, wipe + 6)}%)`,
          }}
        />
      ) : null}
      {!imageReady && !failed ? (
        <div className="absolute inset-x-0 bottom-0 z-[1] bg-gradient-to-t from-black/45 to-transparent p-2 pt-8">
          <p className="text-[11px] font-medium text-white/95">{message}</p>
        </div>
      ) : null}
    </div>
  );
}

export type MediaItem = {
  id: string;
  imageUrl: string;
  thumbUrl?: string;
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

type JobsApiJob = {
  id: string;
  status?: string;
  result?: PolledJobResult | null;
  created_at?: string;
};

function cardFromJob(job: JobsApiJob, highlighted: boolean, fallback?: Partial<MediaJobCard>): MediaJobCard {
  const result = (job.result ?? {}) as PolledJobResult;
  const snapshot = result.snapshot;
  const status: MediaJobCard["status"] =
    job.status === "failed" ? "failed" : job.status === "completed" ? "completed" : "reserved";
  return {
    jobId: job.id,
    status,
    phase: result.phase || (status === "reserved" ? "queued" : status),
    aspectRatio: result.aspectRatio || snapshot?.aspectRatio || fallback?.aspectRatio || "4:5",
    expectedVariants: result.expectedVariants || snapshot?.variantCount || fallback?.expectedVariants || 1,
    images: result.images ?? fallback?.images ?? [],
    error: typeof result.error === "string" ? result.error : fallback?.error,
    partial: result.partial,
    highlighted,
  };
}

function isLiveListedJob(job: JobsApiJob, focusedJobId: string) {
  if (job.id === focusedJobId) return true;
  if (job.status === "reserved") return true;
  const createdAt = job.created_at ? Date.parse(job.created_at) : 0;
  const recent = createdAt > 0 && Date.now() - createdAt < 15 * 60_000;
  if (job.status === "failed" && recent) return true;
  if (job.status === "completed" && job.result?.mediaPersisted === false && recent) return true;
  return false;
}

function optimisticJobCard(jobId: string): MediaJobCard {
  const stored = typeof window === "undefined" ? null : readActiveGeneration();
  const match = stored?.jobId === jobId ? stored : null;
  return {
    jobId,
    status: "reserved",
    phase: "queued",
    aspectRatio: match?.aspectRatio || "4:5",
    expectedVariants: match?.variantCount || 1,
    images: [],
    highlighted: true,
  };
}

function useStudioJobCards(focusedJobId: string, onMediaRefresh?: () => void) {
  const [jobs, setJobs] = useState<MediaJobCard[]>([]);
  const [pollNonce, setPollNonce] = useState(0);

  const mergeJob = useCallback((next: MediaJobCard) => {
    setJobs((current) => {
      const others = current.filter((item) => item.jobId !== next.jobId);
      return [next, ...others];
    });
  }, []);

  const cards = useMemo(() => {
    if (!focusedJobId || jobs.some((job) => job.jobId === focusedJobId)) return jobs;
    return [optimisticJobCard(focusedJobId), ...jobs];
  }, [focusedJobId, jobs]);

  useEffect(() => {
    const ac = new AbortController();
    const refreshIfNeeded = (jobId: string) => {
      onMediaRefresh?.();
      const active = readActiveGeneration();
      if (active?.jobId === jobId) clearActiveGeneration();
    };

    const pollOne = (card: MediaJobCard) => {
      if (card.status !== "reserved") return;
      void pollGenerationJob({
        jobId: card.jobId,
        expectedVariants: card.expectedVariants,
        signal: ac.signal,
        onProgress: (_message, result) => {
          mergeJob({
            ...card,
            ...cardFromJob({ id: card.jobId, status: result.status || "reserved", result }, Boolean(card.highlighted), card),
            connectionIssue: result.connectionIssue,
            pending: result.pending,
          });
        },
      }).then((result) => {
        if (ac.signal.aborted) return;
        const next = {
          ...card,
          ...cardFromJob(
            { id: card.jobId, status: result.status || (result.error ? "failed" : result.pending ? "reserved" : "completed"), result },
            Boolean(card.highlighted),
            card,
          ),
          connectionIssue: result.connectionIssue,
          pending: result.pending,
          error: result.error,
        };
        mergeJob(next);
        if (!result.pending && !result.connectionIssue && (result.images?.length || result.error)) {
          refreshIfNeeded(card.jobId);
        }
      });
    };

    void (async () => {
      try {
        const listed: JobsApiJob[] = [];
        const listRes = await fetch("/api/dashboard/jobs", {
          credentials: "include",
          cache: "no-store",
          signal: ac.signal,
        });
        if (listRes.ok) {
          const listJson = (await listRes.json()) as { jobs?: JobsApiJob[] };
          if (Array.isArray(listJson.jobs)) {
            listed.push(...listJson.jobs.filter((job) => isLiveListedJob(job, focusedJobId)));
          }
        }
        if (focusedJobId && !listed.some((job) => job.id === focusedJobId)) {
          const oneRes = await fetch(`/api/dashboard/jobs?id=${encodeURIComponent(focusedJobId)}`, {
            credentials: "include",
            cache: "no-store",
            signal: ac.signal,
          });
          if (oneRes.ok) {
            const oneJson = (await oneRes.json()) as { job?: JobsApiJob };
            if (oneJson.job?.id) listed.unshift(oneJson.job);
          } else if (oneRes.status === 404) {
            mergeJob({
              jobId: focusedJobId,
              status: "failed",
              phase: "failed",
              aspectRatio: "4:5",
              expectedVariants: 1,
              images: [],
              error: "Auftrag nicht gefunden.",
              highlighted: true,
            });
          }
        }
        const nextCards = listed.map((job) => cardFromJob(job, job.id === focusedJobId));
        setJobs((current) => {
          const byId = new Map(nextCards.map((job) => [job.jobId, job]));
          for (const job of current) {
            if (!byId.has(job.jobId)) byId.set(job.jobId, job);
          }
          return [...byId.values()];
        });
        for (const card of nextCards) pollOne(card);
      } catch (error) {
        if (ac.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return;
      }
    })();

    return () => ac.abort();
  }, [focusedJobId, mergeJob, onMediaRefresh, pollNonce]);

  return { jobs: cards, recheck: () => setPollNonce((n) => n + 1) };
}

/** Signierte Storage-URL für Kacheln (Thumb falls vorhanden). */
export function getMediaThumbUrl(item: MediaItem): string {
  return item.thumbUrl?.trim() || item.imageUrl;
}

/** Original für Großansicht — direkt, ohne Download-Proxy. */
export function getMediaFullUrl(item: MediaItem): string {
  return item.imageUrl;
}

/** Nur für Datei-Download (Format/Attachment). */
export function getMediaDownloadUrl(item: MediaItem): string {
  if (item.imageUrl.startsWith("data:") || item.imageUrl.startsWith("/api/kie/download?")) {
    return item.imageUrl;
  }
  return `/api/kie/download?url=${encodeURIComponent(item.imageUrl)}&format=${item.outputFormat}&taskId=${encodeURIComponent(item.id)}`;
}

/** @deprecated Prefer getMediaFullUrl / getMediaThumbUrl / getMediaDownloadUrl */
export function getMediaAssetUrl(item: MediaItem): string {
  return getMediaDownloadUrl(item);
}

export async function downloadMediaItem(item: MediaItem): Promise<string | null> {
  const response = await fetch(getMediaDownloadUrl(item));
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
  items: MediaItem[];
  loaded?: boolean;
  loadError?: string | null;
  onRetry?: () => void;
  onItemsChange: (next: MediaItem[]) => void;
  onMediaRefresh?: () => void;
  hasActivePlan?: boolean;
  initialQuery?: string;
  focusedJobId?: string;
  /** QA only: skip real download fetch */
  mockDownload?: boolean;
  mediaTotal?: number;
  hasMoreMedia?: boolean;
  loadingMoreMedia?: boolean;
  onLoadMoreMedia?: () => void;
};

export function StudioMediaLibrary({
  items,
  loaded = true,
  loadError = null,
  onRetry,
  onItemsChange,
  onMediaRefresh,
  hasActivePlan = true,
  initialQuery = "",
  focusedJobId = "",
  mockDownload = false,
  mediaTotal,
  hasMoreMedia = false,
  loadingMoreMedia = false,
  onLoadMoreMedia,
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
  const { jobs, recheck } = useStudioJobCards(focusedJobId, onMediaRefresh);

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
        const json = (await res.json().catch(() => null)) as
          | { error?: string; items?: MediaItem[]; id?: string; title?: string }
          | null;
        if (!res.ok) {
          setTitleError(json?.error ?? "Titel konnte nicht gespeichert werden.");
          return;
        }
        const nextTitle = json?.title?.trim() || trimmed;
        const nextItems = Array.isArray(json?.items)
          ? json.items
          : items.map((entry) => (entry.id === item.id ? { ...entry, title: nextTitle } : entry));
        onItemsChange(nextItems);
        setSelectedItem((current) => (current?.id === item.id ? { ...current, title: nextTitle } : current));
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

  const mediaIds = useMemo(() => new Set(items.map((item) => item.id)), [items]);
  const visibleJobs = useMemo(
    () => jobs.filter((job) => shouldShowJobCard(job, mediaIds)),
    [jobs, mediaIds],
  );
  const { leading, seen } = useMemo(
    () => leadingMediaForJobs(jobs, visibleItems),
    [jobs, visibleItems],
  );
  const restItems = useMemo(
    () => visibleItems.filter((item) => !seen.has(item.id)),
    [visibleItems, seen],
  );
  const hasAny = visibleJobs.length > 0 || items.length > 0;

  const createHref = hasActivePlan ? "/inhalte-erstellen" : "/dashboard/pricing";
  const createLabel = hasActivePlan ? "Motiv generieren" : "Tarif wählen";

  return (
    <div data-content-padding="false" className="flex min-h-[calc(100dvh-var(--dashboard-header-height,3rem))] flex-col">
      <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl leading-none tracking-tight">Mediathek</h1>
            <p className="text-muted-foreground text-sm">
              Fertige Motive und laufende Aufträge — Eingabe bleibt unten verfügbar.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/inhalte-erstellen">Zur Einstiegsseite</Link>
            </Button>
            <Button asChild>
              <Link href={createHref}>
                <ImagePlus data-icon="inline-start" />
                {createLabel}
              </Link>
            </Button>
          </div>
        </div>

        {loaded && hasAny ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-md flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nach Motiv, Bier oder Anlass suchen …"
                aria-label="Mediathek durchsuchen"
              />
            </div>
            <Badge variant="secondary">Bilder · {mediaTotal ?? items.length}</Badge>
          </div>
        ) : null}

        <LayoutGroup id="studio-media-library">
          {!loaded && visibleJobs.length === 0 ? (
            <div
              className="columns-2 gap-3 sm:columns-3 lg:columns-4 xl:columns-5"
              aria-busy="true"
            >
              {Array.from({ length: 5 }, (_, i) => (
                <Card
                  key={i}
                  className="mb-3 break-inside-avoid gap-0 overflow-hidden py-0 shadow-sm"
                >
                  <Skeleton className="aspect-[4/5] w-full rounded-none" />
                  <CardContent className="space-y-2 p-3">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : loadError && !hasAny ? (
            <Card>
              <CardHeader>
                <CardTitle>Mediathek nicht erreichbar</CardTitle>
                <CardDescription className="text-destructive">{loadError}</CardDescription>
              </CardHeader>
              {onRetry ? (
                <CardContent>
                  <Button variant="outline" onClick={onRetry}>
                    Erneut laden
                  </Button>
                </CardContent>
              ) : null}
            </Card>
          ) : !hasAny ? (
            <Card>
              <CardHeader>
                <CardTitle>Noch keine Motive in der Mediathek</CardTitle>
                <CardDescription>
                  Wähle Sortiment und Anlass und generiere dein erstes Motiv — es landet automatisch hier.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link href={createHref}>{hasActivePlan ? "Erstes Motiv erstellen" : "Tarif wählen"}</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/dashboard/brand">Markenprofil prüfen</Link>
                </Button>
              </CardContent>
            </Card>
          ) : visibleJobs.length === 0 && visibleItems.length === 0 ? (
            <p className="text-muted-foreground text-sm">Keine Motive passen zur Suche.</p>
          ) : (
            <div className="columns-2 gap-3 sm:columns-3 lg:columns-4 xl:columns-5">
              {visibleJobs.map((job) => {
                const message = jobProgressMessage({
                  phase: job.phase,
                  status: job.status,
                  completed: job.images.length,
                  expected: job.expectedVariants,
                  connectionIssue: job.connectionIssue,
                });
                return (
                  <Card
                    key={`job-${job.jobId}`}
                    className="mb-3 break-inside-avoid gap-0 overflow-hidden border-0 py-0 shadow-sm"
                    aria-busy={job.status === "reserved" || undefined}
                    aria-label={message}
                  >
                    <MediaJobRevealThumb job={job} message={message} />
                    <CardContent className="space-y-1 p-3">
                      <p className="truncate text-sm font-medium">{message}</p>
                      <p className="text-muted-foreground text-xs">
                        {job.aspectRatio}
                        {job.expectedVariants > 1 ? ` · ${job.images.length}/${job.expectedVariants}` : ""}
                        {job.partial ? " · teilweise" : ""}
                      </p>
                      {job.error && !job.pending ? (
                        <p className="text-destructive text-xs">{job.error}</p>
                      ) : null}
                      {job.pending || job.connectionIssue ? (
                        <Button type="button" variant="ghost" size="sm" className="h-auto px-0" onClick={recheck}>
                          Status erneut prüfen
                        </Button>
                      ) : null}
                    </CardContent>
                  </Card>
                );
              })}
              {[...leading, ...restItems].map((it) => (
                <button
                  key={it.id}
                  type="button"
                  className={cn(
                    "mb-3 w-full break-inside-avoid overflow-hidden rounded-xl bg-card text-left shadow-sm transition-colors hover:bg-muted/40",
                    focusedJobId && it.id.startsWith(`gen-${focusedJobId}-`) && "ring-2 ring-primary",
                  )}
                  onClick={() => openMediaItem(it)}
                  aria-label={`${getMediaDisplayTitle(it)} in Großansicht öffnen`}
                >
                  <div className="w-full overflow-hidden bg-muted" style={jobAspectStyle(it.aspectRatio)}>
                    <motion.img
                      className="block h-full w-full object-cover"
                      layoutId={reduceMotion ? undefined : `studio-media-${it.id}`}
                      src={getMediaThumbUrl(it)}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      transition={reduceMotion ? { duration: 0 } : MEDIA_LIGHTBOX_SPRING}
                    />
                  </div>
                  <div className="space-y-0.5 p-3">
                    <p className="truncate text-sm font-medium">{clampText(getMediaDisplayTitle(it), 48)}</p>
                    <p className="text-muted-foreground text-xs">
                      {it.aspectRatio} · {formatRelativeTime(it.createdAt)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {hasMoreMedia && onLoadMoreMedia ? (
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={loadingMoreMedia}
                onClick={onLoadMoreMedia}
              >
                {loadingMoreMedia ? "Lädt …" : "Weitere Motive laden"}
              </Button>
            </div>
          ) : null}

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
                className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
              >
                <motion.div
                  onClick={(event) => event.stopPropagation()}
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                  transition={{ duration: reduceMotion ? 0.12 : 0.22, ease: STUDIO_EASE }}
                  className={cn(
                    "flex max-h-[90dvh] w-full overflow-hidden rounded-xl bg-card shadow-lg",
                    isLandscapeAspect(selectedItem.aspectRatio)
                      ? "max-w-5xl flex-col md:flex-row"
                      : "max-w-3xl flex-col md:flex-row",
                  )}
                >
                  <div
                    className={cn(
                      "flex min-h-0 items-center justify-center bg-muted p-3 sm:p-5",
                      isLandscapeAspect(selectedItem.aspectRatio)
                        ? "md:min-w-0 md:flex-1"
                        : "md:w-[min(100%,26rem)] md:flex-none",
                    )}
                  >
                    <motion.img
                      className="h-auto max-h-[min(70dvh,720px)] w-auto max-w-full object-contain"
                      style={jobAspectStyle(selectedItem.aspectRatio)}
                      layoutId={reduceMotion ? undefined : `studio-media-${selectedItem.id}`}
                      src={getMediaFullUrl(selectedItem)}
                      alt={getMediaDisplayTitle(selectedItem)}
                      decoding="async"
                      transition={reduceMotion ? { duration: 0 } : MEDIA_LIGHTBOX_SPRING}
                    />
                  </div>
                  <aside className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-4 md:max-w-sm md:p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-2">
                        <label htmlFor={`media-title-${selectedItem.id}`} className="text-muted-foreground text-xs font-medium">
                          Motiv-Titel
                        </label>
                        <Input
                          id={`media-title-${selectedItem.id}`}
                          ref={titleInputRef}
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
                          placeholder="z. B. Hefeweizen · Hero-Glas"
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={titleSaving || titleDraft.trim() === getMediaDisplayTitle(selectedItem)}
                            onClick={() => void saveMediaTitle(selectedItem, titleDraft)}
                          >
                            Titel speichern
                          </Button>
                          <span className="text-muted-foreground text-xs">
                            {selectedItem.resolution} · {selectedItem.aspectRatio} ·{" "}
                            {selectedItem.outputFormat.toUpperCase()} · {formatRelativeTime(selectedItem.createdAt)}
                          </span>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" aria-label="Schließen" onClick={() => setSelectedItem(null)}>
                        <X />
                      </Button>
                    </div>
                    {titleError ? <p className="text-destructive text-sm">{titleError}</p> : null}
                    {titleSaving ? <p className="text-muted-foreground text-sm">Titel wird gespeichert …</p> : null}
                    {downloadError ? <p className="text-destructive text-sm">{downloadError}</p> : null}
                    <div className="mt-auto flex flex-wrap gap-2">
                      <Button disabled={downloading} onClick={() => void handleDownload(selectedItem)}>
                        {downloading ? "Wird heruntergeladen …" : "Herunterladen"}
                      </Button>
                      <Button variant="outline" onClick={() => setSelectedItem(null)}>
                        Schließen
                      </Button>
                    </div>
                  </aside>
                </motion.div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </LayoutGroup>
      </div>

      <div className="sticky bottom-0 border-t bg-background/95 p-3 backdrop-blur md:p-4">
        {hasActivePlan ? (
          <StudioCreateComposer variant="dock" />
        ) : (
          <div className="flex justify-center">
            <Button asChild>
              <Link href="/dashboard/pricing">Tarif wählen, um zu generieren</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/** @deprecated Use StudioMediaLibrary */
export const MediaView = StudioMediaLibrary;
