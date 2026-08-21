/**
 * App-Konfiguration (app.brewai.de).
 * Setze NEXT_PUBLIC_APP_BASE_URL in Vercel, z. B. https://app.brewai.de
 */
const appBaseUrl =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_APP_BASE_URL?.trim()) || "https://app.brewai.de";

/** Öffentliche Marketing-Seite — „Zur Startseite“ im Dashboard (nicht App-Root `/`, der nach /anmelden leitet). */
export const MARKETING_SITE_URL =
  (typeof process !== "undefined" &&
    (process.env.NEXT_PUBLIC_MARKETING_SITE_URL?.trim() ||
      process.env.NEXT_PUBLIC_SITE_URL?.trim())) ||
  "https://brewai.de";

const productName =
  (typeof process !== "undefined" &&
    (process.env.NEXT_PUBLIC_PRODUCT_NAME?.trim() || process.env.NEXT_PUBLIC_SITE_NAME?.trim())) ||
  "BrewAI";

/**
 * Shared-Cookie-Domain für Login zwischen brewai.de und app.brewai.de.
 * Nur setzen, wenn NEXT_PUBLIC_COOKIE_DOMAIN in der Env steht (Production).
 * Preview/Localhost: undefined (Host-only Cookies).
 */
export function getSharedCookieDomain(): string | undefined {
  const configured =
    typeof process !== "undefined" ? process.env.NEXT_PUBLIC_COOKIE_DOMAIN?.trim() : undefined;
  if (!configured) return undefined;
  return configured.replace(/^\./, "") || undefined;
}

/** Erlaubte Browser-Origins (Marketing + App). */
export const ALLOWED_WEB_ORIGINS = ["https://brewai.de", "https://app.brewai.de"] as const;

export const SITE = {
  name: productName,
  productName,
  baseUrl: appBaseUrl,
  marketingUrl: MARKETING_SITE_URL,
  defaultTitle: `${productName} App`,
  defaultDescription: `Dashboard und KI-Studio für ${productName}.`,
  keywords: [productName, "Dashboard", "Brauerei", "KI"],
  locale: "de_DE" as const,
  ogImage: "/og/evglab-og.jpg",
  contactEmail: "kontakt@brewai.de",
  googleSiteVerification: "",
} as const;
