"use client";

import * as React from "react";
import { StudioIcon } from "@/components/studio/icons";
import {
  StudioUiBadge,
  StudioUiButton,
  StudioUiCard,
  StudioUiField,
  StudioUiHint,
  StudioUiIconButton,
  StudioUiInput,
  StudioUiLabel,
  StudioUiProgress,
  StudioUiSelect,
  StudioUiSkeleton,
  StudioUiTextarea,
} from "@/components/studio/ui";

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: "grid", gap: 12 }}>
      <h2 className="evg-h2" style={{ color: "var(--t1)" }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function StateGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: 12,
        alignItems: "start",
      }}
    >
      {children}
    </div>
  );
}

function Cap({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div className="stu-label">{label}</div>
      {children}
    </div>
  );
}

/** Dev-Prüfansicht T2a — Route `/studio-ui-kit` (nur Development). */
export function StudioPrimitivesDemo() {
  return (
    <div className="evg-studio" style={{ padding: 32, background: "var(--bg)", minHeight: "100%", color: "var(--t2)" }}>
      <header style={{ marginBottom: 28, maxWidth: 720 }}>
        <div className="stu-label" style={{ marginBottom: 8 }}>
          T2a · Studio UI
        </div>
        <h1 className="evg-h1" style={{ color: "var(--t1)", fontSize: "var(--t-19)" }}>
          Komponenten-Prüfansicht
        </h1>
        <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.55, color: "var(--t3)" }}>
          FINAL-Primitives unter <code style={{ fontFamily: "var(--f-mono)", fontSize: 12 }}>src/components/studio/ui/</code>.
          Shared <code style={{ fontFamily: "var(--f-mono)", fontSize: 12 }}>components/ui</code> unverändert.
        </p>
      </header>

      <div style={{ display: "grid", gap: 36, maxWidth: 960 }}>
        <Row title="Button">
          <StateGrid>
            <Cap label="Primary">
              <StudioUiButton variant="primary">Speichern</StudioUiButton>
            </Cap>
            <Cap label="Secondary">
              <StudioUiButton variant="secondary">Abbrechen</StudioUiButton>
            </Cap>
            <Cap label="Ghost">
              <StudioUiButton variant="ghost">Mehr</StudioUiButton>
            </Cap>
            <Cap label="Danger">
              <StudioUiButton variant="danger">Entfernen</StudioUiButton>
            </Cap>
            <Cap label="Loading">
              <StudioUiButton loading>Lädt …</StudioUiButton>
            </Cap>
            <Cap label="Disabled">
              <StudioUiButton disabled>Deaktiviert</StudioUiButton>
            </Cap>
            <Cap label="Size lg (≥44px)">
              <StudioUiButton size="lg">Primäre Aktion</StudioUiButton>
            </Cap>
          </StateGrid>
        </Row>

        <Row title="Icon-Button">
          <StateGrid>
            <Cap label="Ghost">
              <StudioUiIconButton aria-label="Schließen">
                <StudioIcon name="x" size={16} />
              </StudioUiIconButton>
            </Cap>
            <Cap label="Secondary">
              <StudioUiIconButton variant="secondary" aria-label="Einstellungen">
                <StudioIcon name="gear" size={16} />
              </StudioUiIconButton>
            </Cap>
            <Cap label="Danger">
              <StudioUiIconButton variant="danger" aria-label="Löschen">
                <StudioIcon name="x" size={16} />
              </StudioUiIconButton>
            </Cap>
            <Cap label="Loading">
              <StudioUiIconButton loading aria-label="Lädt" />
            </Cap>
            <Cap label="lg Touch">
              <StudioUiIconButton size="lg" aria-label="Suche">
                <StudioIcon name="search" size={18} />
              </StudioUiIconButton>
            </Cap>
          </StateGrid>
        </Row>

        <Row title="Form controls">
          <div style={{ display: "grid", gap: 16, maxWidth: 420 }}>
            <StudioUiField>
              <StudioUiLabel htmlFor="stu-demo-name" required>
                Brauerei
              </StudioUiLabel>
              <StudioUiInput id="stu-demo-name" placeholder="Beispielbrauerei GmbH" defaultValue="Bergquell" />
              <StudioUiHint>Hilfstext unter dem Feld.</StudioUiHint>
            </StudioUiField>
            <StudioUiField>
              <StudioUiLabel htmlFor="stu-demo-err">Website</StudioUiLabel>
              <StudioUiInput id="stu-demo-err" error defaultValue="nicht-gültig" aria-describedby="stu-demo-err-msg" />
              <StudioUiHint id="stu-demo-err-msg" tone="error">
                Bitte eine gültige URL eingeben.
              </StudioUiHint>
            </StudioUiField>
            <StudioUiField>
              <StudioUiLabel htmlFor="stu-demo-ok">Instagram</StudioUiLabel>
              <StudioUiInput id="stu-demo-ok" success defaultValue="@bergquell" />
              <StudioUiHint tone="success">Verbindung hergestellt.</StudioUiHint>
            </StudioUiField>
            <StudioUiField>
              <StudioUiLabel htmlFor="stu-demo-ta">Dos</StudioUiLabel>
              <StudioUiTextarea id="stu-demo-ta" rows={3} placeholder="Tonality …" />
            </StudioUiField>
            <StudioUiField>
              <StudioUiLabel htmlFor="stu-demo-sel">Rolle</StudioUiLabel>
              <StudioUiSelect id="stu-demo-sel" defaultValue="editor">
                <option value="viewer">Betrachter</option>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </StudioUiSelect>
            </StudioUiField>
            <StudioUiField>
              <StudioUiLabel htmlFor="stu-demo-dis">Deaktiviert</StudioUiLabel>
              <StudioUiInput id="stu-demo-dis" disabled defaultValue="Nur Lesen" />
            </StudioUiField>
          </div>
        </Row>

        <Row title="Badge">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <StudioUiBadge tone="neutral">Entwurf</StudioUiBadge>
            <StudioUiBadge tone="accent">Aktiv</StudioUiBadge>
            <StudioUiBadge tone="success">Fertig</StudioUiBadge>
            <StudioUiBadge tone="warning">Hinweis</StudioUiBadge>
            <StudioUiBadge tone="error">Fehler</StudioUiBadge>
            <StudioUiBadge tone="info">Info</StudioUiBadge>
          </div>
        </Row>

        <Row title="Card / Surface">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <StudioUiCard>
              <div className="stu-label" style={{ marginBottom: 8 }}>
                Standard
              </div>
              <p style={{ margin: 0, fontSize: 13, color: "var(--t2)", lineHeight: 1.55 }}>
                Flächenhierarchie über Tokens, ohne Schatten.
              </p>
            </StudioUiCard>
            <StudioUiCard padding="sm" interactive>
              <div className="stu-label" style={{ marginBottom: 8 }}>
                Interactive
              </div>
              <p style={{ margin: 0, fontSize: 13, color: "var(--t2)", lineHeight: 1.55 }}>Hover / Fokus.</p>
            </StudioUiCard>
          </div>
        </Row>

        <Row title="Skeleton & Progress">
          <div style={{ display: "grid", gap: 16, maxWidth: 420 }}>
            <div style={{ display: "grid", gap: 8 }}>
              <StudioUiSkeleton height={18} width="55%" />
              <StudioUiSkeleton height={12} />
              <StudioUiSkeleton height={12} width="80%" />
              <StudioUiSkeleton height={120} radius="lg" />
            </div>
            <Cap label="Progress 62 %">
              <StudioUiProgress value={62} label="Tokenverbrauch" />
            </Cap>
            <Cap label="Warning">
              <StudioUiProgress value={28} tone="warn" label="Warnung" />
            </Cap>
            <Cap label="Indeterminate">
              <StudioUiProgress indeterminate label="Lädt" />
            </Cap>
          </div>
        </Row>
      </div>
    </div>
  );
}
