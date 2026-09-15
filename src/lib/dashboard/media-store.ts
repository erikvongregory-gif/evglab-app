import { hydratePrivateAssets } from "@/lib/supabase/privateAssets";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DashboardMediaItem } from "@/lib/dashboard/metadata";

export async function readDashboardMedia(userId: string): Promise<DashboardMediaItem[]> {
  const items: DashboardMediaItem[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await createAdminClient().from("dashboard_media")
      .select("item").eq("user_id", userId).order("id").range(offset, offset + 999);
    if (error) throw new Error(`Mediathek konnte nicht geladen werden: ${error.message}`);
    items.push(...(data ?? []).map(row => row.item as DashboardMediaItem));
    if (!data || data.length < 1000) break;
  }
  return hydratePrivateAssets(items
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),userId);
}

/** Upsert individual records; never overwrite another request's entire library. */
export async function writeDashboardMedia(userId: string, items: DashboardMediaItem[]) {
  if (items.length) {
    const { error } = await createAdminClient().from("dashboard_media")
      .upsert(items.map(item => ({ user_id: userId, id: item.id, item })), { onConflict: "user_id,id" });
    if (error) throw new Error(`Mediathek konnte nicht gespeichert werden: ${error.message}`);
  }
  return readDashboardMedia(userId);
}

export async function deleteDashboardMedia(userId: string, id: string) {
  const { error } = await createAdminClient().from("dashboard_media").delete().eq("user_id", userId).eq("id", id);
  if (error) throw new Error(error.message);
  return readDashboardMedia(userId);
}
