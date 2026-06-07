import type { SupabaseClient } from "@supabase/supabase-js";
import { authMetadataLikelyOversized, buildPrunedAuthUserData } from "@/lib/auth/pruneAuthMetadata";
import { createAdminClient } from "@/lib/supabase/admin";

const REFRESH_TIMEOUT_MS = 8_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), ms);
    }),
  ]);
}

/**
 * Verkleinert aufgeblähtes user_metadata per Admin-API und holt eine frische Session.
 * Nur aufrufen, wenn die Metadata wirklich zu groß ist — blockiert kurz, nicht 20+ Sekunden.
 */
export async function repairOversizedMetadataForUser(
  supabase: SupabaseClient,
  userId: string,
  userMetadata: unknown,
): Promise<boolean> {
  if (!authMetadataLikelyOversized(userMetadata)) return false;
  const pruned = buildPrunedAuthUserData(userMetadata);
  if (!pruned) return false;

  try {
    const admin = createAdminClient();
    const { error: adminError } = await admin.auth.admin.updateUserById(userId, {
      user_metadata: pruned,
    });
    if (adminError) return false;

    const refreshed = await withTimeout(supabase.auth.refreshSession(), REFRESH_TIMEOUT_MS);
    return refreshed !== null;
  } catch {
    return false;
  }
}
