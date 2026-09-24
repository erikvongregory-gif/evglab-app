"use client";

import { useEffect, useMemo, useState } from "react";
import { StudioIcon } from "@/components/studio/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MediaItem, MediaRole, ModelEntry } from "@/lib/generation/catalog";

export type AssetKind = "image" | "video" | "audio";

export type ShelfUpload = {
  url: string;
  kind: AssetKind;
  name: string;
};

export type ShelfGeneration = {
  url: string;
  kind: AssetKind;
  title: string;
};

const ROLE_ORDER: MediaRole[] = ["start", "end", "reference", "video", "audio"];

const ROLE_LABELS: Record<MediaRole, string> = {
  start: "Startbild",
  end: "Endbild",
  reference: "Referenz",
  video: "Video",
  audio: "Audio",
};

const ROLE_KINDS: Record<MediaRole, AssetKind> = {
  start: "image",
  end: "image",
  reference: "image",
  video: "video",
  audio: "audio",
};

function rolesOf(model: ModelEntry): MediaRole[] {
  return ROLE_ORDER.filter((role) => (model.roles[role] ?? 0) > 0);
}

function urlsOf(items: MediaItem[], role: MediaRole): string[] {
  return items.filter((item) => item.role === role).map((item) => item.url);
}

function roleNoun(role: MediaRole, count: number): string {
  if (count === 1) return ROLE_LABELS[role];
  if (role === "start") return "Startbilder";
  if (role === "end") return "Endbilder";
  if (role === "reference") return "Referenzen";
  if (role === "video") return "Videos";
  return "Audios";
}

type Source = "uploads" | "generations";

