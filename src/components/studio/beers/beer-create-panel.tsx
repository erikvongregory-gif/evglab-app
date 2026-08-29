"use client";

/* eslint-disable @next/next/no-img-element */
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useId, useRef, useState } from "react";
import {
  BEER_STYLE_OPTIONS,
  beerStyleLabel,
} from "@/app/(dashboard)/inhalte-erstellen/lib/beer-styles";
import {
  FLASCHEN_TYPEN,
  isDoseTyp,
} from "@/app/(dashboard)/inhalte-erstellen/lib/brewing-knowledge";
import { readAndCompressImage } from "@/lib/images/compress-image";

const EASE = [0.2, 0.7, 0.2, 1] as const;

const FLASCHEN_CHOICES = Object.entries(FLASCHEN_TYPEN).map(([code, item]) => ({
  code,
  label: item.pillLabel,
}));

const FARBE_CHOICES = [
  { code: "braun" as const, label: "Braun", swatch: "#6b4423" },
  { code: "gruen" as const, label: "Grün", swatch: "#2f5d3a" },
  { code: "klar" as const, label: "Klar", swatch: "#c8d0d8" },
];

const FARBE_LABEL: Record<(typeof FARBE_CHOICES)[number]["code"], string> = {
  braun: "Braune Flasche",
  gruen: "Grüne Flasche",
  klar: "Klare Flasche",
};

export type BeerCreateDraft = {
  name: string;
  bierstil: string;
  flaschenTyp: string;
  flaschenfarbe: "braun" | "gruen" | "klar";
  etikettDataUrl: string;
};

type SavePhase = "idle" | "saving" | "success";

function BottleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 64" fill="none" aria-hidden="true">
      <path
        d="M13 4h6v6c0 2 1.2 3.2 1.2 5.4V18c2.4 1.2 4 3.6 4 6.4v28.2c0 3.2-2.6 5.4-5.8 5.4h-4.8c-3.2 0-5.8-2.2-5.8-5.4V24.4c0-2.8 1.6-5.2 4-6.4v-2.6C11.8 13.2 13 12 13 10V4Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M12.5 4.5h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function buildPromptPreview(parts: {
  name: string;
  bierstil: string;
  flaschenTyp: string;
  flaschenfarbe: "braun" | "gruen" | "klar";
  brandTone: string;
}): string {
  const segments: string[] = [];
  const style = beerStyleLabel(parts.bierstil);
  if (style) segments.push(style);
  const vessel = FLASCHEN_CHOICES.find((f) => f.code === parts.flaschenTyp)?.label;
  if (vessel) segments.push(vessel);
  if (!isDoseTyp(parts.flaschenTyp as keyof typeof FLASCHEN_TYPEN)) {
    segments.push(FARBE_LABEL[parts.flaschenfarbe]);
  }
  const tone = parts.brandTone.trim();
  if (tone) segments.push(`Markenstil „${tone}“`);
  if (parts.name.trim()) segments.unshift(parts.name.trim());
  return segments.join(" · ");
}

