import { createAdminClient } from "@/lib/supabase/admin";
import { hydratePrivateAssets } from "@/lib/supabase/privateAssets";
import { MAX_MY_BEERS, sanitizeDashboardBeers, type DashboardBeer } from "@/lib/dashboard/metadata";
import { beersRevision } from "@/lib/inhalte-erstellen/studio-config";

export class AssortmentConflictError extends Error {
  readonly code = "assortment_conflict";
  constructor() {
    super("Das Sortiment hat sich inzwischen geändert. Bitte neu laden.");
    this.name = "AssortmentConflictError";
  }
}

export { beersRevision };

export async function readDashboardBeers(userId: string): Promise<DashboardBeer[]> {
  const { data, error } = await createAdminClient().from("dashboard_beers")
    .select("item").eq("user_id", userId).order("position");
  if (error) throw new Error(`Sortiment konnte nicht geladen werden: ${error.message}`);
  return hydratePrivateAssets(sanitizeDashboardBeers((data ?? []).map((row) => row.item)), userId);
}

/** Eine Sorte anlegen oder aktualisieren — löscht keine anderen IDs. */
export async function upsertDashboardBeer(userId: string, beer: DashboardBeer): Promise<DashboardBeer[]> {
  const [sanitized] = sanitizeDashboardBeers([beer]);
  if (!sanitized) throw new Error("Sorte ist ungültig.");
  const admin = createAdminClient();
  const { data: existing, error: readError } = await admin
    .from("dashboard_beers")
    .select("id,position")
    .eq("user_id", userId);
  if (readError) throw new Error(`Sortiment konnte nicht gespeichert werden: ${readError.message}`);
  const rows = existing ?? [];
  const current = rows.find((row) => row.id === sanitized.id);
  if (!current && rows.length >= MAX_MY_BEERS) {
    throw new Error(`Maximal ${MAX_MY_BEERS} Sorten.`);
  }
  const position =
    typeof current?.position === "number"
      ? current.position
      : rows.reduce((max, row) => Math.max(max, typeof row.position === "number" ? row.position : -1), -1) + 1;
  const { error: upsertError } = await admin.from("dashboard_beers").upsert(
    { user_id: userId, id: sanitized.id, position, item: sanitized },
    { onConflict: "user_id,id" },
  );
  if (upsertError) throw new Error(`Sortiment konnte nicht gespeichert werden: ${upsertError.message}`);
  return readDashboardBeers(userId);
}

/** Vollersatz inkl. Löschen fehlender IDs — nur mit Versionsprüfung oder force (Markenprofil-Scan). */
export async function replaceDashboardBeers(
  userId: string,
  beers: DashboardBeer[],
  options?: { expectedRevision?: string; force?: boolean },
): Promise<DashboardBeer[]> {
  const current = await readDashboardBeers(userId);
  if (!options?.force) {
    const currentRevision = beersRevision(current);
    if (!options?.expectedRevision || options.expectedRevision !== currentRevision) {
      throw new AssortmentConflictError();
    }
  }
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
  return hydratePrivateAssets(sanitized, userId);
}
