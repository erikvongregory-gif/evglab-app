import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn(), sign: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: mocks.from,
    storage: { from: () => ({ createSignedUrl: mocks.sign }) },
  }),
}));
vi.mock("@/lib/supabase/env", () => ({ getSupabaseUrl: () => "https://project.supabase.co" }));
import { readDashboardBeers, replaceDashboardBeers, upsertDashboardBeer, AssortmentConflictError } from "./beer-store";
import { beersRevision } from "@/lib/inhalte-erstellen/studio-config";

const path = "beer-labels/owner/bottle.png";
const expired = `https://project.supabase.co/storage/v1/object/sign/generated-images/${path}?token=expired`;
const fresh = `https://project.supabase.co/storage/v1/object/sign/generated-images/${path}?token=fresh`;
const beer = { id: "beer", name: "Helles", bierstil: "helles", flaschenTyp: "nrw_500", flaschenfarbe: "braun" as const, etikettUrl: expired, createdAt: "" };

function query(data: unknown, error: unknown = null) {
  return {
    select() { return this; }, eq() { return this; }, order() { return this; },
    upsert() { return this; },
    then(resolve: (result: unknown) => unknown) { return Promise.resolve({ data, error }).then(resolve); },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SUPABASE_GENERATED_IMAGES_BUCKET", "generated-images");
  mocks.sign.mockResolvedValue({ data: { signedUrl: fresh }, error: null });
});
afterEach(() => vi.unstubAllEnvs());

describe("beer image access", () => {
  it("renews an expired sort photo without overwriting the stored beer", async () => {
    mocks.from.mockReturnValue(query([{ item: beer }]));
    expect((await readDashboardBeers("owner"))[0].etikettUrl).toBe(fresh);
    expect(mocks.sign).toHaveBeenCalledWith(path, 3600);
    expect(beer.etikettUrl).toBe(expired);
  });

  it("also renews legacy public URLs after the bucket became private", async () => {
    const legacy = `https://project.supabase.co/storage/v1/object/public/generated-images/${path}`;
    mocks.from.mockReturnValue(query([{ item: { ...beer, etikettUrl: legacy } }]));
    expect((await readDashboardBeers("owner"))[0].etikettUrl).toBe(fresh);
  });

  it("does not sign another workspace's images or external brewery URLs", async () => {
    const foreign = expired.replace("/owner/", "/other/");
    const external = "https://brewery.example/bottle.png";
    mocks.from.mockReturnValue(query([
      { item: { ...beer, etikettUrl: foreign } },
      { item: { ...beer, id: "external", etikettUrl: external } },
    ]));
    expect((await readDashboardBeers("owner")).map((item) => item.etikettUrl)).toEqual([foreign, external]);
    expect(mocks.sign).not.toHaveBeenCalled();
  });

  it("returns renewed photos after saving a previously loaded assortment", async () => {
    mocks.from.mockReturnValue(query([{ item: beer, id: beer.id }]));
    expect((await replaceDashboardBeers("owner", [beer], { force: true }))[0].etikettUrl).toBe(fresh);
  });

  it("does not silently return an empty assortment when the read fails", async () => {
    mocks.from.mockReturnValue(query(null, { message: "unavailable" }));
    await expect(readDashboardBeers("owner")).rejects.toThrow("Sortiment konnte nicht geladen werden");
  });

  it("adds one beer without deleting siblings", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const sibling = { id: "keep-me", position: 0 };
    mocks.from.mockImplementation(() => ({
      select() { return this; },
      eq() { return this; },
      order() { return this; },
      upsert,
      then(resolve: (result: unknown) => unknown) {
        return Promise.resolve({ data: [sibling, { item: beer }], error: null }).then(resolve);
      },
    }));
    const next = { ...beer, id: "new-beer", name: "Pils" };
    const saved = await upsertDashboardBeer("owner", next);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0][0]).toMatchObject({ id: "new-beer", user_id: "owner" });
    expect(saved.some((item) => item.id === "beer")).toBe(true);
  });

  it("rejects two stale full replacements instead of deleting a sibling", async () => {
    const sibling = { ...beer, id: "keep-c", name: "Weizen" };
    mocks.from.mockReturnValue(query([{ item: beer }, { item: sibling }]));
    const staleRevision = beersRevision([beer]);
    await expect(
      replaceDashboardBeers("owner", [{ ...beer, name: "Helles Extra" }], { expectedRevision: staleRevision }),
    ).rejects.toBeInstanceOf(AssortmentConflictError);
  });
});
