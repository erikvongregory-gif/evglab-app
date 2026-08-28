"use client";

import * as React from "react";
import { StudioUiButton } from "./button";
import {
  StudioUiDialog,
  StudioUiDialogContent,
  StudioUiDialogDescription,
  StudioUiDialogFooter,
  StudioUiDialogHeader,
  StudioUiDialogTitle,
} from "./dialog";

export type StudioUiConfirmDialogProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive Aktion (Entfernen / Löschen) */
  destructive?: boolean;
  loading?: boolean;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
};

export function StudioUiConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Bestätigen",
  cancelLabel = "Abbrechen",
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: StudioUiConfirmDialogProps) {
  const [busy, setBusy] = React.useState(false);
  const isBusy = loading || busy;

  return (
    <StudioUiDialog
      open={open}
      onOpenChange={(next) => {
        if (isBusy && !next) return;
        onOpenChange?.(next);
      }}
    >
      <StudioUiDialogContent
        sheetOnMobile
        showClose={!isBusy}
        onEscapeKeyDown={(e) => {
          if (isBusy) e.preventDefault();
        }}
        onPointerDownOutside={(e) => {
          if (isBusy) e.preventDefault();
        }}
      >
        <StudioUiDialogHeader>
          <StudioUiDialogTitle>{title}</StudioUiDialogTitle>
          {description ? (
            <StudioUiDialogDescription>{description}</StudioUiDialogDescription>
          ) : null}
        </StudioUiDialogHeader>
        <StudioUiDialogFooter>
          <StudioUiButton
            type="button"
            variant="secondary"
            disabled={isBusy}
            onClick={() => {
              onCancel?.();
              onOpenChange?.(false);
            }}
          >
            {cancelLabel}
          </StudioUiButton>
          <StudioUiButton
            type="button"
            variant={destructive ? "danger" : "primary"}
            loading={isBusy}
            onClick={async () => {
              try {
                setBusy(true);
                await onConfirm?.();
                onOpenChange?.(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </StudioUiButton>
        </StudioUiDialogFooter>
      </StudioUiDialogContent>
    </StudioUiDialog>
  );
}
