import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Owner = Betreiber-Konto. Hat unbegrenzte Tokens und braucht kein Stripe-Abo.
 * Quelle: Env `OWNER_EMAILS` (kommagetrennt) oder `user_metadata.role = "owner"`.
 */
const OWNER_ROLE = "owner";

/** Effektiv unbegrenzt, aber eine echte Zahl — so bleibt die bestehende Token-UI funktionsfähig. */
export const OWNER_TOKEN_ALLOWANCE = 1_000_000_000;

const OWNER_LOOKUP_TTL_MS = 5 * 60 * 1000;
const ownerLookupCache = new Map<string, { isOwner: boolean; expiresAt: number }>();

function configuredOwnerEmails(): string[] {
  return (process.env.OWNER_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return configuredOwnerEmails().includes(email.trim().toLowerCase());
}

export function isOwnerRole(role: unknown): boolean {
  return typeof role === "string" && role.trim().toLowerCase() === OWNER_ROLE;
}

export function isOwnerUser(user: Pick<User, "email" | "user_metadata"> | null | undefined): boolean {
  if (!user) return false;
  return isOwnerEmail(user.email) || isOwnerRole(user.user_metadata?.role);
}

/** Admin-Center-Zugriff: klassische Admin-Rolle oder Owner. */
export function hasAdminAccess(user: Pick<User, "email" | "user_metadata"> | null | undefined): boolean {
  if (!user) return false;
  const role = typeof user.user_metadata?.role === "string" ? user.user_metadata.role.trim().toLowerCase() : "";
  return role === "admin" || isOwnerUser(user);
}

/**
 * Für Server-Pfade, die nur die User-ID kennen (Billing-Guards). Ergebnis wird
 * kurz gecacht, damit Generierungs-Routen keinen zusätzlichen Auth-Roundtrip zahlen.
 */
export async function isOwnerUserId(userId: string): Promise<boolean> {
  const cached = ownerLookupCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.isOwner;

  let isOwner = false;
  try {
    const admin = createAdminClient();
    const { data } = await admin.auth.admin.getUserById(userId);
    isOwner = isOwnerUser(data?.user ?? null);
  } catch {
    isOwner = false;
  }

  ownerLookupCache.set(userId, { isOwner, expiresAt: Date.now() + OWNER_LOOKUP_TTL_MS });
  return isOwner;
}
