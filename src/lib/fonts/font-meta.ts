/**
 * Font preference keys/labels only — no next/font imports.
 * Client code must use this module; loading fonts belongs in registry.ts (root layout).
 */
export const FONT_META = {
  geist: { label: "Geist" },
  inter: { label: "Inter" },
  notoSans: { label: "Noto Sans" },
  nunitoSans: { label: "Nunito Sans" },
  figtree: { label: "Figtree" },
  roboto: { label: "Roboto" },
  raleway: { label: "Raleway" },
  dmSans: { label: "DM Sans" },
  publicSans: { label: "Public Sans" },
  outfit: { label: "Outfit" },
  geistMono: { label: "Geist Mono" },
  geistPixelSquare: { label: "Geist Pixel Square" },
  jetBrainsMono: { label: "JetBrains Mono" },
  notoSerif: { label: "Noto Serif" },
  robotoSlab: { label: "Roboto Slab" },
  merriweather: { label: "Merriweather" },
  lora: { label: "Lora" },
  playfairDisplay: { label: "Playfair Display" },
} as const;

export type FontKey = keyof typeof FONT_META;

export const fontKeys = Object.keys(FONT_META) as FontKey[];

export const fontOptions = fontKeys.map((key) => ({
  key,
  label: FONT_META[key].label,
}));
