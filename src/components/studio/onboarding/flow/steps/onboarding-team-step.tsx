"use client";

import type { DashboardTeamMember } from "@/lib/dashboard/metadata";

export function OnboardingTeamStep({
  members,
  userEmail,
  inviteEmail,
  inviteRole,
  error,
  inviting,
  onChangeEmail,
  onChangeRole,
  onInvite,
}: {
  members: DashboardTeamMember[];
  userEmail: string;
  inviteEmail: string;
  inviteRole: "admin" | "editor" | "viewer";
  error: string;
  inviting: boolean;
  onChangeEmail: (v: string) => void;
  onChangeRole: (v: "admin" | "editor" | "viewer") => void;
  onInvite: () => void;
}) {
  return (
    <div className="evg-onb-stack evg-onb-stack--lg">
      <div className="evg-onb-panel">
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>Dein Konto</div>
        <div style={{ marginTop: 4, fontSize: 11.5, color: "var(--t3)" }}>
          {userEmail || "Angemeldet"} · Administrator
        </div>
      </div>

      {members.length > 0 ? (
        <div className="evg-onb-stack" style={{ gap: 6 }}>
          <span className="evg-onb-label">TEAM</span>
          {members.map((m) => (
            <div key={m.id} className="evg-onb-beer-row">
              <span className="evg-onb-beer-name">{m.name || m.email}</span>
              <span className="evg-onb-beer-meta">
                {m.role} · {m.status === "invited" ? "Einladung offen" : "Aktiv"}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="evg-onb-stack" style={{ gap: 10 }}>
        <span className="evg-onb-label">EINLADUNG</span>
        <div className="evg-onb-grid-2">
          <label className="evg-onb-field">
            <span className="evg-onb-label">E-MAIL</span>
            <input
              className="evg-onb-input"
              type="email"
              value={inviteEmail}
              onChange={(e) => onChangeEmail(e.target.value)}
              placeholder="kollege@brauerei.de"
              autoComplete="email"
            />
          </label>
          <label className="evg-onb-field">
            <span className="evg-onb-label">ROLLE</span>
            <select
              className="evg-onb-select"
              value={inviteRole}
              onChange={(e) => onChangeRole(e.target.value as "admin" | "editor" | "viewer")}
            >
              <option value="editor">Editor</option>
              <option value="admin">Administrator</option>
              <option value="viewer">Betrachter</option>
            </select>
          </label>
        </div>
        <button
          type="button"
          className="evg-onb-btn evg-onb-btn--soft"
          style={{ alignSelf: "flex-start" }}
          disabled={inviting || !inviteEmail.trim()}
          onClick={onInvite}
        >
          {inviting ? "Lädt ein …" : "Einladung senden"}
        </button>
        {error ? <p className="evg-onb-error">{error}</p> : null}
      </div>

      <div className="evg-onb-panel">
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--t1)" }}>Rollen kurz erklärt</div>
        <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.65, color: "var(--t2)" }}>
          <span style={{ color: "var(--t1)" }}>Administrator</span> — Marke, Team, Abrechnung.{" "}
          <span style={{ color: "var(--t1)" }}>Editor</span> — erstellt Motive und verwaltet die Mediathek.{" "}
          <span style={{ color: "var(--t1)" }}>Betrachter</span> — sieht und lädt freigegebene Motive herunter.
        </div>
      </div>
    </div>
  );
}
