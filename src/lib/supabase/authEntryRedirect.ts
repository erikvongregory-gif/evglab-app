function first(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function defaultNextForAuthType(type: string | undefined, hasCodeOnly: boolean): string {
  if (type === "recovery") return "/passwort-zuruecksetzen";
  if (type === "signup" || type === "email") return "/anmelden?notice=confirmed";
  if (type === "magiclink" || type === "invite") return "/dashboard";
  if (hasCodeOnly) return "/passwort-zuruecksetzen";
  return "/dashboard";
}

/** Auth-Query-Parameter (E-Mail-Links) auf /auth/callback umbiegen. */
export function resolveAuthCallbackRedirect(
  searchParams: Record<string, string | string[] | undefined>,
): string | null {
  const code = first(searchParams.code);
  const tokenHash = first(searchParams.token_hash);
  const type = first(searchParams.type);

  if (!code && !(tokenHash && type)) return null;

  const q = new URLSearchParams();
  if (code) q.set("code", code);
  if (tokenHash) q.set("token_hash", tokenHash);
  if (type) q.set("type", type);

  const explicitNext = first(searchParams.next);
  const next = explicitNext ?? defaultNextForAuthType(type, Boolean(code && !type));
  q.set("next", next);

  return `/auth/callback?${q.toString()}`;
}

export function hasAuthCallbackParams(
  searchParams: Record<string, string | string[] | undefined>,
): boolean {
  return resolveAuthCallbackRedirect(searchParams) !== null;
}
