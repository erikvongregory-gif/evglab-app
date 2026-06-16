"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const STUDIO_EASE = [0.22, 0.68, 0.2, 1] as const;

/** Übergang zwischen Studio-Routen (z. B. Dashboard ↔ Bilder Erstellen). */
export function StudioRouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <>{children}</>;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18, ease: STUDIO_EASE }}
        style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
