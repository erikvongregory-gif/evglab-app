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

/** Kein Remount/Exit-Stack — Inhalte bleiben sichtbar, Navigation nicht durch Fade blockiert. */
export function StudioViewTransition({
  viewKey,
  children,
  className,
}: StudioViewTransitionProps) {
  return (
    <div className={cn("studio-view-transition", className)} data-view={viewKey}>
      {children}
    </div>
  );
}
