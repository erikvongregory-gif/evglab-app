import { createAdminClient } from "@/lib/supabase/admin";
import { BEER_PHYSICS, type BeerPhysicsProfile } from "./beer-appearance";

/** Server-only database lookup; safe beverage defaults cover a missing migration or outage. */
export async function readBeerAppearance(bierstil: string): Promise<BeerPhysicsProfile | undefined> {
  const key = bierstil.trim().toLowerCase().replace(/\s+/g, "_");
  try {
    const { data, error } = await createAdminClient().from("beer_style_appearance")
      .select("profile").eq("bierstil", key).maybeSingle();
    if (error) throw new Error(error.message);
    const profile = data?.profile;
    if (profile && /^#[0-9A-Fa-f]{6}$/.test(profile.hex)
      && ["srm", "liquid", "foam", "head", "carbonation"].every(field =>
        typeof profile[field] === "string" && profile[field].length > 0 && profile[field].length <= 1200)) {
      return profile as BeerPhysicsProfile;
    }
    if (profile) console.warn("Invalid beer appearance profile", key);
  } catch (error) {
    console.warn("Beer appearance lookup unavailable; using beverage defaults", key,
      error instanceof Error ? error.message : "unknown error");
  }
  return BEER_PHYSICS[key];
}
