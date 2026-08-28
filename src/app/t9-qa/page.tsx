"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { StudioButton } from "@/components/studio/ui";
import { studioFontClassName } from "@/lib/fonts/studio-fonts";

function StudioChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className={`evg-studio ${studioFontClassName}`} style={{ minHeight: "100dvh", background: "var(--app)" }}>
      <style>{`html, body { background: var(--app) !important; margin: 0; }`}</style>
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px 96px" }}>{children}</main>
    </div>
  );
}

function SettingsQaDemo({ view }: { view: string }) {
  const loaded = view !== "loading";
  const loadError = view === "error" ? "Einstellungen konnten nicht geladen werden." : null;
  const notice = view === "saved" ? "Gespeichert." : null;
  const error = view === "save-error" ? "Einstellungen konnten nicht gespeichert werden." : null;

  return (
    <>
      <p style={{ margin: "0 0 20px", fontSize: 12, color: "var(--t3)" }}>
        T9 QA — Einstellungen ({view}, Mock, keine API)
      </p>
      <div className="studio-settings-page">
        <header className="studio-settings-header">
          <span className="studio-settings-header__eyebrow">Einstellungen</span>
          <h1 className="studio-settings-title">Profil & Marke</h1>
          <p className="studio-settings-sub">Diese Angaben erscheinen in der Begrüßung und in Dashboard-Überschriften.</p>
        </header>

        {!loaded ? (
          <div className="studio-settings-empty">Lade Einstellungen…</div>
        ) : loadError ? (
          <div className="studio-settings-empty">
            {loadError}{" "}
            <button type="button">Erneut versuchen</button>
          </div>
        ) : (
          <>
            <div className="studio-settings-callout">
              <div className="studio-settings-callout__body">
                <div className="studio-settings-callout__title">Markenprofil aktiv</div>
                <div className="studio-settings-callout__sub">beispielbrauerei.de · Brand-Lock auf „Balanced“</div>
              </div>
              <div className="studio-settings-callout__actions">
                <StudioButton variant="soft" size="sm">
                  Profil verwalten
                </StudioButton>
              </div>
            </div>

            <div className="studio-settings-stack">
              <section className="studio-settings-section">
                <h2 className="studio-settings-section__title">Profil</h2>
                <div className="studio-settings-fields">
                  <label className="studio-settings-field">
                    <span className="studio-settings-field__label">Dein Name</span>
                    <input className="studio-settings-input" defaultValue="Erik Bauer" readOnly />
                  </label>
                  <label className="studio-settings-field">
                    <span className="studio-settings-field__label">Telefon</span>
                    <input className="studio-settings-input" defaultValue="+49 89 123456" readOnly />
                  </label>
                  <label className="studio-settings-field">
                    <span className="studio-settings-field__label">Marke</span>
                    <input className="studio-settings-input" defaultValue="Beispielbrauerei" readOnly />
                  </label>
                </div>
              </section>

              <section className="studio-settings-section">
                <h2 className="studio-settings-section__title">Benachrichtigungen</h2>
                <label className="studio-settings-toggle on">
                  <div className="studio-settings-toggle__copy">
                    <div className="studio-settings-toggle__label">E-Mail-Benachrichtigungen</div>
                    <div className="studio-settings-toggle__hint">Status zu Generierungen, Einladungen und Sicherheit.</div>
                  </div>
                  <span className="studio-settings-switch">
                    <span className="studio-settings-switch-knob" />
                  </span>
                </label>
                <label className="studio-settings-toggle">
                  <div className="studio-settings-toggle__copy">
                    <div className="studio-settings-toggle__label">Wochenzusammenfassung</div>
                    <div className="studio-settings-toggle__hint">Jeden Montag eine kurze E-Mail mit deinen Highlights.</div>
                  </div>
                  <span className="studio-settings-switch">
                    <span className="studio-settings-switch-knob" />
                  </span>
                </label>
              </section>
            </div>

            <div className="studio-settings-save-row">
              <StudioButton variant="primary" size="sm">
                Speichern
              </StudioButton>
              {notice ? <span className="studio-settings-notice">{notice}</span> : null}
              {error ? <span className="studio-settings-error">{error}</span> : null}
            </div>

            <section className="studio-settings-account">
              <div className="studio-settings-account__row">
                <div>
                  <div className="studio-settings-account__label">Konto</div>
                  <div className="studio-settings-account__hint">Sitzung auf diesem Gerät beenden</div>
                </div>
                <StudioButton variant="ghost" size="sm">
                  Abmelden
                </StudioButton>
              </div>
            </section>
          </>
        )}
      </div>
    </>
  );
}

function T9QaInner() {
  const searchParams = useSearchParams();
  const view = searchParams.get("view") ?? "normal";
  return (
    <StudioChrome>
      <SettingsQaDemo view={view} />
    </StudioChrome>
  );
}

export default function T9QaPage() {
  return (
    <Suspense fallback={null}>
      <T9QaInner />
    </Suspense>
  );
}
