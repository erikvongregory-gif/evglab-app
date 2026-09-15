import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeDashboardBeers, type DashboardBeer } from "@/lib/dashboard/metadata";

export async function readDashboardBeers(userId: string): Promise<DashboardBeer[]> {
  const { data, error } = await createAdminClient().from("dashboard_beers")
    .select("item").eq("user_id", userId).order("position");
  if (error) throw new Error(`Sortiment konnte nicht geladen werden: ${error.message}`);
  return sanitizeDashboardBeers((data ?? []).map((row) => row.item));
}

export async function replaceDashboardBeers(userId: string, beers: DashboardBeer[]): Promise<DashboardBeer[]> {
  const admin = createAdminClient();
  const sanitized = sanitizeDashboardBeers(beers);
  if (sanitized.length) {
    const { error: insertError } = await admin.from("dashboard_beers").upsert(
      sanitized.map((item, position) => ({ user_id: userId, id: item.id, position, item })),
      { onConflict: "user_id,id" },
    );
    if (insertError) throw new Error(`Sortiment konnte nicht gespeichert werden: ${insertError.message}`);
  }
  const keepIds = new Set(sanitized.map((beer) => beer.id));
  const { data: existing, error: readError } = await admin.from("dashboard_beers").select("id").eq("user_id", userId);
  if (readError) throw new Error(`Sortiment konnte nicht gespeichert werden: ${readError.message}`);
  const staleIds = (existing ?? []).map((row) => row.id as string).filter((id) => !keepIds.has(id));
  if (staleIds.length) {
    const { error: deleteError } = await admin.from("dashboard_beers").delete().eq("user_id", userId).in("id", staleIds);
    if (deleteError) throw new Error(`Sortiment konnte nicht gespeichert werden: ${deleteError.message}`);
  }
  return sanitized;
}
