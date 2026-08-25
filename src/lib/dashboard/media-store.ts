import { createAdminClient } from "@/lib/supabase/admin";
import {
  type DashboardMediaItem,
  getDashboardMetadata,
  mergeDashboardMetadata,
} from "@/lib/dashboard/metadata";

const BUCKET = process.env.SUPABASE_GENERATED_IMAGES_BUCKET?.trim() || "generated-images";
const libraryPath = (userId: string) => `media-library/${userId}.json`;

function sortedMedia(items: DashboardMediaItem[]): DashboardMediaItem[] {
  return items
    .slice()
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 12);
}

async function readAuthMetadata(userId: string): Promise<unknown> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user) {
    throw new Error(error?.message ?? "Nutzer nicht gefunden.");
  }
  return data.user.user_metadata;
}

async function readFromStorage(userId: string): Promise<DashboardMediaItem[] | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(BUCKET).download(libraryPath(userId));
  if (error || !data) return null;
  try {
    const parsed = JSON.parse(await data.text()) as unknown;
    return Array.isArray(parsed) ? (parsed as DashboardMediaItem[]) : null;
  } catch {
    return null;
  }
}

async function writeToStorage(userId: string, items: DashboardMediaItem[]): Promise<boolean> {
  const admin = createAdminClient();
  const { error } = await admin.storage.from(BUCKET).upload(libraryPath(userId), JSON.stringify(items), {
    contentType: "application/json",
    upsert: true,
  });
  if (error) {
    console.warn("[dashboard/media] storage write failed:", error.message);
    return false;
  }
  return true;
}

async function writeToAuth(userId: string, items: DashboardMediaItem[]): Promise<void> {
  const admin = createAdminClient();
  const metadata = await readAuthMetadata(userId);
  const merged = mergeDashboardMetadata(metadata, { mediaLibrary: items });
  const { error } = await admin.auth.admin.updateUserById(userId, { user_metadata: merged });
  if (error) {
    throw new Error(error.message || "Mediathek konnte nicht gespeichert werden.");
  }
}

async function clearAuthMedia(userId: string): Promise<void> {
  const metadata = await readAuthMetadata(userId);
  if ((getDashboardMetadata(metadata).mediaLibrary ?? []).length === 0) return;
  await writeToAuth(userId, []);
}

/** Mediathek liegt in Storage, nicht im JWT — sonst werden Session-Cookies zu groß und das Dashboard lahmt. */
export async function readDashboardMedia(userId: string): Promise<DashboardMediaItem[]> {
  const stored = await readFromStorage(userId);
  if (stored) return sortedMedia(stored);

  const fromAuth = sortedMedia(getDashboardMetadata(await readAuthMetadata(userId)).mediaLibrary ?? []);
  if (fromAuth.length > 0 && (await writeToStorage(userId, fromAuth))) {
    await clearAuthMedia(userId).catch(() => undefined);
  }
  return fromAuth;
}

export async function writeDashboardMedia(
  userId: string,
  items: DashboardMediaItem[],
): Promise<DashboardMediaItem[]> {
  const next = sortedMedia(items);
  if (await writeToStorage(userId, next)) {
    await clearAuthMedia(userId).catch(() => undefined);
    return next;
  }
  await writeToAuth(userId, next);
  return next;
}
