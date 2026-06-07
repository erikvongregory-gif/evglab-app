import { createAdminClient } from "@/lib/supabase/admin";
import {
  getInstagramConnection,
  mergeInstagramConnectionMetadata,
  type StoredInstagramConnection,
} from "@/lib/brand/instagram-connection-store";

export async function persistInstagramConnectionForUser(params: {
  userId: string;
  userMetadata: unknown;
  connection: StoredInstagramConnection | null;
}): Promise<void> {
  const admin = createAdminClient();
  const merged = mergeInstagramConnectionMetadata(params.userMetadata, params.connection);
  const { error } = await admin.auth.admin.updateUserById(params.userId, {
    user_metadata: merged,
  });
  if (error) {
    throw new Error(error.message || "Instagram-Verbindung konnte nicht gespeichert werden.");
  }
}

export async function loadInstagramConnectionForUser(params: {
  userId: string;
  userMetadata: unknown;
}): Promise<StoredInstagramConnection | null> {
  const fromSession = getInstagramConnection(params.userMetadata);
  if (fromSession) return fromSession;

  try {
    const admin = createAdminClient();
    const { data } = await admin.auth.admin.getUserById(params.userId);
    return getInstagramConnection(data.user?.user_metadata);
  } catch {
    return null;
  }
}