export function BeerCreatePanel({
  brandTone = "",
  error = "",
  reducedMotion: reducedMotionProp,
  onSave,
  onCancel,
}: {
  brandTone?: string;
  error?: string;
  reducedMotion?: boolean;
  onSave: (draft: BeerCreateDraft) => Promise<void>;
  onCancel: () => void;
}) {
  const reducedMotionHook = useReducedMotion() ?? false;
  const reducedMotion = reducedMotionProp ?? reducedMotionHook;
  const fileInputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);

  const [manualOnly, setManualOnly] = useState(false);
  const [name, setName] = useState("");
  const [bierstil, setBierstil] = useState("helles");
  const [flaschenTyp, setFlaschenTyp] = useState("nrw_500");
  const [flaschenfarbe, setFlaschenfarbe] = useState<"braun" | "gruen" | "klar">("braun");
  const [etikettDataUrl, setEtikettDataUrl] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [localError, setLocalError] = useState("");
  const [phase, setPhase] = useState<SavePhase>("idle");
  const [previewKey, setPreviewKey] = useState(0);

  const showDose = isDoseTyp(flaschenTyp as keyof typeof FLASCHEN_TYPEN);
  const preview = buildPromptPreview({ name, bierstil, flaschenTyp, flaschenfarbe, brandTone });
  const displayError = localError || error || uploadError;
  const busy = phase === "saving" || phase === "success";

  const acceptFile = async (file: File | undefined) => {
    if (!file || busy) return;
    setUploadError("");
    try {
      if (!file.type.startsWith("image/")) {
        throw new Error("Bitte ein Bild auswählen (PNG, JPG, WEBP).");
      }
      if (file.size > 12 * 1024 * 1024) {
        throw new Error("Datei zu groß — bitte unter 12 MB.");
      }
      const dataUrl = await readAndCompressImage(file);
      setEtikettDataUrl(dataUrl);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload fehlgeschlagen.");
    }
  };

  const handleSave = async () => {
    if (busy) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setLocalError("Bitte gib deiner Sorte einen Namen.");
      return;
    }
    setLocalError("");
    setPhase("saving");
    try {
      await onSave({
        name: trimmed.slice(0, 80),
        bierstil,
        flaschenTyp,
        flaschenfarbe,
        etikettDataUrl,
      });
      setPhase("success");
      window.setTimeout(() => onCancel(), reducedMotion ? 40 : 400);
    } catch (err) {
      setPhase("idle");
      setLocalError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    }
  };

  const stagger = (delayMs: number) =>
    reducedMotion
      ? { initial: false as const, animate: { opacity: 1 }, transition: { duration: 0 } }
      : {
          initial: { opacity: 0, y: 6 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.22, delay: delayMs / 1000, ease: EASE },
        };

  return (
    <motion.div
      className={`studio-beer-create${manualOnly ? " studio-beer-create--manual" : ""}`}
      initial={reducedMotion ? false : { opacity: 0, scale: 0.992, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={reducedMotion ? undefined : { opacity: 0, scale: 0.992, y: -3 }}
      transition={{ duration: reducedMotion ? 0.08 : 0.24, ease: EASE }}
    >
      <motion.header className="studio-beer-create-header" {...stagger(0)}>
        <div className="studio-beer-create-header-copy">
          <h3 className="studio-beer-create-title">Neue Sorte anlegen</h3>
          <p className="studio-beer-create-lead">
            Hinterlege die wichtigsten Merkmale deiner Sorte. BrewAI verwendet sie später automatisch
            bei der Motiverstellung.
          </p>
        </div>
        <button
          type="button"
          className="studio-beer-create-manual-btn"
          onClick={() => setManualOnly((v) => !v)}
          disabled={busy}
        >
          {manualOnly ? "Mit Foto" : "Manuell anlegen"}
        </button>
      </motion.header>

      <div className="studio-beer-create-body">
        <AnimatePresence initial={false} mode="popLayout">
          {!manualOnly ? (
            <motion.div
              key="dropzone-col"
              className="studio-beer-create-media"
              initial={reducedMotion ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, x: -8 }}
              transition={{
                duration: reducedMotion ? 0 : 0.2,
                delay: reducedMotion ? 0 : 0.04,
                ease: EASE,
              }}
            >
              <div
                className={`studio-beer-create-drop${dragOver ? " is-drag" : ""}${etikettDataUrl ? " has-preview" : ""}`}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  void acceptFile(e.dataTransfer.files?.[0]);
                }}
              >
                <AnimatePresence mode="wait">
                  {etikettDataUrl ? (
                    <motion.div
                      key="preview"
                      className="studio-beer-create-drop-preview"
                      initial={reducedMotion ? false : { opacity: 0, scale: 1.015 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={reducedMotion ? undefined : { opacity: 0, scale: 0.985 }}
                      transition={{ duration: reducedMotion ? 0 : 0.22, ease: EASE }}
                    >
                      <img src={etikettDataUrl} alt="Flaschenfoto Vorschau" />
                      <button
                        type="button"
                        className="studio-beer-create-drop-change"
                        onClick={() => fileRef.current?.click()}
                        disabled={busy}
                      >
                        Anderes Bild
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="empty"
                      className="studio-beer-create-drop-empty"
                      initial={reducedMotion ? false : { opacity: 0, scale: 0.985 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={reducedMotion ? undefined : { opacity: 0, scale: 0.985 }}
                      transition={{ duration: reducedMotion ? 0 : 0.12, ease: EASE }}
                    >
                      <BottleIcon className="studio-beer-create-bottle" />
                      <p className="studio-beer-create-drop-title">Flaschenfoto hierher ziehen</p>
                      <p className="studio-beer-create-drop-hint">
                        Ein Bild reicht. Etikett sollte lesbar sein.
                      </p>
                      <label htmlFor={fileInputId} className="studio-beer-create-file-btn">
                        Datei wählen
                      </label>
                    </motion.div>
                  )}
                </AnimatePresence>
                <input
                  ref={fileRef}
                  id={fileInputId}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="studio-beer-create-file-input"
                  disabled={busy}
                  onChange={(e) => {
                    void acceptFile(e.target.files?.[0]);
                    e.currentTarget.value = "";
                  }}
                />
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <motion.div className="studio-beer-create-form" {...stagger(65)}>
          <label className="studio-beer-create-field">
            <span className="studio-beer-create-label">Name der Sorte</span>
            <input
              className="studio-beer-create-input"
              value={name}
              maxLength={80}
              placeholder="z. B. Falter Hell"
              disabled={busy}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
            />
          </label>

          <div className="studio-beer-create-field">
            <span className="studio-beer-create-label">Bierstil</span>
            <div className="studio-beer-create-chips" role="group" aria-label="Bierstil">
              {BEER_STYLE_OPTIONS.map((opt) => {
                const on = bierstil === opt.bierstil;
                return (
                  <button
                    key={opt.bierstil}
                    type="button"
                    className={`studio-beer-create-chip${on ? " is-on" : ""}`}
                    aria-pressed={on}
                    disabled={busy}
                    onClick={() => {
                      setBierstil(opt.bierstil);
                      setPreviewKey((k) => k + 1);
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="studio-beer-create-attrs">
            <div className="studio-beer-create-field">
              <span className="studio-beer-create-label">Flaschenfarbe</span>
              <div className="studio-beer-create-chips" role="group" aria-label="Flaschenfarbe">
                {FARBE_CHOICES.map((opt) => {
                  const on = flaschenfarbe === opt.code;
                  return (
                    <button
                      key={opt.code}
                      type="button"
                      className={`studio-beer-create-chip studio-beer-create-chip--swatch${on ? " is-on" : ""}`}
                      aria-pressed={on}
                      disabled={busy || showDose}
                      onClick={() => {
                        setFlaschenfarbe(opt.code);
                        setPreviewKey((k) => k + 1);
                      }}
                    >
                      <span
                        className="studio-beer-create-swatch"
                        style={{ background: opt.swatch }}
                        aria-hidden="true"
                      />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              {showDose ? (
                <p className="studio-beer-create-note">Bei Dosen entfällt die Flaschenfarbe.</p>
              ) : null}
            </div>

            <div className="studio-beer-create-field">
              <span className="studio-beer-create-label">Flaschentyp</span>
              <div className="studio-beer-create-chips" role="group" aria-label="Flaschentyp">
                {FLASCHEN_CHOICES.map((opt) => {
                  const on = flaschenTyp === opt.code;
                  return (
                    <button
                      key={opt.code}
                      type="button"
                      className={`studio-beer-create-chip${on ? " is-on" : ""}`}
                      aria-pressed={on}
                      disabled={busy}
                      onClick={() => {
                        setFlaschenTyp(opt.code);
                        setPreviewKey((k) => k + 1);
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <AnimatePresence>
            {displayError ? (
              <motion.p
                className="studio-beer-create-error"
                role="alert"
                initial={reducedMotion ? false : { opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reducedMotion ? 0 : 0.14 }}
              >
                {displayError}
              </motion.p>
            ) : null}
          </AnimatePresence>

          <motion.div className="studio-beer-create-actions" {...stagger(115)}>
            <button
              type="button"
              className={`studio-beer-create-save${phase === "success" ? " is-success" : ""}`}
              disabled={busy}
              onClick={() => void handleSave()}
            >
              {phase === "saving" ? (
                <>
                  <span className="studio-beer-create-spinner" aria-hidden="true" />
                  Wird gespeichert …
                </>
              ) : phase === "success" ? (
                "✓ Sorte gespeichert"
              ) : (
                "Sorte übernehmen"
              )}
            </button>
            <button
              type="button"
              className="studio-beer-create-cancel"
              disabled={busy}
              onClick={onCancel}
            >
              Abbrechen
            </button>
            <span className="studio-beer-create-actions-hint">Danach immer vorausgefüllt</span>
          </motion.div>
        </motion.div>
      </div>

      <motion.footer className="studio-beer-create-preview" {...stagger(140)}>
        <span className="studio-beer-create-preview-label">So geht die Sorte in den Prompt</span>
        <div className="studio-beer-create-preview-surface">
          <span
            className="studio-beer-create-preview-swatch"
            style={{
              background: showDose
                ? "linear-gradient(145deg, #b8b8b8, #6e6e6e)"
                : FARBE_CHOICES.find((f) => f.code === flaschenfarbe)?.swatch,
            }}
            aria-hidden="true"
          />
          <motion.p
            key={previewKey}
            className="studio-beer-create-preview-text"
            initial={reducedMotion ? false : { opacity: 0.55 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reducedMotion ? 0 : 0.12 }}
          >
            {preview || "Name, Stil und Flasche erscheinen hier."}
          </motion.p>
        </div>
      </motion.footer>
    </motion.div>
  );
}
