/**
 * App-Konfiguration (app.evglab.com).
 * Setze NEXT_PUBLIC_APP_BASE_URL in Vercel, z. B. https://app.evglab.com
 */
const appBaseUrl =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_APP_BASE_URL?.trim()) || "https://app.evglab.com";

export const SITE = {
  name: "EvGlab",
  baseUrl: appBaseUrl,
  defaultTitle: "EvGlab App",
  defaultDescription: "Dashboard und Verwaltung für EvGlab.",
  keywords: ["EvGlab", "Dashboard", "Brauerei", "KI"],
  locale: "de_DE" as const,
  ogImage: "/og/evglab-og.jpg",
  googleSiteVerification: "",
} as const;
