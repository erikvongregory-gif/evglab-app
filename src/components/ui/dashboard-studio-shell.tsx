"use client";

import { useMemo } from "react";

/** Content gutter — matches BrewAI Studio redesign */
export const STUDIO_PAD_X = 24;

/** Studio design tokens (CSS vars on .evg-studio) */
export const STUDIO_TOKENS = {
  paper: "var(--page)",
  paper2: "var(--app)",
  ink: "var(--fg)",
  ink2: "var(--fg-2)",
  ink3: "var(--fg-4)",
  amber: "var(--acc)",
  amber2: "var(--acc-hover)",
  ember: "var(--acc)",
  glow: "var(--acc-dim)",
  sans: "var(--f-sans)",
  accentSerif: "var(--f-sans)",
  serif: "var(--f-sans)",
  mono: "var(--f-mono)",
  gradientBrand: "var(--acc)",
  gradientGlow: "transparent",
  gradientCard: "var(--field)",
};

/** Text on amber CTAs */
export const STUDIO_ON_ACCENT = "var(--acc-fg)";

export type StudioPalette = {
  bg: string;
  surface: string;
  surface2: string;
  ink: string;
  ink2: string;
  ink3: string;
  muted: string;
  rule: string;
  ruleStrong: string;
  accent: string;
  accent2: string;
};

/** Lightweight palette hook — kept for create/media surfaces that still consume it. */
export function useStudioPalette(): StudioPalette {
  return useMemo(
    () => ({
      bg: "#F6F6F4",
      surface: "#FFFFFF",
      surface2: "#FAFAF8",
      ink: "#18140F",
      ink2: "#2C271F",
      ink3: "#6B645A",
      muted: "#4A4339",
      rule: "#E5E3DE",
      ruleStrong: "#D8D5CE",
      accent: "#C7691E",
      accent2: "#D4782A",
    }),
    [],
  );
}
