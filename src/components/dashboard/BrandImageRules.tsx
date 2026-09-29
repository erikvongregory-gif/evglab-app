"use client";

/* eslint-disable @next/next/no-img-element */
import { AnimatePresence, motion, useReducedMotion, type Transition } from "framer-motion";
import { useRef, useState, type ReactNode } from "react";

const EASE = [0.2, 0.7, 0.2, 1] as const;
const INSTANT: Transition = { duration: 0 };

/** Wie parseRuleSentences, trennt aber zusätzlich an „;“ (manuell gepflegte Profile). */
function splitRules(text: string): string[] {
  return text
    .split(/\n|;|(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const joinRules = (items: string[]) => items.map((s) => s.trim()).filter(Boolean).join("\n");

type Tone = "do" | "dont";

function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FrameIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function BanIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6 6l12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function MarkIcon({ tone }: { tone: Tone }) {
  return tone === "do" ? (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function RuleItem({
  text,
  tone,
  index,
  removable,
  autoEdit,
  reducedMotion,
  onCommit,
  onRemove,
}: {
  text: string;
  tone: Tone;
  index: number;
  removable: boolean;
  autoEdit?: boolean;
  reducedMotion: boolean;
  onCommit: (next: string) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(Boolean(autoEdit));
  const [draft, setDraft] = useState(text);
  const cancelled = useRef(false);

  const commit = () => {
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    setEditing(false);
    const next = draft.replace(/\s+/g, " ").trim();
    if (!next) {
      onRemove();
      return;
    }
    if (next !== text) onCommit(next);
  };

  return (
    <motion.li
      layout={reducedMotion ? false : "position"}
      className={`studio-rules-item${editing ? " is-editing" : ""}`}
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reducedMotion ? undefined : { opacity: 0, x: -12, transition: { duration: 0.16 } }}
      transition={reducedMotion ? INSTANT : { duration: 0.3, delay: autoEdit ? 0 : 0.08 + index * 0.05, ease: EASE }}
    >
      <span className={`studio-rules-mark studio-rules-mark--${tone}`}>
        <MarkIcon tone={tone} />
      </span>
      {editing ? (
        <textarea
          className="studio-rules-edit"
          value={draft}
          rows={2}
          autoFocus
          maxLength={240}
          aria-label="Regel bearbeiten"
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.blur();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              cancelled.current = true;
              setDraft(text);
              setEditing(false);
              if (!text) onRemove();
            }
          }}
        />
      ) : (
        <button
          type="button"
          className="studio-rules-text"
          title="Zum Bearbeiten klicken"
          onClick={() => {
            setDraft(text);
            setEditing(true);
          }}
        >
          {text}
        </button>
      )}
      {removable && !editing ? (
        <button type="button" className="studio-rules-remove" aria-label="Regel entfernen" onClick={onRemove}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>
      ) : null}
    </motion.li>
  );
}

function RuleList({
  items,
  tone,
  addLabel,
  emptyLabel,
  minItems = 0,
  maxItems = 6,
  reducedMotion,
  onChange,
}: {
  items: string[];
  tone: Tone;
  addLabel?: string;
  emptyLabel: string;
  minItems?: number;
  maxItems?: number;
  reducedMotion: boolean;
  onChange: (next: string[]) => void;
}) {
  // Stabile Keys, damit Einträge beim Entfernen sauber rausanimieren.
  const [keys, setKeys] = useState(() => items.map((_, i) => `r${i}`));
  const [adding, setAdding] = useState(false);
  const counter = useRef(items.length);
  const rowKeys = items.map((_, i) => keys[i] ?? `r${i}`);

  return (
    <>
      <ul className="studio-rules-list">
        <AnimatePresence initial={true}>
          {items.map((item, i) => (
            <RuleItem
              key={rowKeys[i]}
              text={item}
              tone={tone}
              index={i}
              removable={items.length > minItems}
              reducedMotion={reducedMotion}
              onCommit={(next) => onChange(items.map((it, j) => (j === i ? next : it)))}
              onRemove={() => {
                setKeys(rowKeys.filter((_, j) => j !== i));
                onChange(items.filter((_, j) => j !== i));
              }}
            />
          ))}
          {adding ? (
            <RuleItem
              key="new"
              text=""
              tone={tone}
              index={items.length}
              removable={false}
              autoEdit
              reducedMotion={reducedMotion}
              onCommit={(next) => {
                setAdding(false);
                counter.current += 1;
                setKeys([...rowKeys, `r${counter.current}`]);
                onChange([...items, next]);
              }}
              onRemove={() => setAdding(false)}
            />
          ) : null}
        </AnimatePresence>
      </ul>
      {items.length === 0 && !adding ? <p className="studio-rules-empty">{emptyLabel}</p> : null}
      {addLabel && items.length < maxItems && !adding ? (
        <button type="button" className={`studio-rules-add studio-rules-add--${tone}`} onClick={() => setAdding(true)}>
          <span aria-hidden="true">+</span>
          {addLabel}
        </button>
      ) : null}
    </>
  );
}

function Thumbs({ urls, swatches, reducedMotion }: { urls: string[]; swatches: string[]; reducedMotion: boolean }) {
  if (urls.length === 0) {
    return (
      <div className="studio-rules-swatches" aria-hidden="true">
        {swatches.slice(0, 5).map((c, i) => (
          <motion.span
            key={`${c}-${i}`}
            style={{ background: c }}
            initial={reducedMotion ? false : { scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={reducedMotion ? INSTANT : { duration: 0.45, delay: 0.1 + i * 0.06, ease: EASE }}
          />
        ))}
      </div>
    );
  }
  return (
    <div className="studio-rules-thumbs" aria-hidden="true">
      {urls.slice(0, 3).map((url, i) => (
        <motion.span
          key={url}
          className="studio-rules-thumb"
          initial={reducedMotion ? false : { opacity: 0, scale: 1.08 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={reducedMotion ? INSTANT : { duration: 0.5, delay: 0.08 + i * 0.08, ease: EASE }}
        >
          <img src={url} alt="" loading="lazy" />
        </motion.span>
      ))}
    </div>
  );
}

function RuleCard({
  tone,
  icon,
  eyebrow,
  title,
  hint,
  delay,
  reducedMotion,
  media,
  children,
  className = "",
}: {
  tone: Tone;
  icon: ReactNode;
  eyebrow: string;
  title: string;
  hint: string;
  delay: number;
  reducedMotion: boolean;
  media?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.article
      className={`studio-rules-card studio-rules-card--${tone} ${className}`}
      initial={reducedMotion ? false : { opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={reducedMotion ? INSTANT : { duration: 0.42, delay, ease: EASE }}
    >
      {media}
      <div className="studio-rules-card-body">
        <header className="studio-rules-card-head">
          <span className={`studio-rules-icon studio-rules-icon--${tone}`}>{icon}</span>
          <div className="studio-rules-card-titles">
            <span className="studio-rules-eyebrow">{eyebrow}</span>
            <h3 className="studio-rules-title">{title}</h3>
          </div>
          <span className="studio-rules-hint">{hint}</span>
        </header>
        {children}
      </div>
    </motion.article>
  );
}

export function BrandImageRules({
  dos,
  donts,
  referenceImageUrls,
  swatches,
  onSave,
}: {
  dos: string;
  donts: string;
  referenceImageUrls: string[];
  swatches: string[];
  onSave: (patch: { brandDos?: string; brandDonts?: string }) => Promise<void> | void;
}) {
  const reducedMotion = useReducedMotion() ?? false;
  const [error, setError] = useState<string | null>(null);
  const [savedPulse, setSavedPulse] = useState(0);

  const dosItems = splitRules(dos);
  const licht = dosItems.slice(0, 1);
  const szene = dosItems.slice(1);
  const tabu = splitRules(donts);

  const persist = async (patch: { brandDos?: string; brandDonts?: string }) => {
    setError(null);
    try {
      await onSave(patch);
      setSavedPulse((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    }
  };

  const saveDos = (nextLicht: string[], nextSzene: string[]) =>
    void persist({ brandDos: joinRules([...nextLicht, ...nextSzene]) });

  const refs = referenceImageUrls.filter(Boolean);

  return (
    <div className="studio-rules">
      <div className="studio-rules-grid">
        <RuleCard
          tone="do"
          icon={<SunIcon />}
          eyebrow="Licht"
          title="Bildlicht"
          hint="Stimmung"
          delay={0}
          reducedMotion={reducedMotion}
          media={<Thumbs urls={refs.slice(0, 3)} swatches={swatches} reducedMotion={reducedMotion} />}
        >
          <RuleList
            items={licht}
            tone="do"
            emptyLabel="Noch keine Lichtregel."
            addLabel={licht.length === 0 ? "Lichtregel ergänzen" : undefined}
            maxItems={1}
            reducedMotion={reducedMotion}
            onChange={(next) => saveDos(next, szene)}
          />
        </RuleCard>

        <RuleCard
          tone="do"
          icon={<FrameIcon />}
          eyebrow="Szene"
          title="Komposition"
          hint="Setting"
          delay={0.08}
          reducedMotion={reducedMotion}
          media={
            <Thumbs
              urls={refs.length > 3 ? refs.slice(3, 6) : refs.slice().reverse().slice(0, 3)}
              swatches={swatches.slice().reverse()}
              reducedMotion={reducedMotion}
            />
          }
        >
          <RuleList
            items={szene}
            tone="do"
            emptyLabel="Noch keine Szenenregel."
            addLabel="Szene ergänzen"
            reducedMotion={reducedMotion}
            onChange={(next) => saveDos(licht.length ? licht : next.slice(0, 1), licht.length ? next : next.slice(1))}
          />
        </RuleCard>
      </div>

      <RuleCard
        tone="dont"
        icon={<BanIcon />}
        eyebrow="Vermeiden"
        title="Tabu"
        hint="Wird nie generiert"
        delay={0.16}
        reducedMotion={reducedMotion}
        className="studio-rules-card--wide"
      >
        <RuleList
          items={tabu}
          tone="dont"
          emptyLabel="Keine Tabus hinterlegt."
          addLabel="Tabu ergänzen"
          maxItems={8}
          reducedMotion={reducedMotion}
          onChange={(next) => void persist({ brandDonts: joinRules(next) })}
        />
      </RuleCard>

      <div className="studio-rules-foot" aria-live="polite">
        {error ? (
          <span className="studio-rules-error" role="alert">
            {error}
          </span>
        ) : (
          <>
            <span>Klick auf eine Regel zum Bearbeiten · Enter speichert · Esc verwirft</span>
            <AnimatePresence>
              {savedPulse > 0 ? (
                <motion.span
                  key={savedPulse}
                  className="studio-rules-saved"
                  initial={reducedMotion ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reducedMotion ? 0 : 0.2 }}
                >
                  ✓ Gespeichert
                </motion.span>
              ) : null}
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  );
}
