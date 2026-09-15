"use client";

import * as React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export interface ImageGenerationProps {
  children: React.ReactNode;
  isLoading: boolean;
  progress?: number;
  className?: string;
  /** Statuszeile ausblenden (nur Reveal-Effekt). */
  hideStatus?: boolean;
}

const STATUS = {
  starting: "Wird gestartet …",
  generating: "BrewAI generiert dein Bild …",
  completed: "Bild erstellt.",
} as const;

export const ImageGeneration = ({
  children,
  isLoading,
  progress,
  className,
  hideStatus = false,
}: ImageGenerationProps) => {
  const clampedProgress = Math.max(0, Math.min(100, progress ?? 0));
  const loadingState: "starting" | "generating" | "completed" = !isLoading
    ? "completed"
    : clampedProgress < 10
      ? "starting"
      : "generating";

  return (
    <div className={cn("studio-image-gen flex flex-col gap-2", className)}>
      {hideStatus ? null : (
        <motion.span
          className="studio-image-gen__status bg-[length:200%_100%] bg-clip-text text-transparent text-base font-medium"
          style={{
            backgroundImage:
              "linear-gradient(110deg, var(--t3, #5E574E), 35%, var(--ac, #C7691E), 50%, var(--t1, #18140F), 65%, var(--t3, #5E574E), 85%, var(--t3, #5E574E))",
          }}
          initial={{ backgroundPosition: "200% 0" }}
          animate={{
            backgroundPosition: loadingState === "completed" ? "0% 0" : "-200% 0",
          }}
          transition={{
            repeat: loadingState === "completed" ? 0 : Infinity,
            duration: 3,
            ease: "linear",
          }}
          aria-live="polite"
        >
          {STATUS[loadingState]}
        </motion.span>
      )}

      <div className="studio-image-gen__frame relative overflow-hidden rounded-[var(--r-md,8px)] border border-[color:var(--line,#E5E3DE)] bg-[var(--s1,#FFFFFF)]">
        {children}
        <motion.div
          className="pointer-events-none absolute -top-[25%] h-[125%] w-full backdrop-blur-3xl"
          style={{
            background:
              "color-mix(in srgb, var(--ac-tint, #FBEFE0) 55%, var(--s1, #FFFFFF))",
            clipPath: `polygon(0 ${clampedProgress}%, 100% ${clampedProgress}%, 100% 100%, 0 100%)`,
            maskImage:
              clampedProgress === 0
                ? "linear-gradient(to bottom, black -5%, black 100%)"
                : `linear-gradient(to bottom, transparent ${Math.max(clampedProgress - 5, 0)}%, transparent ${clampedProgress}%, black ${Math.min(clampedProgress + 5, 100)}%)`,
            WebkitMaskImage:
              clampedProgress === 0
                ? "linear-gradient(to bottom, black -5%, black 100%)"
                : `linear-gradient(to bottom, transparent ${Math.max(clampedProgress - 5, 0)}%, transparent ${clampedProgress}%, black ${Math.min(clampedProgress + 5, 100)}%)`,
          }}
          initial={false}
          animate={{
            clipPath: `polygon(0 ${clampedProgress}%, 100% ${clampedProgress}%, 100% 100%, 0 100%)`,
            opacity: isLoading ? 1 : 0,
          }}
          transition={{ opacity: { duration: 0.45 } }}
        />
      </div>
    </div>
  );
};

ImageGeneration.displayName = "ImageGeneration";

export default ImageGeneration;
