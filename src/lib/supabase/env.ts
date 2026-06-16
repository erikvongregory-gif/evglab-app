export function getSupabaseAnonKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}

export function getSupabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}

function parseBooleanEnv(raw: string | undefined): boolean {
  if (!raw) return false;
  return raw.trim().toLowerCase() === "true";
}

export function isInviteOnlyEnabled(): boolean {
  return parseBooleanEnv(process.env.AUTH_INVITE_ONLY);
}

export function isBillingCheckoutEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_BILLING_CHECKOUT_ENABLED;
  if (!raw) return true;
  return raw.trim().toLowerCase() !== "false";
}

export function isKleinunternehmerModeEnabled(): boolean {
  return parseBooleanEnv(process.env.BILLING_KLEINUNTERNEHMER ?? process.env.NEXT_PUBLIC_BILLING_KLEINUNTERNEHMER);
}

/** Stripe Tax nur bei explizitem Opt-in; Kleinunternehmer (§ 19 UStG) immer ohne Tax. */
export function isStripeAutomaticTaxEnabled(): boolean {
  if (isKleinunternehmerModeEnabled()) return false;
  return parseBooleanEnv(process.env.STRIPE_ENABLE_AUTOMATIC_TAX);
}

function isLocalDevHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".local");
}

export function getAppBaseUrlOrigin(requestOrigin: string): string {
  const configured = process.env.NEXT_PUBLIC_APP_BASE_URL?.trim();
  if (!configured) return requestOrigin;
  try {
    const configuredOrigin = new URL(configured).origin;
    const requestHost = new URL(requestOrigin).hostname;
    // Lokal immer die tatsächliche Origin (inkl. Port) — nie auf :3001 o. ä. aus der Env umleiten.
    if (isLocalDevHost(requestHost)) {
      return requestOrigin;
    }
    return configuredOrigin;
  } catch {
    return requestOrigin;
  }
}
