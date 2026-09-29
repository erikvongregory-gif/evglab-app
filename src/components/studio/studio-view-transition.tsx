"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StudioViewTransitionVariant = "route" | "tab";

type StudioViewTransitionProps = {
  viewKey: string;
  children: ReactNode;
  className?: string;
  variant?: StudioViewTransitionVariant;
};

/**
 * Nur Enter-Animation (kein Exit-Stack) — Navigation wird nie durch ein Fade blockiert.
 * Der key startet die CSS-Animation bei jedem View-Wechsel neu.
 */
export function StudioViewTransition({
  viewKey,
  children,
  className,
  variant = "route",
}: StudioViewTransitionProps) {
  return (
    <div
      key={viewKey}
      className={cn("studio-view-transition", className)}
      data-view={viewKey}
      data-variant={variant}
    >
      {children}
    </div>
  );
}
