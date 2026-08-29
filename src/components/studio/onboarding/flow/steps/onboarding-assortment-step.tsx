"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import {
  BeerCreatePanel,
  type BeerCreateDraft,
} from "@/components/studio/beers/beer-create-panel";
import { beerStyleLabel } from "@/app/(dashboard)/inhalte-erstellen/lib/beer-styles";
import { FLASCHEN_TYPEN } from "@/app/(dashboard)/inhalte-erstellen/lib/brewing-knowledge";
import type { DashboardBeer } from "@/lib/dashboard/metadata";
import { MAX_MY_BEERS } from "@/lib/dashboard/metadata";

function vesselLabel(code: string): string {
  const entry = FLASCHEN_TYPEN[code as keyof typeof FLASCHEN_TYPEN];
  return entry?.pillLabel ?? code;
}

export function OnboardingAssortmentStep({
  beers,
  brandTone,
  error,
  reducedMotion,
  onCreate,
  onRemove,
}: {
  beers: DashboardBeer[];
  brandTone?: string;
  error: string;
  reducedMotion: boolean;
  onCreate: (draft: BeerCreateDraft) => Promise<DashboardBeer | null>;
  onRemove: (id: string) => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [freshId, setFreshId] = useState<string | null>(null);
  const [panelError, setPanelError] = useState("");

  const handleSave = async (draft: BeerCreateDraft) => {
    setPanelError("");
    try {
      const created = await onCreate(draft);
      if (created?.id) {
        setFreshId(created.id);
        window.setTimeout(() => setFreshId(null), 750);
      }
      // Panel schließt sich nach Success-Flash selbst via onCancel.
    } catch (err) {
      setPanelError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
      throw err;
    }
  };

  return (
    <div className="evg-onb-stack evg-onb-stack--lg">
      <div className="evg-onb-stack" style={{ gap: 8 }}>
        <span className="evg-onb-label">
          SORTIMENT{beers.length > 0 ? ` — ${beers.length}` : ""}
        </span>

        <AnimatePresence mode="wait" initial={false}>
          {createOpen ? (
            <BeerCreatePanel
              key="create"
              brandTone={brandTone}
              error={panelError || error}
              reducedMotion={reducedMotion}
              onSave={handleSave}
              onCancel={() => {
                setCreateOpen(false);
                setPanelError("");
              }}
            />
          ) : (
            <motion.div
              key="list"
              className="studio-beer-create-list-wrap"
              initial={reducedMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, y: -4 }}
              transition={{ duration: reducedMotion ? 0 : 0.18, ease: [0.2, 0.7, 0.2, 1] }}
            >
              {beers.length === 0 ? (
                <div className="evg-onb-empty">
                  <h3>Noch kein Sortiment angelegt</h3>
                  <p>Lege deine erste Sorte an — Stil, Glas und Gefäß steuern später die Motive.</p>
                </div>
              ) : (
                <div className="evg-onb-stack" style={{ gap: 6 }}>
                  <AnimatePresence initial={false}>
                    {beers.map((beer) => (
                      <motion.div
                        key={beer.id}
                        className={`evg-onb-beer-row${freshId === beer.id ? " is-fresh" : ""}`}
                        layout={!reducedMotion}
                        initial={reducedMotion ? false : { opacity: 0, y: 7, scale: 0.99 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={reducedMotion ? undefined : { opacity: 0, scale: 0.98 }}
                        transition={{ duration: reducedMotion ? 0 : 0.2, ease: [0.2, 0.7, 0.2, 1] }}
                      >
                        <span className="evg-onb-beer-name">{beer.name}</span>
                        <span className="evg-onb-beer-meta">
                          {beerStyleLabel(beer.bierstil)} · {vesselLabel(beer.flaschenTyp)}
                        </span>
                        <button
                          type="button"
                          className="evg-onb-btn evg-onb-btn--text"
                          style={{ height: 28, padding: "0 8px" }}
                          onClick={() => onRemove(beer.id)}
                        >
                          Entfernen
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}

              <button
                type="button"
                className="studio-beer-create-add"
                disabled={beers.length >= MAX_MY_BEERS}
                onClick={() => {
                  setPanelError("");
                  setCreateOpen(true);
                }}
              >
                + Neue Sorte
              </button>

              {error && !createOpen ? <p className="evg-onb-error">{error}</p> : null}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p style={{ margin: 0, fontSize: 11.5, color: "var(--t3)" }}>
        Anlass-Vorlagen findest du später im Creator — sie werden hier nicht separat gespeichert.
      </p>
    </div>
  );
}
