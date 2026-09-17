import { createAdminClient } from "@/lib/supabase/admin";
import { hydratePrivateAssets } from "@/lib/supabase/privateAssets";
import { sanitizeDashboardCharacters, type DashboardCharacter } from "@/lib/dashboard/metadata";

const BUCKET = process.env.SUPABASE_GENERATED_IMAGES_BUCKET?.trim() || "generated-images";

function metaPath(userId: string) {
  return `character-meta/${userId}/characters.json`;
}

/** ponytail: Storage-JSON statt DB-Tabelle — BrewAI-Prod hat dashboard_characters noch nicht. */
export async function readDashboardCharacters(userId: string): Promise<DashboardCharacter[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(BUCKET).download(metaPath(userId));
  if (error) {
    const msg = error.message?.toLowerCase() ?? "";
    if (msg.includes("not found") || msg.includes("object not found") || (error as { statusCode?: string }).statusCode === "404") {
      return [];
    }
    throw new Error(`Charaktere konnten nicht geladen werden: ${error.message}`);
  }
  try {
    const text = await data.text();
    const parsed = text.trim() ? JSON.parse(text) : [];
    return hydratePrivateAssets(sanitizeDashboardCharacters(parsed), userId);
  } catch (parseError) {
    throw new Error(
      `Charaktere konnten nicht geladen werden: ${parseError instanceof Error ? parseError.message : "ungültige Daten"}`,
    );
  }
}

export async function replaceDashboardCharacters(
  userId: string,
  characters: DashboardCharacter[],
): Promise<DashboardCharacter[]> {
  const admin = createAdminClient();
  const sanitized = sanitizeDashboardCharacters(characters);
  const body = Buffer.from(JSON.stringify(sanitized), "utf8");
  const { error } = await admin.storage.from(BUCKET).upload(metaPath(userId), body, {
    contentType: "application/json",
    upsert: true,
    cacheControl: "60",
  });
  if (error) throw new Error(`Charaktere konnten nicht gespeichert werden: ${error.message}`);
  return hydratePrivateAssets(sanitized, userId);
}
