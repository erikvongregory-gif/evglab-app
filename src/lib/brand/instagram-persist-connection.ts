import { createAdminClient } from "@/lib/supabase/admin";
import { getInstagramConnection, type StoredInstagramConnection } from "@/lib/brand/instagram-connection-store";

export async function persistInstagramConnectionForUser(params: {
  userId: string; userMetadata: unknown; connection: StoredInstagramConnection | null;
}): Promise<void> {
  const admin = createAdminClient();
  const result = params.connection
    ? await admin.from("integration_secrets").upsert({ user_id: params.userId, provider: "instagram", secret: params.connection }, { onConflict: "user_id,provider" })
    : await admin.from("integration_secrets").delete().eq("user_id", params.userId).eq("provider", "instagram");
  if (result.error) throw new Error(result.error.message);
  const { data, error } = await admin.auth.admin.getUserById(params.userId);
  if (error || !data.user) throw new Error("Profil konnte nicht geladen werden.");
  const metadata = data.user.user_metadata;
  const { error: cleanupError } = await admin.auth.admin.updateUserById(params.userId, {
    user_metadata: { ...metadata, instagramConnection: null, dashboard: { ...metadata.dashboard, instagramConnection: null } },
  });
  if (cleanupError) throw new Error(cleanupError.message);
}

export async function loadInstagramConnectionForUser(params: {
  userId: string; userMetadata: unknown;
}): Promise<StoredInstagramConnection | null> {
  const { data, error } = await createAdminClient().from("integration_secrets").select("secret")
    .eq("user_id", params.userId).eq("provider", "instagram").maybeSingle();
  if (error) throw new Error(error.message);
  return data ? getInstagramConnection({ instagramConnection: data.secret }) : null;
}
