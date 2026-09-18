import { hydratePrivateAssets } from "@/lib/supabase/privateAssets";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DashboardMediaItem } from "@/lib/dashboard/metadata";

async function listDashboardMediaRaw(userId: string): Promise<DashboardMediaItem[]> {
  const items: DashboardMediaItem[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await createAdminClient()
      .from("dashboard_media")
      .select("item")
      .eq("user_id", userId)
      .order("id")
      .range(offset, offset + 999);
    if (error) throw new Error(`Mediathek konnte nicht geladen werden: ${error.message}`);
    items.push(...(data ?? []).map((row) => row.item as DashboardMediaItem));
    if (!data || data.length < 1000) break;
  }
  return items.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export type MediaPage = {
  items: DashboardMediaItem[];
  total: number;
  hasMore: boolean;
};

/** Liest die Mediathek; optional nur eine Seite signieren (teuerster Schritt). */
export async function readDashboardMedia(
  userId: string,
  opts?: { limit?: number; offset?: number },
): Promise<DashboardMediaItem[]> {
  const sorted = await listDashboardMediaRaw(userId);
  const offset = Math.max(0, opts?.offset ?? 0);
  const slice =
    opts?.limit != null ? sorted.slice(offset, offset + Math.max(0, opts.limit)) : sorted;
  return hydratePrivateAssets(slice, userId);
}

export async function readDashboardMediaPage(
  userId: string,
  opts?: { limit?: number; offset?: number },
): Promise<MediaPage> {
  const sorted = await listDashboardMediaRaw(userId);
  const limit = Math.min(100, Math.max(1, opts?.limit ?? 48));
  const offset = Math.max(0, opts?.offset ?? 0);
  const slice = sorted.slice(offset, offset + limit);
  const items = await hydratePrivateAssets(slice, userId);
  return {
    items,
    total: sorted.length,
    hasMore: offset + limit < sorted.length,
  };
}

/** Roh-Item ohne URL-Signing (z. B. Titel-Update). */
export async function getDashboardMediaItem(
  userId: string,
  id: string,
): Promise<DashboardMediaItem | null> {
  const { data, error } = await createAdminClient()
    .from("dashboard_media")
    .select("item")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.item ? (data.item as DashboardMediaItem) : null;
}

/** Upsert individual records; never overwrite another request's entire library. */
export async function writeDashboardMedia(userId: string, items: DashboardMediaItem[]) {
  if (items.length) {
    const { error } = await createAdminClient()
      .from("dashboard_media")
      .upsert(
        items.map((item) => ({ user_id: userId, id: item.id, item })),
        { onConflict: "user_id,id" },
      );
    if (error) throw new Error(`Mediathek konnte nicht gespeichert werden: ${error.message}`);
  }
}

export async function deleteDashboardMedia(userId: string, id: string) {
  const { error } = await createAdminClient()
    .from("dashboard_media")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw new Error(error.message);
}
