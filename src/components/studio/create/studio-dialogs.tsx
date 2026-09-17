"use client";

import type { ReactNode } from "react";

import {
  StudioUiDialog,
  StudioUiDialogContent,
  StudioUiDialogDescription,
  StudioUiDialogHeader,
  StudioUiDialogTitle,
} from "@/components/studio/ui/dialog";
import { BeerCreatePanel, type BeerCreateDraft } from "@/components/studio/beers/beer-create-panel";
import type { ProduktKategorie } from "@/lib/dashboard/metadata";
import {
  OCCASION_TEMPLATES,
  seasonBadgeLabel,
  sortTemplatesForDate,
  type OccasionTemplate,
} from "@/app/(dashboard)/inhalte-erstellen/lib/occasion-templates";

export function BeerCreateDialog({
  open,
  error,
  initialKategorie = "bier",
  onOpenChange,
  onSave,
}: {
  open: boolean;
  error: string;
  initialKategorie?: ProduktKategorie;
  onOpenChange: (open: boolean) => void;
  onSave: (draft: BeerCreateDraft) => Promise<void>;
}) {
  return (
    <StudioUiDialog open={open} onOpenChange={onOpenChange}>
      <StudioUiDialogContent sheetOnMobile className="studio-create-modal__panel studio-create-modal__panel--beer" aria-label="Neue Sorte anlegen">
        <StudioUiDialogHeader>
          <StudioUiDialogTitle>Neue Sorte anlegen</StudioUiDialogTitle>
          <StudioUiDialogDescription>Foto, Getränkeart und Flasche einmal hinterlegen — danach in jedem Motiv verfügbar.</StudioUiDialogDescription>
        </StudioUiDialogHeader>
        <BeerCreatePanel
          key={`${open}-${initialKategorie}`}
          error={error}
          initialKategorie={initialKategorie}
          onSave={onSave}
          onCancel={() => onOpenChange(false)}
        />
      </StudioUiDialogContent>
    </StudioUiDialog>
  );
}

export function PresetDialog({
  open,
  onOpenChange,
  onChoose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChoose: (template: OccasionTemplate) => void;
}) {
  const sorted = sortTemplatesForDate(OCCASION_TEMPLATES, new Date());
  return (
    <StudioUiDialog open={open} onOpenChange={onOpenChange}>
      <StudioUiDialogContent sheetOnMobile aria-label="Motivvorlage wählen">
        <StudioUiDialogHeader>
          <StudioUiDialogTitle>Motivvorlagen</StudioUiDialogTitle>
          <StudioUiDialogDescription>
            Beispielszenen zum Start. Produktfoto und Charakter bleiben erhalten.
          </StudioUiDialogDescription>
        </StudioUiDialogHeader>
        <div className="studio-create-modal__grid">
          {sorted.map(({ template, status }) => {
            const badge = seasonBadgeLabel(status);
            return (
              <button
                key={template.id}
                type="button"
                className="studio-create-preset-card"
                style={{ borderColor: template.accent }}
                onClick={() => onChoose(template)}
              >
                <span className="studio-create-preset-card__accent" style={{ background: template.accent }} />
                <strong>{template.title}</strong>
                <span>{template.subtitle}</span>
                <small>{template.motifLine}</small>
                <em className="studio-create-preset-card__badge">{badge ?? "Beispielmotiv"}</em>
              </button>
            );
          })}
        </div>
      </StudioUiDialogContent>
    </StudioUiDialog>
  );
}

export function SettingsSheet({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <StudioUiDialog open={open} onOpenChange={onOpenChange}>
      <StudioUiDialogContent sheetOnMobile aria-label="Einstellungen">
        <StudioUiDialogHeader>
          <StudioUiDialogTitle>Einstellungen</StudioUiDialogTitle>
          <StudioUiDialogDescription>Etikett, Markenlook, Ort und Kennzeichnung. Format und Varianten bleiben im Editor.</StudioUiDialogDescription>
        </StudioUiDialogHeader>
        {children}
      </StudioUiDialogContent>
    </StudioUiDialog>
  );
}
