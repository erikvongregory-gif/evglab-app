import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export type InviteStatus =
  | "valid"
  | "missing"
  | "invalid"
  | "expired"
  | "used"
  | "email_mismatch";

export type InviteRecord = {
  id: string;
  email: string;
  role: string | null;
  expires_at: string;
  consumed_at: string | null;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function getInviteByToken(token: string): Promise<InviteRecord | null> {
  const cleaned = token.trim();
  if (!cleaned) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("invites")
    .select("id,email,role,expires_at,consumed_at")
    .eq("token_hash", hashInviteToken(cleaned))
    .maybeSingle();

  if (error) {
    throw new Error(`Invite lookup failed: ${error.message}`);
  }
  return (data as InviteRecord | null) ?? null;
}

export function evaluateInvite(
  invite: InviteRecord | null,
  expectedEmail?: string,
): InviteStatus {
  if (!invite) return "invalid";
  if (invite.consumed_at) return "used";
  if (new Date(invite.expires_at).getTime() <= Date.now()) return "expired";
  if (expectedEmail && normalizeEmail(invite.email) !== normalizeEmail(expectedEmail)) {
    return "email_mismatch";
  }
  return "valid";
}

export async function consumeInviteByToken(token: string, consumedByEmail: string) {
  const cleanedToken = token.trim();
  if (!cleanedToken) {
    return { ok: false as const, status: "missing" as InviteStatus, invite: null };
  }
  const invite = await getInviteByToken(cleanedToken);
  const status = evaluateInvite(invite, consumedByEmail);
  if (status !== "valid") {
    return { ok: false as const, status, invite };
  }

  const nowIso = new Date().toISOString();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("invites")
    .update({ consumed_at: nowIso, consumed_by_email: normalizeEmail(consumedByEmail) })
    .eq("id", invite!.id)
    .is("consumed_at", null)
    .gt("expires_at", nowIso)
    .select("id,email,role,expires_at,consumed_at")
    .maybeSingle();

  if (error) {
    throw new Error(`Invite consume failed: ${error.message}`);
  }
  if (!data) {
    const refreshed = await getInviteByToken(cleanedToken);
    return { ok: false as const, status: evaluateInvite(refreshed, consumedByEmail), invite: refreshed };
  }
  return { ok: true as const, status: "valid" as InviteStatus, invite: data as InviteRecord };
}
