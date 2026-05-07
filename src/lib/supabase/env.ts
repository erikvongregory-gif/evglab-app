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

export function getAppBaseUrlOrigin(requestOrigin: string): string {
  const configured = process.env.NEXT_PUBLIC_APP_BASE_URL?.trim();
  if (!configured) return requestOrigin;
  try {
    return new URL(configured).origin;
  } catch {
    return requestOrigin;
  }
}
