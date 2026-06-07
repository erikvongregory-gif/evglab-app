import { Hanken_Grotesk, Inter_Tight, JetBrains_Mono, Newsreader } from "next/font/google";

const hanken = Hanken_Grotesk({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-hanken",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
});

const interTight = Inter_Tight({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter-tight",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--font-jetbrains",
  display: "swap",
});

/** Einmalig laden — mehrfache next/font-Instanzen verursachen removeChild-Fehler beim Navigieren. */
export const studioFontClassName = `${hanken.variable} ${newsreader.variable} ${interTight.variable} ${jetbrains.variable}`;

/** Login / Passwort-Reset — Sans-Headlines (Hanken Grotesk), kein Newsreader nötig */
export const loginFontClassName = `${hanken.variable} ${jetbrains.variable}`;
