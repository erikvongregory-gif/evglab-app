"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const STUDIO_EASE = [0.22, 0.68, 0.2, 1] as const;

export type StudioViewTransitionVariant = "route" | "tab";

type StudioViewTransitionProps = {
  viewKey: string;
  children: ReactNode;
  className?: string;
  variant?: StudioViewTransitionVariant;
};

/** Crossfade zwischen Views — Tabs leicht, Routen etwas ausgeprägter. Panels stapeln sich im Grid (kein Leerraum). */
export function StudioViewTransition({
  viewKey,
  children,
  className,
  variant = "tab",
}: StudioViewTransitionProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return (
      <div key={viewKey} className={cn("studio-view-transition", className)}>
        {children}
      </div>
    );
  }

  const isRoute = variant === "route";

  return (
    <div className={cn("studio-view-transition", className)}>
      <AnimatePresence initial={false}>
        <motion.div
          key={viewKey}
          className="studio-view-transition__panel"
          initial={{ opacity: 0, y: isRoute ? 8 : 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: isRoute ? -6 : -3 }}
          transition={{ duration: isRoute ? 0.22 : 0.16, ease: STUDIO_EASE }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