/** Asset-Picker im BrewAI-Look — Logik analog OpenHiggsfield. */
export function VideoAssetPicker({
  model,
  items,
  uploads,
  generations,
  uploading,
  onUpload,
  onApply,
  onClose,
}: {
  model: ModelEntry;
  items: MediaItem[];
  uploads: ShelfUpload[];
  generations: ShelfGeneration[];
  uploading: boolean;
  onUpload: (role: MediaRole) => void;
  onApply: (role: MediaRole, urls: string[]) => void;
  onClose: () => void;
}) {
  const roles = rolesOf(model);
  const [role, setRole] = useState<MediaRole>(() => roles[0] ?? "start");
  const [source, setSource] = useState<Source>("uploads");
  const [selected, setSelected] = useState<string[]>(() => urlsOf(items, roles[0] ?? "start"));

  const kind = ROLE_KINDS[role];
  const max = model.roles[role] ?? 0;
  const current = useMemo(() => urlsOf(items, role), [items, role]);
  const room = Math.max(0, max - selected.length);

  const uploadAssets = useMemo(
    () => uploads.filter((u) => u.kind === kind),
    [uploads, kind],
  );
  const genAssets = useMemo(
    () => generations.filter((g) => g.kind === kind),
    [generations, kind],
  );
  const assets = source === "uploads" ? uploadAssets : genAssets;

  useEffect(() => {
    if (!roles.includes(role) && roles[0]) {
      setRole(roles[0]);
      setSelected(urlsOf(items, roles[0]));
    }
  }, [roles, role, items]);

  function pickRole(next: MediaRole) {
    setRole(next);
    setSelected(urlsOf(items, next));
  }

  function advanceOrClose(filled: MediaRole) {
    if (filled === "start" && (model.roles.end ?? 0) > 0) {
      const endUsed = items.filter((item) => item.role === "end").length;
      if (endUsed < (model.roles.end ?? 0)) {
        pickRole("end");
        return;
      }
    }
    onClose();
  }

  function commit(urls: string[]) {
    onApply(role, urls);
    if (max > 0 && urls.length >= max) {
      advanceOrClose(role);
      return;
    }
    onClose();
  }

  function toggle(url: string) {
    if (max === 1) {
      const next = selected.includes(url) ? [] : [url];
      setSelected(next);
      onApply(role, next);
      if (next.length === 1) advanceOrClose(role);
      return;
    }
    setSelected((prev) =>
      prev.includes(url) ? prev.filter((entry) => entry !== url) : [...prev, url],
    );
  }

  const picked = new Set(selected);
  const added = selected.filter((url) => !current.includes(url)).length;
  const dropped = current.filter((url) => !picked.has(url)).length;
  const applyLabel =
    added && dropped
      ? "Ersetzen"
      : added
        ? added > 1
          ? `${added} hinzufügen`
          : "Hinzufügen"
        : dropped
          ? "Entfernen"
          : "Fertig";

  const canUpload = room > 0 && !uploading;

  return (
    <div className="flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-0" role="dialog" aria-label="Medien anhängen">
      <div className="flex items-center justify-between gap-2 border-b border-border px-2 py-1.5">
        <div className="flex items-center gap-0.5" role="tablist" aria-label="Quelle">
          {(
            [
              ["uploads", "Uploads", uploadAssets.length],
              ["generations", "Generierungen", genAssets.length],
            ] as const
          ).map(([id, label, count]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={source === id}
              onClick={() => setSource(id)}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                source === id
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              {label}
              <span className="ml-1.5 tabular-nums opacity-60">{count}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-label="Schließen"
          onClick={onClose}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <StudioIcon name="x" size={14} />
        </button>
      </div>

      {roles.length > 1 ? (
        <div className="flex flex-wrap gap-1.5 border-b border-border px-2 py-2" role="group" aria-label="Slot">
          {roles.map((entry) => {
            const used =
              entry === role ? selected.length : items.filter((item) => item.role === entry).length;
            const active = entry === role;
            return (
              <button
                key={entry}
                type="button"
                aria-pressed={active}
                onClick={() => pickRole(entry)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-[#C7691E] bg-[#C7691E]/10 text-[#A85518] dark:text-[#D4782A]"
                    : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {ROLE_LABELS[entry]}
                <span className="tabular-nums opacity-70">
                  {used}/{model.roles[entry] ?? 0}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="min-h-[11rem] px-2 py-3">
        {assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-6 text-center">
            <span className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <StudioIcon name={source === "uploads" ? "plus" : "media"} size={16} />
            </span>
            <p className="text-sm font-medium text-foreground">
              {source === "uploads"
                ? "Noch nichts hochgeladen"
                : kind === "audio"
                  ? "Aus Generierungen kommt kein Audio"
                  : `Noch keine ${kind === "video" ? "Video-" : "Bild-"}Generierungen`}
            </p>
            <p className="max-w-[16rem] text-xs text-muted-foreground">
              {source === "uploads"
                ? "Dateien von diesem Gerät bleiben für den nächsten Lauf in der Ablage."
                : kind === "audio"
                  ? "Audio bitte unter Uploads von diesem Gerät anhängen."
                  : "Fertige Ergebnisse erscheinen hier und können erneut angehängt werden."}
            </p>
            {source === "uploads" ? (
              <Button
                type="button"
                variant="default"
                size="sm"
                disabled={!canUpload}
                className="mt-1 bg-[#C7691E] text-white hover:bg-[#B55D1A]"
                onClick={() => onUpload(role)}
              >
                <StudioIcon name="plus" size={14} />
                <span className="ml-1.5">Datei hochladen</span>
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {source === "uploads" ? (
              <button
                type="button"
                disabled={!canUpload}
                onClick={() => onUpload(role)}
                className={cn(
                  "flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-muted/40 text-muted-foreground transition-colors hover:border-[#C7691E]/50 hover:bg-[#C7691E]/5 hover:text-foreground",
                  !canUpload && "opacity-40",
                )}
              >
                {uploading ? (
                  <span className="size-4 animate-spin rounded-full border-2 border-[#C7691E] border-t-transparent" />
                ) : (
                  <StudioIcon name="plus" size={18} />
                )}
                <span className="text-[10px] font-medium">Upload</span>
              </button>
            ) : null}
            {assets.map((asset) => {
              const on = picked.has(asset.url);
              const blocked = !on && room === 0;
              const isVideo = asset.kind === "video";
              const title = "name" in asset ? asset.name : asset.title;
              return (
                <button
                  key={asset.url}
                  type="button"
                  disabled={blocked}
                  title={title}
                  onClick={() => toggle(asset.url)}
                  className={cn(
                    "relative aspect-square overflow-hidden rounded-xl border bg-muted transition-colors",
                    on ? "border-[#C7691E] ring-2 ring-[#C7691E]/30" : "border-border",
                    blocked && "opacity-40",
                  )}
                >
                  {isVideo ? (
                    <video src={asset.url} muted playsInline className="h-full w-full object-cover" />
                  ) : asset.kind === "audio" ? (
                    <span className="flex h-full items-center justify-center text-xs text-muted-foreground">
                      Audio
                    </span>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={asset.url} alt="" className="h-full w-full object-cover" />
                  )}
                  {on ? (
                    <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-[#C7691E] text-white">
                      <StudioIcon name="check" size={12} />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-2.5">
        <span className="text-xs text-muted-foreground tabular-nums">
          {selected.length} von {max} {roleNoun(role, max)}
        </span>
        <Button
          type="button"
          size="sm"
          className={cn(
            "min-w-[5.5rem]",
            added + dropped === 0
              ? "bg-muted text-foreground hover:bg-muted"
              : "bg-[#C7691E] text-white hover:bg-[#B55D1A]",
          )}
          onClick={() => commit(selected)}
        >
          {applyLabel}
        </Button>
      </div>
    </div>
  );
}

export { ROLE_LABELS, ROLE_KINDS, rolesOf };
