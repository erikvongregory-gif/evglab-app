"use client";

import * as React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export interface ImageGenerationProps {
  children: React.ReactNode;
  isLoading: boolean;
  progress?: number;
  className?: string;
}

export const ImageGeneration = ({ children, isLoading, progress, className }: ImageGenerationProps) => {
  const clampedProgress = Math.max(0, Math.min(100, progress ?? 0));
  const loadingState: "starting" | "generating" | "completed" = !isLoading
    ? "completed"
    : clampedProgress < 10
      ? "starting"
      : "generating";

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <motion.span
        className="bg-[linear-gradient(110deg,var(--color-muted-foreground),35%,var(--color-foreground),50%,var(--color-muted-foreground),75%,var(--color-muted-foreground))] bg-[length:200%_100%] bg-clip-text text-base font-medium text-transparent"
        initial={{ backgroundPosition: "200% 0" }}
        animate={{
          backgroundPosition: loadingState === "completed" ? "0% 0" : "-200% 0",
        }}
        transition={{
          repeat: loadingState === "completed" ? 0 : Infinity,
          duration: 3,
          ease: "linear",
        }}
      >
        {loadingState === "starting" && "Getting started."}
        {loadingState === "generating" && "Creating image. May take a moment."}
        {loadingState === "completed" && "Image created."}
      </motion.span>

      <div className="relative max-w-3xl overflow-hidden rounded-xl border bg-card">
        {children}
        <motion.div
          className="pointer-events-none absolute -top-[25%] h-[125%] w-full backdrop-blur-3xl"
          initial={false}
          animate={{
            clipPath: `polygon(0 ${clampedProgress}%, 100% ${clampedProgress}%, 100% 100%, 0 100%)`,
            opacity: isLoading ? 1 : 0,
          }}
          style={{
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
        />
      </div>
    </div>
  );
};

ImageGeneration.displayName = "ImageGeneration";
