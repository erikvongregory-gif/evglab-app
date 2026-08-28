"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { StudioButton } from "@/components/studio/ui";
import { studioFontClassName } from "@/lib/fonts/studio-fonts";

const MOCK_MEMBERS = [
  { id: "1", name: "Erik Bauer", email: "erik@beispielbrauerei.de", role: "owner", status: "active" as const },
  { id: "2", name: "Marie Keller", email: "marie@beispielbrauerei.de", role: "editor", status: "active" as const },
  { id: "3", name: "Lisa Hofmann", email: "lisa@beispielbrauerei.de", role: "editor", status: "invited" as const },
];

function StudioChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className={`evg-studio ${studioFontClassName}`} style={{ minHeight: "100dvh", background: "var(--app)" }}>
      <style>{`html, body { background: var(--app) !important; margin: 0; }`}</style>
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px 96px" }}>{children}</main>
    </div>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function TeamQaDemo({ view }: { view: string }) {
  const members = view === "empty" ? [] : MOCK_MEMBERS;
  const error = view === "error" ? "Einladung fehlgeschlagen." : null;
  const notice = view === "notice" ? "Einladung an kollege@beispiel.de verschickt." : null;

  return (
    <>
      <p style={{ margin: "0 0 20px", fontSize: 12, color: "var(--t3)" }}>
        T10 QA — Team ({view}, Mock, keine API)
      </p>
      <div className="studio-team-page">
        <header className="studio-team-header">
          <div>
            <span className="studio-team-header__eyebrow">Team</span>
            <h1 className="studio-team-title">Mitglieder</h1>
            <p className="studio-team-sub">Lade Kolleginnen und Kollegen ein, um gemeinsam Motive zu erstellen.</p>
          </div>
          <span className="studio-team-meta">{members.length}</span>
        </header>

        <div className="studio-team-invite">
          <h2 className="studio-team-invite__title">Mitglied einladen</h2>
          <div className="studio-team-invite__grid">
            <div className="studio-team-field">
              <span className="studio-team-field__label">E-Mail</span>
              <input className="studio-team-input" placeholder="kollege@beispiel.de" readOnly />
            </div>
            <div className="studio-team-field">
              <span className="studio-team-field__label">Name</span>
              <input className="studio-team-input" placeholder="Vorname Nachname" readOnly />
            </div>
            <div className="studio-team-field">
              <span className="studio-team-field__label">Rolle</span>
              <select className="studio-team-select" defaultValue="editor" disabled>
                <option value="editor">Editor</option>
              </select>
            </div>
            <div className="studio-team-invite__actions">
              <StudioButton variant="primary" size="sm">
                Einladen
              </StudioButton>
            </div>
          </div>
          {error ? <p className="studio-team-feedback studio-team-feedback--error">{error}</p> : null}
          {notice ? <p className="studio-team-feedback studio-team-feedback--ok">{notice}</p> : null}
        </div>

        <div className="studio-team-members">
          <div className="studio-team-members__head">
            <span className="studio-team-members__title">Teammitglieder</span>
            {members.length > 0 ? (
              <span className="studio-team-members__summary">2 aktiv · 1 Einladung offen</span>
            ) : null}
          </div>
          {members.length === 0 ? (
            <div className="studio-team-empty">Noch keine Teammitglieder.</div>
          ) : (
            members.map((m) => (
              <div key={m.id} className="studio-team-row">
                <div className="studio-team-row__person">
                  <span
                    className={`studio-team-row__avatar${m.status === "invited" ? " studio-team-row__avatar--invited" : ""}`}
                  >
                    {initials(m.name)}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div className="studio-team-row__name">{m.name}</div>
                    <div className="studio-team-row__email">{m.email}</div>
                  </div>
                </div>
                <div className="studio-team-row__meta">
                  <span className="studio-team-badge studio-team-badge--role">{m.role}</span>
                  <span
                    className={`studio-team-badge ${m.status === "invited" ? "studio-team-badge--invited" : "studio-team-badge--active"}`}
                  >
                    <span className="studio-team-badge__dot" />
                    {m.status === "invited" ? "Einladung offen" : "Aktiv"}
                  </span>
                </div>
                <div className="studio-team-row__meta">
                  {m.role !== "owner" ? (
                    <StudioButton variant="ghost" size="sm" style={{ color: "var(--err)" }}>
                      Entfernen
                    </StudioButton>
                  ) : (
                    <span className="studio-faint" style={{ fontSize: 12 }}>
                      Inhaber
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

function T10QaInner() {
  const searchParams = useSearchParams();
  const view = searchParams.get("view") ?? "normal";
  return (
    <StudioChrome>
      <TeamQaDemo view={view} />
    </StudioChrome>
  );
}

export default function T10QaPage() {
  return (
    <Suspense fallback={null}>
      <T10QaInner />
    </Suspense>
  );
}
