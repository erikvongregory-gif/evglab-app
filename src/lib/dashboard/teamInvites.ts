import { createAdminClient } from "@/lib/supabase/admin";
import { isPortalOperatorUserId } from "@/lib/auth/owner";

export type { WorkspaceInvitePreview } from "@/lib/dashboard/teamInvitePreview";
export { getWorkspaceInvitePreview } from "@/lib/dashboard/teamInvitePreview";

type InviteRole = "admin" | "editor" | "viewer";

/**
 * Team-Einladung anlegen. Portal-Betreiber: ohne Stripe-Abo und ohne Sitzlimit.
 * Alle anderen: bestehende DB-Funktion (Abo + Plan-Plätze).
 */
export async function createWorkspaceInvite(input: {
  ownerId: string;
  email: string;
  name: string;
  role: InviteRole;
  tokenHash: string;
}): Promise<{ id: string } | { error: string }> {
  const admin = createAdminClient();
  const email = input.email.trim().toLowerCase();

  if (await isPortalOperatorUserId(input.ownerId)) {
    const adminClient = createAdminClient();
    await adminClient
      .from("workspace_invites")
      .delete()
      .eq("owner_id", input.ownerId)
      .lte("expires_at", new Date().toISOString());
    await adminClient.from("workspace_invites").delete().eq("owner_id", input.ownerId).eq("email", email);
    const inserted = await adminClient
      .from("workspace_invites")
      .insert({
        owner_id: input.ownerId,
        email,
        name: input.name,
        role: input.role,
        token_hash: input.tokenHash,
      })
      .select("id")
      .single();
    if (inserted.error || !inserted.data?.id) {
      return { error: inserted.error?.message ?? "Einladung konnte nicht gespeichert werden." };
    }
    return { id: inserted.data.id };
  }

  const invite = await admin.rpc("workspace_invite", {
    p_owner: input.ownerId,
    p_email: email,
    p_name: input.name,
    p_role: input.role,
    p_hash: input.tokenHash,
  });
  if (invite.error) return { error: invite.error.message };
  return { id: invite.data as string };
}

/**
 * Einladung annehmen. Portal-Betreiber-Workspaces: ohne Abo-Prüfung.
 */
export async function acceptWorkspaceInvite(input: {
  userId: string;
  email: string;
  tokenHash: string;
}): Promise<{ ok: true } | { error: string; code?: string }> {
  const admin = createAdminClient();
  const email = input.email.trim().toLowerCase();

  const pending = await admin
    .from("workspace_invites")
    .select("id,owner_id,email,role,expires_at")
    .eq("token_hash", input.tokenHash)
    .maybeSingle();
  if (pending.error) return { error: pending.error.message, code: "lookup_failed" };
  if (!pending.data) {
    return { error: "Einladung nicht gefunden oder bereits verwendet.", code: "not_found" };
  }

  if (!(await isPortalOperatorUserId(pending.data.owner_id))) {
    const { error } = await admin.rpc("workspace_accept", {
      p_user: input.userId,
      p_email: email,
      p_hash: input.tokenHash,
    });
    if (error) {
      const message = error.message;
      if (/ungültig/i.test(message) && pending.data.email !== email) {
        return {
          error: `Diese Einladung gilt für ${pending.data.email}. Du bist als ${email} angemeldet.`,
          code: "email_mismatch",
        };
      }
      if (/ungültig/i.test(message) && pending.data.owner_id === input.userId) {
        return { error: "Du kannst deine eigene Teameinladung nicht annehmen.", code: "self_invite" };
      }
      return { error: message };
    }
    return { ok: true };
  }

  if (pending.data.expires_at && new Date(pending.data.expires_at) <= new Date()) {
    return { error: "Diese Einladung ist abgelaufen.", code: "expired" };
  }
  if (pending.data.owner_id === input.userId) {
    return { error: "Du kannst deine eigene Teameinladung nicht annehmen.", code: "self_invite" };
  }
  if (pending.data.email !== email) {
    return {
      error: `Diese Einladung gilt für ${pending.data.email}. Du bist als ${email} angemeldet — bitte mit der eingeladenen Adresse anmelden.`,
      code: "email_mismatch",
    };
  }

  const alreadyMember = await admin
    .from("workspace_members")
    .select("user_id")
    .or(`user_id.eq.${input.userId},owner_id.eq.${input.userId}`)
    .limit(1)
    .maybeSingle();
  if (alreadyMember.error) return { error: alreadyMember.error.message };
  if (alreadyMember.data) {
    return { error: "Dieses Konto gehört bereits zu einem Team.", code: "already_in_team" };
  }

  const ownBilling = await admin
    .from("billing_subscriptions")
    .select("subscription_status,stripe_subscription_id")
    .eq("user_id", input.userId)
    .maybeSingle();
  if (ownBilling.error) return { error: ownBilling.error.message };
  if (
    ownBilling.data?.stripe_subscription_id &&
    ownBilling.data.subscription_status &&
    !["none", "canceled"].includes(ownBilling.data.subscription_status)
  ) {
    return {
      error: "Dieses Konto hat bereits ein eigenes Abo und kann keinem Team beitreten.",
      code: "own_subscription",
    };
  }

  const insert = await admin.from("workspace_members").insert({
    user_id: input.userId,
    owner_id: pending.data.owner_id,
    role: pending.data.role,
  });
  if (insert.error) return { error: insert.error.message };

  await admin.from("workspace_invites").delete().eq("id", pending.data.id);
  return { ok: true };
}
