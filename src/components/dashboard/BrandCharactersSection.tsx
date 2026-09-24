"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MemberSelector, type Member } from "@/components/ui/member-selector";
import { readAndCompressImage, splitDataUrl } from "@/lib/images/compress-image";
import {
  MAX_CHARACTER_REFERENCE_IMAGES,
  MAX_MY_CHARACTERS,
  type DashboardCharacter,
} from "@/lib/dashboard/metadata";

type DraftPhoto = { dataUrl: string; mime: string; base64: string };

export function BrandCharactersSection() {
  const nameId = useId();
  const roleId = useId();
  const [characters, setCharacters] = useState<DashboardCharacter[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [draftPhotos, setDraftPhotos] = useState<DraftPhoto[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/dashboard/my-characters", { cache: "no-store", credentials: "include" });
      const data = (await res.json()) as { characters?: DashboardCharacter[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Charaktere konnten nicht geladen werden.");
      setCharacters(data.characters ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Laden fehlgeschlagen.");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const members: Member[] = useMemo(
    () =>
      characters.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.role || undefined,
        avatar: c.referenceImageUrls[0],
      })),
    [characters],
  );

  const selectedIds = useMemo(() => characters.map((c) => c.id), [characters]);

  async function persist(next: DashboardCharacter[], payloadsById?: Record<string, DraftPhoto[]>) {
    setSaving(true);
    setError(null);
    try {
      const body = {
        characters: next.map((c) => ({
          id: c.id,
          name: c.name,
          role: c.role,
          referenceImageUrls: c.referenceImageUrls,
          appearanceLock: c.appearanceLock,
          createdAt: c.createdAt,
          referencePayloads: (payloadsById?.[c.id] ?? []).map((p) => ({
            base64: p.base64,
            mime: p.mime === "image/png" || p.mime === "image/webp" ? p.mime : "image/jpeg",
          })),
        })),
      };
      const res = await fetch("/api/dashboard/my-characters", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { characters?: DashboardCharacter[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Speichern fehlgeschlagen.");
      setCharacters(data.characters ?? next);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function onPickFiles(files: FileList | null) {
    if (!files?.length) return;
    const room = MAX_CHARACTER_REFERENCE_IMAGES - draftPhotos.length;
    if (room <= 0) return;
    const next: DraftPhoto[] = [];
    for (const file of Array.from(files).slice(0, room)) {
      try {
        const dataUrl = await readAndCompressImage(file);
        const split = splitDataUrl(dataUrl);
        if (!split) continue;
        next.push({ dataUrl, mime: split.mime, base64: split.base64 });
      } catch {
        /* skip bad file */
      }
    }
    if (next.length) setDraftPhotos((prev) => [...prev, ...next].slice(0, MAX_CHARACTER_REFERENCE_IMAGES));
  }

  async function saveNew() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Bitte einen Namen eingeben.");
      return;
    }
    if (draftPhotos.length < 1) {
      setError("Mindestens ein Foto hochladen.");
      return;
    }
    if (characters.length >= MAX_MY_CHARACTERS) {
      setError(`Maximal ${MAX_MY_CHARACTERS} Charaktere.`);
      return;
    }
    const id = crypto.randomUUID();
    const draft: DashboardCharacter = {
      id,
      name: trimmed,
      role: role.trim(),
      referenceImageUrls: [],
      appearanceLock: "",
      createdAt: new Date().toISOString(),
    };
    const ok = await persist([...characters, draft], { [id]: draftPhotos });
    if (ok) {
      setCreating(false);
      setName("");
      setRole("");
      setDraftPhotos([]);
    }
  }

  function resetDraft() {
    setCreating(false);
    setName("");
    setRole("");
    setDraftPhotos([]);
    setError(null);
  }

  async function onSelectionChange(nextSelected: string[]) {
    if (saving) return;
    const removed = selectedIds.filter((id) => !nextSelected.includes(id));
    if (removed.length === 0) return;
    const id = removed[0];
    const target = characters.find((c) => c.id === id);
    if (!target) return;
    const confirmed = window.confirm(`Charakter „${target.name}“ wirklich löschen?`);
    if (!confirmed) return;
    await persist(characters.filter((c) => c.id !== id));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="border-b border-border pb-3">
        <h2 className="m-0 text-[15px] font-semibold tracking-tight text-foreground">Charaktere</h2>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Optional. Mehrere Personen anlegen (z.&nbsp;B. Braumeister) — dann beim Bildgenerieren denselben Charakter
        wiederverwenden, ohne dass jemand beim Shooting dabei sein muss.
      </p>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {!loaded ? (
        <p className="text-xs text-muted-foreground">Wird geladen…</p>
      ) : (
        <div className="space-y-4">
          <MemberSelector
            members={members}
            selected={selectedIds}
            onChange={(next) => void onSelectionChange(next)}
            max={MAX_MY_CHARACTERS}
            maxVisible={MAX_MY_CHARACTERS}
            addLabel="Neu"
            searchPlaceholder="Charakter suchen…"
            emptyLabel="Kein Charakter gefunden"
            onAddClick={() => {
              if (saving || creating || characters.length >= MAX_MY_CHARACTERS) return;
              setCreating(true);
              setError(null);
            }}
          />

          {creating ? (
            <div className="space-y-5 rounded-xl border border-border bg-card p-4 sm:p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={nameId} className="text-xs text-muted-foreground">
                    Name
                  </Label>
                  <Input
                    id={nameId}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="z. B. Thomas"
                    maxLength={80}
                    disabled={saving}
                    autoFocus
                    className="h-11 bg-background text-[15px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={roleId} className="text-xs text-muted-foreground">
                    Rolle <span className="font-normal">(optional)</span>
                  </Label>
                  <Input
                    id={roleId}
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="z. B. Braumeister"
                    maxLength={60}
                    disabled={saving}
                    className="h-11 bg-background text-[15px]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Fotos (1–{MAX_CHARACTER_REFERENCE_IMAGES})
                </Label>
                <div className="flex flex-wrap items-center gap-2">
                  {draftPhotos.map((p, i) => (
                    <button
                      key={p.dataUrl.slice(0, 48) + i}
                      type="button"
                      className="relative size-16 overflow-hidden rounded-lg border border-border bg-muted transition hover:opacity-80 disabled:opacity-50"
                      disabled={saving}
                      onClick={() => setDraftPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                      title="Foto entfernen"
                    >
                      <img src={p.dataUrl} alt="" className="size-full object-cover" />
                    </button>
                  ))}
                  {draftPhotos.length < MAX_CHARACTER_REFERENCE_IMAGES ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={saving}
                      onClick={() => fileRef.current?.click()}
                      className="size-16 flex-col gap-0.5 rounded-lg border-dashed text-xs text-muted-foreground"
                    >
                      <span className="text-base leading-none">+</span>
                      Foto
                    </Button>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  Mindestens ein Foto. Klick auf ein Vorschaubild entfernt es wieder.
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  hidden
                  onChange={(e) => {
                    void onPickFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <Button type="button" disabled={saving} onClick={() => void saveNew()}>
                  {saving ? "Speichern…" : "Charakter speichern"}
                </Button>
                <Button type="button" variant="ghost" disabled={saving} onClick={resetDraft}>
                  Abbrechen
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
