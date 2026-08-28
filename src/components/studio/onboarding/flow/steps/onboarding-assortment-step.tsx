"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { DashboardBeer } from "@/lib/dashboard/metadata";

export function OnboardingAssortmentStep({
  beers,
  draftName,
  draftStyle,
  error,
  reducedMotion,
  onChangeName,
  onChangeStyle,
  onAdd,
  onRemove,
}: {
  beers: DashboardBeer[];
  draftName: string;
  draftStyle: string;
  error: string;
  reducedMotion: boolean;
  onChangeName: (v: string) => void;
  onChangeStyle: (v: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="evg-onb-stack evg-onb-stack--lg">
      <div className="evg-onb-stack" style={{ gap: 8 }}>
        <span className="evg-onb-label">
          SORTIMENT{beers.length > 0 ? ` — ${beers.length}` : ""}
        </span>

        {beers.length === 0 ? (
          <div className="evg-onb-empty">
            <h3>Noch kein Sortiment angelegt</h3>
            <p>Lege deine erste Sorte an — Name und Bierstil reichen für den Start.</p>
          </div>
        ) : (
          <div className="evg-onb-stack" style={{ gap: 6 }}>
            <AnimatePresence initial={false}>
              {beers.map((beer) => (
                <motion.div
                  key={beer.id}
                  className="evg-onb-beer-row"
                  layout={!reducedMotion}
                  initial={reducedMotion ? false : { opacity: 0, y: 6, scale: 0.99 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={reducedMotion ? undefined : { opacity: 0, scale: 0.98 }}
                  transition={{ duration: reducedMotion ? 0 : 0.2, ease: [0.2, 0.7, 0.2, 1] }}
                >
                  <span className="evg-onb-beer-name">{beer.name}</span>
                  <span className="evg-onb-beer-meta">{beer.bierstil}</span>
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
      </div>

      <div className="evg-onb-panel evg-onb-stack" style={{ gap: 10 }}>
        <span className="evg-onb-label">SORTE HINZUFÜGEN</span>
        <div className="evg-onb-grid-2">
          <label className="evg-onb-field">
            <span className="evg-onb-label">NAME</span>
            <input
              className="evg-onb-input"
              value={draftName}
              onChange={(e) => onChangeName(e.target.value)}
              placeholder="z. B. Helles"
              maxLength={80}
            />
          </label>
          <label className="evg-onb-field">
            <span className="evg-onb-label">BIERSTIL</span>
            <input
              className="evg-onb-input"
              value={draftStyle}
              onChange={(e) => onChangeStyle(e.target.value)}
              placeholder="z. B. helles"
              maxLength={60}
            />
          </label>
        </div>
        <button type="button" className="evg-onb-btn evg-onb-btn--soft" style={{ alignSelf: "flex-start" }} onClick={onAdd}>
          Sorte hinzufügen
        </button>
        {error ? <p className="evg-onb-error">{error}</p> : null}
      </div>

      <p style={{ margin: 0, fontSize: 11.5, color: "var(--t3)" }}>
        Anlass-Vorlagen findest du später im Creator — sie werden hier nicht separat gespeichert.
      </p>
    </div>
  );
}
