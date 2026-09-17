"use client";

import Image from "next/image";
import { useId, useState } from "react";
import { ArrowRight, Check, Globe2, Images, Palette, ScanLine, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import styles from "./brand-profile-empty-state.module.css";

type BrandProfileEmptyStateProps = {
  skipped: boolean;
  initialWebsiteUrl?: string;
  onQuickAnalyze?: (url: string) => void;
  onOpenBrandSetup: () => void;
  onSkipBrandProfile: () => void;
};

export function BrandProfileEmptyState({
  skipped,
  initialWebsiteUrl = "",
  onQuickAnalyze,
  onOpenBrandSetup,
  onSkipBrandProfile,
}: BrandProfileEmptyStateProps) {
  const inputId = useId();
  const [url, setUrl] = useState(initialWebsiteUrl);
  const [error, setError] = useState("");

  function submit() {
    setError("");
    let website: URL;
    try {
      const raw = url.trim();
      website = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
      if (!raw || !["http:", "https:"].includes(website.protocol) || !website.hostname.includes(".") || website.username || website.password) {
        throw new Error();
      }
    } catch {
      setError("Bitte gib eine gültige Website ein, zum Beispiel deine-brauerei.de.");
      return;
    }
    if (onQuickAnalyze) onQuickAnalyze(website.toString());
    else onOpenBrandSetup();
  }

  return (
    <section className={styles.page} aria-labelledby="brand-empty-title">
      <header className={styles.header}>
        <div>
          <h1 id="brand-empty-title" className="text-2xl font-semibold tracking-tight">Markenprofil</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Dein Stil. Die Grundlage für deine Motive.</p>
        </div>
        <span className={styles.status}><span aria-hidden="true" />{skipped ? "Aktuell ohne Markenprofil" : "Noch nicht eingerichtet"}</span>
      </header>

      <div className={styles.hero}>
        <div className={styles.copy}>
          <span className={styles.eyebrow}><Palette size={15} aria-hidden="true" /> Unverwechselbar deine Marke</span>
          <h2 className={styles.headline}>Damit jedes Motiv<br />nach dir aussieht.</h2>
          <p className={styles.lead}>Deine Farben, dein Ton, deine Bildsprache. Hinterlege einmal, was deine Marke ausmacht — und gib jedem neuen Motiv eine gemeinsame Richtung.</p>

          <form className={styles.form} onSubmit={(event) => { event.preventDefault(); submit(); }}>
            <Label htmlFor={inputId} className="text-sm font-medium">Starte mit deiner Website</Label>
            <div className={styles.inputRow}>
              <div className={styles.inputWrap}>
                <Globe2 size={17} aria-hidden="true" />
                <Input
                  id={inputId}
                  value={url}
                  onChange={(event) => { setUrl(event.target.value); if (error) setError(""); }}
                  placeholder="deine-brauerei.de"
                  inputMode="url"
                  autoComplete="url"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  maxLength={2000}
                  aria-invalid={Boolean(error)}
                  aria-describedby={`${inputId}-hint${error ? ` ${inputId}-error` : ""}`}
                  className="h-12 bg-background pl-10 text-base md:text-sm"
                />
              </div>
              <Button type="submit" disabled={!url.trim()} className="h-12 gap-2 px-4">
                Website einlesen <ArrowRight size={16} aria-hidden="true" />
              </Button>
            </div>
            {error ? <p id={`${inputId}-error`} role="alert" className="text-sm text-destructive">{error}</p> : null}
            <p id={`${inputId}-hint`} className="flex items-start gap-1.5 text-xs leading-5 text-muted-foreground"><Check size={14} className="mt-0.5 shrink-0" aria-hidden="true" />Du prüfst das Ergebnis, bevor du es übernimmst.</p>
          </form>

          <div className={styles.alternative}>
            <Button type="button" variant="ghost" onClick={onOpenBrandSetup} className="h-auto min-h-11 justify-start gap-3 whitespace-normal px-2 py-2 text-left">
              <span className={styles.alternativeIcon}><Images size={17} aria-hidden="true" /></span>
              <span><span className="block text-sm font-medium">Keine Website? Geht auch anders.</span><span className="mt-0.5 block text-xs font-normal text-muted-foreground">Instagram, Screenshots oder manuell starten</span></span>
              <ArrowRight size={15} className="ml-auto" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <figure className={styles.preview} aria-label="Beispiel eines Markenprofils mit Typografie, Farben und Bildsprache">
          <div className={styles.board} aria-hidden="true">
            <div className={styles.typeCard}>
              <span className={styles.cardLabel}>Typografie</span>
              <span className={styles.letters}>Aa<span>Bb</span></span>
              <span className={styles.typeNote}>Charakter in jedem Detail.</span>
            </div>
            <div className={styles.imageCard}>
              <Image src="/studio-templates/produkt.png" alt="" fill sizes="(max-width: 640px) 200px, 300px" className="object-cover" />
              <span className={styles.imageLabel}>Bildsprache</span>
            </div>
            <div className={styles.paletteCard}>
              <div className={styles.cardTop}><span>Deine Farbwelt</span><Palette size={14} /></div>
              <div className={styles.swatches}><span /><span /><span /><span /><span /></div>
              <span className={styles.paletteNote}>Eine Marke. Ein stimmiges Gesamtbild.</span>
            </div>
            <div className={styles.toneCard}><span className={styles.cardLabel}>Tonalität</span><div><span>Ehrlich</span><span>Handwerklich</span><span>Nahbar</span></div></div>
          </div>
          <figcaption className={styles.caption}>Beispielprofil · Dein Ergebnis wird auf deine Marke abgestimmt.</figcaption>
        </figure>
      </div>

      <ol className={styles.steps} aria-label="So entsteht dein Markenprofil">
        {[
          { icon: Globe2, title: "Quelle verbinden", text: "Website oder Referenzen hinzufügen." },
          { icon: ScanLine, title: "Marke erkennen", text: "Wir schlagen Farben, Tonalität und Bildregeln vor." },
          { icon: SlidersHorizontal, title: "Prüfen & verfeinern", text: "Du entscheidest, was zu deiner Marke passt." },
        ].map(({ icon: Icon, title, text }, index) => <li key={title}><span className={styles.stepIcon}><Icon size={18} aria-hidden="true" /></span><div><p className="text-sm font-medium"><span className="mr-2 text-xs tabular-nums text-muted-foreground">0{index + 1}</span>{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p></div></li>)}
      </ol>
      <footer className={styles.footer}>
        <p className="text-xs leading-5 text-muted-foreground">{skipped ? "Du kannst weiterhin ohne Markenprofil generieren und es jederzeit ergänzen." : "Du kannst dein Markenprofil jederzeit ändern oder später einrichten."}</p>
        {!skipped ? <Button type="button" variant="ghost" onClick={onSkipBrandProfile} className="h-10 shrink-0 text-xs text-muted-foreground">Vorerst ohne Profil fortfahren <ArrowRight size={14} aria-hidden="true" /></Button> : null}
      </footer>
    </section>
  );
}
