import { createAdminClient } from "@/lib/supabase/admin";
import { getDashboardMetadata, type DashboardMetadata } from "@/lib/dashboard/metadata";

/** Liest user_metadata frisch aus Supabase Auth — nicht aus dem oft veralteten JWT. */
export async function getFreshUserMetadata(userId: string, fallbackMetadata: unknown): Promise<unknown> {
  try {
    const admin = createAdminClient();
    const { data: adminUser } = await admin.auth.admin.getUserById(userId);
    if (adminUser?.user?.user_metadata) return adminUser.user.user_metadata;
  } catch {
    /* Fallback auf Session-Metadata */
  }
  return fallbackMetadata;
}

/** Liest dashboard-Metadata frisch aus Supabase Auth — nicht aus dem oft veralteten JWT. */
export async function getFreshUserDashboardMetadata(
  userId: string,
  fallbackMetadata: unknown,
): Promise<DashboardMetadata> {
  return getDashboardMetadata(await getFreshUserMetadata(userId, fallbackMetadata));
}
