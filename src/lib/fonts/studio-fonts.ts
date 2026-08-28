import { IBM_Plex_Mono, IBM_Plex_Sans, Work_Sans } from "next/font/google";

/** FINAL Handoff — nur Studio-UI (`.evg-studio` + `studioFontClassName`). */
const workSans = Work_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-work-sans",
  display: "swap",
});

/** Auth / Login / Passwort — unverändert IBM Plex (nicht Work Sans). */
const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-sans",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

/**
 * Studio-Oberfläche: Work Sans + IBM Plex Mono.
 * Einmalig laden — mehrfache next/font-Instanzen verursachen removeChild-Fehler beim Navigieren.
 */
export const studioFontClassName = `${workSans.variable} ${ibmPlexMono.variable}`;

/** Login / Passwort-Reset — außerhalb des FINAL-Studio-Scopes */
export const loginFontClassName = `${ibmPlexSans.variable} ${ibmPlexMono.variable}`;
