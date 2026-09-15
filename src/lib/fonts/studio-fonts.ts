import { IBM_Plex_Mono, Inter_Tight, Newsreader } from "next/font/google";

/** Produkt-UI — gesamte Studio-Oberfläche. Nur 400 / 500 / 600. */
const interTight = Inter_Tight({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-inter-tight",
  display: "swap",
});

/** Technische Metadaten, Zeitangaben, Statuslabels. */
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

/** Nur Logo / seltene Markenmomente — nicht für Dashboard-Überschriften oder KPIs. */
const newsreader = Newsreader({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-newsreader",
  display: "swap",
});

/**
 * Studio-Oberfläche: Inter Tight + IBM Plex Mono + Newsreader (Logo).
 * Einmalig laden — mehrfache next/font-Instanzen verursachen removeChild-Fehler beim Navigieren.
 */
export const studioFontClassName = `${interTight.variable} ${ibmPlexMono.variable} ${newsreader.variable}`;

/** Login / Passwort-Reset — gleiche Produkt-Typo. */
export const loginFontClassName = studioFontClassName;
