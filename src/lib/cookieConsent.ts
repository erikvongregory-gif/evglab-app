export const COOKIE_CONSENT_KEY = "cookie-consent";

export type CookiePrefs = {
  analytics: boolean;
  marketing: boolean;
};

type StoredV1 = {
  v: 1;
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  consentedAt?: string;
};

export function serializeCookieConsent(prefs: CookiePrefs): string {
  const payload: StoredV1 = {
    v: 1,
    necessary: true,
    analytics: prefs.analytics,
    marketing: prefs.marketing,
    consentedAt: new Date().toISOString(),
  };
  return JSON.stringify(payload);
}

/** Liest gespeicherte Auswahl; unterstützt ältere Werte `accepted` / `declined`. */
export function parseStoredCookieConsent(raw: string | null): CookiePrefs | null {
  if (raw == null || raw === "") return null;
  if (raw === "accepted") return { analytics: true, marketing: true };
  if (raw === "declined") return { analytics: false, marketing: false };
  try {
    const o = JSON.parse(raw) as Partial<StoredV1>;
    if (o?.v === 1 && typeof o.analytics === "boolean" && typeof o.marketing === "boolean") {
      return { analytics: o.analytics, marketing: o.marketing };
    }
  } catch {
    /* ignore */
  }
  return null;
}
