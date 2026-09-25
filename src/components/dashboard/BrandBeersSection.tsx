"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { beerStyleLabel } from "@/app/(dashboard)/inhalte-erstellen/lib/beer-styles";
import { BeerCreateDialog } from "@/components/studio/create/studio-dialogs";
import type { BeerCreateDraft } from "@/components/studio/beers/beer-create-panel";
import { MemberSelector, type Member } from "@/components/ui/member-selector";
import { splitDataUrl } from "@/lib/images/compress-image";
import {
  MAX_MY_BEERS,
  produktKategorieLabel,
  sanitizeProduktKategorie,
  type DashboardBeer,
} from "@/lib/dashboard/metadata";

function beerSubtitle(beer: DashboardBeer): string {
  const kategorie = sanitizeProduktKategorie(beer.produktKategorie);
  if (kategorie === "bier") return beerStyleLabel(beer.bierstil);
  return produktKategorieLabel(kategorie);
}

export function BrandBeersSection() {
  const [beers, setBeers] = useState<DashboardBeer[]>([]);
  const [revision, setRevision] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState("");

  const reload = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/dashboard/my-beers", { cache: "no-store", credentials: "include" });
      const data = (await res.json()) as { beers?: DashboardBeer[]; revision?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "Sortiment konnte nicht geladen werden.");
      setBeers(data.beers ?? []);
      setRevision(typeof data.revision === "string" ? data.revision : "");
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
      beers.map((beer) => ({
        id: beer.id,
        name: beer.name,
        email: beerSubtitle(beer),
        avatar: beer.etikettUrl || undefined,
      })),
    [beers],
  );

  const selectedIds = useMemo(() => beers.map((beer) => beer.id), [beers]);

  async function handleCreate(draft: BeerCreateDraft) {
    setCreateError("");
    setSaving(true);
    try {
      const payload = draft.etikettDataUrl ? splitDataUrl(draft.etikettDataUrl) : null;
      const etikettPayload =
        payload &&
        (payload.mime === "image/jpeg" || payload.mime === "image/png" || payload.mime === "image/webp")
          ? { base64: payload.base64, mime: payload.mime as "image/jpeg" | "image/png" | "image/webp" }
          : undefined;
      const beer = {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `beer-${Date.now()}`,
        name: draft.name,
        produktKategorie: draft.produktKategorie,
        bierstil: draft.bierstil,
        flaschenTyp: draft.flaschenTyp,
        flaschenfarbe: draft.flaschenfarbe,
        glasTyp: draft.glasTyp,
        etikettUrl: "",
        createdAt: new Date().toISOString(),
        ...(etikettPayload ? { etikettPayload } : {}),
      };
      const res = await fetch("/api/dashboard/my-beers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beer }),
      });
      const data = (await res.json()) as { beers?: DashboardBeer[]; revision?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "Speichern fehlgeschlagen.");
      setBeers(data.beers ?? []);
      setRevision(typeof data.revision === "string" ? data.revision : "");
      setCreateOpen(false);
      setCreateError("");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Speichern fehlgeschlagen.";
      setCreateError(message);
      throw e instanceof Error ? e : new Error(message);
    } finally {
      setSaving(false);
    }
  }

  async function onSelectionChange(nextSelected: string[]) {
    if (saving) return;
    const removed = selectedIds.filter((id) => !nextSelected.includes(id));
    if (removed.length === 0) return;
    const id = removed[0];
    const target = beers.find((beer) => beer.id === id);
    if (!target) return;
    const confirmed = window.confirm(`Sorte „${target.name}“ wirklich löschen?`);
    if (!confirmed) return;

    setSaving(true);
    setError(null);
    try {
      const next = beers.filter((beer) => beer.id !== id);
      const res = await fetch("/api/dashboard/my-beers", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beers: next, expectedRevision: revision }),
      });
      const data = (await res.json()) as { beers?: DashboardBeer[]; revision?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "Löschen fehlgeschlagen.");
      setBeers(data.beers ?? next);
      setRevision(typeof data.revision === "string" ? data.revision : "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Löschen fehlgeschlagen.");
      await reload();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="border-b border-border pb-3">
        <h2 className="m-0 text-[15px] font-semibold tracking-tight text-foreground">Sortiment</h2>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Biersorten und andere Getränke manuell anlegen — z.&nbsp;B. wenn der Website-Scan etwas übersehen
        hat. Danach beim Bildgenerieren als Produktreferenz wählbar.
      </p>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {!loaded ? (
        <p className="text-xs text-muted-foreground">Wird geladen…</p>
      ) : (
        <MemberSelector
          members={members}
          selected={selectedIds}
          onChange={(next) => void onSelectionChange(next)}
          max={MAX_MY_BEERS}
          maxVisible={MAX_MY_BEERS}
          addLabel="Neue Sorte"
          searchPlaceholder="Sorte suchen…"
          emptyLabel="Noch keine Sorten — über „Neue Sorte“ anlegen"
          onAddClick={() => {
            if (saving || beers.length >= MAX_MY_BEERS) return;
            setCreateError("");
            setCreateOpen(true);
          }}
        />
      )}

      <BeerCreateDialog
        open={createOpen}
        error={createError}
        onOpenChange={(open) => {
          if (saving && !open) return;
          setCreateOpen(open);
          if (!open) setCreateError("");
        }}
        onSave={handleCreate}
      />
    </div>
  );
}
