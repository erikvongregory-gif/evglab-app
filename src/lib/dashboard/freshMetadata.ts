import { hydratePrivateAssets } from "@/lib/supabase/privateAssets";
import { getWorkspace } from "@/lib/dashboard/workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDashboardMetadata, type DashboardMetadata } from "@/lib/dashboard/metadata";

/** Liest user_metadata frisch aus Supabase Auth — nicht aus dem oft veralteten JWT. */
export async function getFreshUserMetadata(userId: string, fallbackMetadata: unknown): Promise<unknown> {
  const workspace = await getWorkspace(userId);
  userId = workspace.ownerId;
  try {
    const admin = createAdminClient();
    const { data: adminUser } = await admin.auth.admin.getUserById(userId);
    if (adminUser?.user?.user_metadata) return hydratePrivateAssets(adminUser.user.user_metadata,userId);
  } catch {
    /* Fallback auf Session-Metadata */
  }
  return hydratePrivateAssets(fallbackMetadata,userId);
}

/** Liest dashboard-Metadata frisch aus Supabase Auth — nicht aus dem oft veralteten JWT. */
export async function getFreshUserDashboardMetadata(
  userId: string,
  fallbackMetadata: unknown,
): Promise<DashboardMetadata> {
  return getDashboardMetadata(await getFreshUserMetadata(userId, fallbackMetadata));
}
