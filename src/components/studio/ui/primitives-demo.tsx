"use client";

import * as React from "react";
import { StudioIcon } from "@/components/studio/icons";
import {
  StudioUiBadge,
  StudioUiButton,
  StudioUiCard,
  StudioUiCheckbox,
  StudioUiConfirmDialog,
  StudioUiDialog,
  StudioUiDialogContent,
  StudioUiDialogDescription,
  StudioUiDialogFooter,
  StudioUiDialogHeader,
  StudioUiDialogTitle,
  StudioUiDialogTrigger,
  StudioUiDropdownMenu,
  StudioUiDropdownMenuContent,
  StudioUiDropdownMenuItem,
  StudioUiDropdownMenuSeparator,
  StudioUiDropdownMenuTrigger,
  StudioUiField,
  StudioUiHint,
  StudioUiIconButton,
  StudioUiInput,
  StudioUiLabel,
  StudioUiProgress,
  StudioUiRadio,
  StudioUiRadioGroup,
  StudioUiSelect,
  StudioUiSkeleton,
  StudioUiSwitch,
  StudioUiTabs,
  StudioUiTabsContent,
  StudioUiTabsList,
  StudioUiTabsTrigger,
  StudioUiTextarea,
  StudioUiToaster,
  StudioUiTooltip,
  StudioUiTooltipContent,
  StudioUiTooltipProvider,
  StudioUiTooltipTrigger,
  showStudioToast,
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

/** Dev-Prüfansicht T2a+T2b — Route `/studio-ui-kit` (nur Development). */
export function StudioPrimitivesDemo() {
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [indeterminate, setIndeterminate] = React.useState<boolean | "indeterminate">("indeterminate");

  return (
    <StudioUiTooltipProvider delayDuration={300}>
      <div
        className="evg-studio"
        style={{ padding: 32, background: "var(--bg)", minHeight: "100%", color: "var(--t2)" }}
      >
        <StudioUiToaster />
        <header style={{ marginBottom: 28, maxWidth: 720 }}>
          <div className="stu-label" style={{ marginBottom: 8 }}>
            T2a · T2b · Studio UI
          </div>
          <h1 className="evg-h1" style={{ color: "var(--t1)", fontSize: "var(--t-19)" }}>
            Komponenten-Prüfansicht
          </h1>
          <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.55, color: "var(--t3)" }}>
            FINAL-Primitives unter{" "}
            <code style={{ fontFamily: "var(--f-mono)", fontSize: 12 }}>src/components/studio/ui/</code>. Shared{" "}
            <code style={{ fontFamily: "var(--f-mono)", fontSize: 12 }}>components/ui</code> unverändert. Keine API-Aufrufe.
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
                <StudioUiInput id="stu-demo-name" defaultValue="Bergquell" />
                <StudioUiHint>Hilfstext unter dem Feld.</StudioUiHint>
              </StudioUiField>
              <StudioUiField>
                <StudioUiLabel htmlFor="stu-demo-err">Website</StudioUiLabel>
                <StudioUiInput id="stu-demo-err" error defaultValue="nicht-gültig" />
                <StudioUiHint tone="error">Bitte eine gültige URL eingeben.</StudioUiHint>
              </StudioUiField>
              <StudioUiField>
                <StudioUiLabel htmlFor="stu-demo-ta">Dos</StudioUiLabel>
                <StudioUiTextarea id="stu-demo-ta" rows={3} placeholder="Tonality …" />
              </StudioUiField>
              <StudioUiField>
                <StudioUiLabel htmlFor="stu-demo-sel">Rolle (natives Select)</StudioUiLabel>
                <StudioUiSelect id="stu-demo-sel" defaultValue="editor">
                  <option value="viewer">Betrachter</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </StudioUiSelect>
                <StudioUiHint>Kein Radix Select installiert — natives Select bleibt.</StudioUiHint>
              </StudioUiField>
            </div>
          </Row>

          <Row title="Checkbox · Radio · Switch">
            <div style={{ display: "grid", gap: 12, maxWidth: 420 }}>
              <StudioUiCheckbox label="Newsletter erhalten" defaultChecked />
              <StudioUiCheckbox
                label="Teilauswahl (indeterminate)"
                checked={indeterminate}
                onCheckedChange={(v) => setIndeterminate(v === true ? true : v === false ? false : "indeterminate")}
              />
              <StudioUiCheckbox label="Deaktiviert" disabled />
              <StudioUiRadioGroup defaultValue="editor" aria-label="Rolle">
                <StudioUiRadio value="viewer" label="Betrachter" />
                <StudioUiRadio value="editor" label="Editor" />
                <StudioUiRadio value="admin" label="Administrator" />
              </StudioUiRadioGroup>
              <StudioUiSwitch label="Zwei-Faktor-Erinnerung" defaultChecked />
              <StudioUiSwitch label="Deaktiviert" disabled />
            </div>
          </Row>

          <Row title="Tabs">
            <StudioUiTabs defaultValue="profil">
              <StudioUiTabsList>
                <StudioUiTabsTrigger value="profil">Profil</StudioUiTabsTrigger>
                <StudioUiTabsTrigger value="team">Team</StudioUiTabsTrigger>
                <StudioUiTabsTrigger value="abo">Abonnement</StudioUiTabsTrigger>
                <StudioUiTabsTrigger value="off" disabled>
                  Gesperrt
                </StudioUiTabsTrigger>
              </StudioUiTabsList>
              <StudioUiTabsContent value="profil">Profil-Einstellungen (Demo, keine Daten).</StudioUiTabsContent>
              <StudioUiTabsContent value="team">Team-Übersicht (Demo).</StudioUiTabsContent>
              <StudioUiTabsContent value="abo">Abonnement (Demo).</StudioUiTabsContent>
            </StudioUiTabs>
          </Row>

          <Row title="Tooltip · Dropdown">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
              <StudioUiTooltip>
                <StudioUiTooltipTrigger asChild>
                  <StudioUiButton variant="secondary">Hover / Fokus</StudioUiButton>
                </StudioUiTooltipTrigger>
                <StudioUiTooltipContent>Nur ergänzende Hilfe — keine Pflichtinfo.</StudioUiTooltipContent>
              </StudioUiTooltip>

              <StudioUiDropdownMenu>
                <StudioUiDropdownMenuTrigger asChild>
                  <StudioUiButton variant="secondary">Aktionen</StudioUiButton>
                </StudioUiDropdownMenuTrigger>
                <StudioUiDropdownMenuContent>
                  <StudioUiDropdownMenuItem onClick={() => showStudioToast({ title: "Dupliziert", tone: "success" })}>
                    Duplizieren
                  </StudioUiDropdownMenuItem>
                  <StudioUiDropdownMenuItem>Umbenennen</StudioUiDropdownMenuItem>
                  <StudioUiDropdownMenuSeparator />
                  <StudioUiDropdownMenuItem destructive onClick={() => setConfirmOpen(true)}>
                    Entfernen …
                  </StudioUiDropdownMenuItem>
                </StudioUiDropdownMenuContent>
              </StudioUiDropdownMenu>
            </div>
          </Row>

          <Row title="Dialog · Bestätigung · Toast">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <StudioUiDialog>
                <StudioUiDialogTrigger asChild>
                  <StudioUiButton>Dialog öffnen</StudioUiButton>
                </StudioUiDialogTrigger>
                <StudioUiDialogContent>
                  <StudioUiDialogHeader>
                    <StudioUiDialogTitle>Motiv teilen</StudioUiDialogTitle>
                    <StudioUiDialogDescription>
                      Lokale Demo ohne API. Escape schließt, Fokus kehrt zum Trigger zurück.
                    </StudioUiDialogDescription>
                  </StudioUiDialogHeader>
                  <StudioUiField>
                    <StudioUiLabel htmlFor="stu-share">Link</StudioUiLabel>
                    <StudioUiInput id="stu-share" defaultValue="https://app.brewai.de/m/demo" readOnly />
                  </StudioUiField>
                  <StudioUiDialogFooter>
                    <StudioUiDialogTrigger asChild>
                      <StudioUiButton variant="secondary">Schließen</StudioUiButton>
                    </StudioUiDialogTrigger>
                    <StudioUiButton
                      onClick={() => showStudioToast({ title: "Link kopiert", tone: "success" })}
                    >
                      Kopieren
                    </StudioUiButton>
                  </StudioUiDialogFooter>
                </StudioUiDialogContent>
              </StudioUiDialog>

              <StudioUiButton variant="danger" onClick={() => setConfirmOpen(true)}>
                Bestätigung (destruktiv)
              </StudioUiButton>

              <StudioUiButton
                variant="secondary"
                onClick={() => showStudioToast({ title: "Gespeichert", tone: "success" })}
              >
                Toast Success
              </StudioUiButton>
              <StudioUiButton
                variant="secondary"
                onClick={() =>
                  showStudioToast({
                    title: "Speichern fehlgeschlagen",
                    description: "Bitte erneut versuchen.",
                    tone: "error",
                  })
                }
              >
                Toast Error
              </StudioUiButton>
              <StudioUiButton
                variant="secondary"
                onClick={() => showStudioToast({ title: "Token bald leer", tone: "warning" })}
              >
                Toast Warning
              </StudioUiButton>
              <StudioUiButton
                variant="secondary"
                onClick={() => showStudioToast({ title: "Neue Funktion verfügbar", tone: "info" })}
              >
                Toast Info
              </StudioUiButton>
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

          <Row title="Card / Skeleton / Progress">
            <div style={{ display: "grid", gap: 16, maxWidth: 520 }}>
              <StudioUiCard>
                <div className="stu-label" style={{ marginBottom: 8 }}>
                  Surface
                </div>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55 }}>Ohne Schatten, nur Flächenhierarchie.</p>
              </StudioUiCard>
              <div style={{ display: "grid", gap: 8 }}>
                <StudioUiSkeleton height={18} width="55%" />
                <StudioUiSkeleton height={12} />
                <StudioUiSkeleton height={80} radius="lg" />
              </div>
              <StudioUiProgress value={62} label="Fortschritt" />
            </div>
          </Row>
        </div>

        <StudioUiConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Mitglied entfernen?"
          description="Die Person verliert den Zugriff auf dieses Studio. Diese Demo speichert nichts."
          confirmLabel="Entfernen"
          cancelLabel="Abbrechen"
          destructive
          onConfirm={() => {
            showStudioToast({ title: "Entfernt", description: "Nur lokale Demo.", tone: "success" });
          }}
        />
      </div>
    </StudioUiTooltipProvider>
  );
}
