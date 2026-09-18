import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

type InviteRole = "admin" | "editor" | "viewer";

export type WorkspaceInvitePreview = {
  status: "valid" | "expired" | "missing";
  email: string | null;
  name: string | null;
  role: InviteRole | null;
};

function isInviteRole(value: string): value is InviteRole {
  return value === "admin" || value === "editor" || value === "viewer";
}

function hashToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex");
}

export async function getWorkspaceInvitePreview(
  rawToken: string,
): Promise<WorkspaceInvitePreview> {
  if (!/^[a-f0-9]{64}$/i.test(rawToken)) {
    return { status: "missing", email: null, name: null, role: null };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("workspace_invites")
    .select("email,name,role,expires_at")
    .eq("token_hash", hashToken(rawToken.toLowerCase()))
    .maybeSingle();

  if (error || !data) {
    return { status: "missing", email: null, name: null, role: null };
  }

  const role = isInviteRole(data.role) ? data.role : null;
  if (data.expires_at && new Date(data.expires_at) <= new Date()) {
    return { status: "expired", email: data.email, name: data.name, role };
  }

  return { status: "valid", email: data.email, name: data.name, role };
}
