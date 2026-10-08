import { beforeEach, describe, expect, it, vi } from "vitest";
import { BEER_PHYSICS } from "./beer-appearance";
import { BEER_STYLE_OPTIONS } from "@/app/(dashboard)/inhalte-erstellen/lib/beer-styles";
import { readBeerAppearance } from "./beer-appearance-store";

const mocks = vi.hoisted(() => ({ single: vi.fn(), eq: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ select: () => ({ eq: mocks.eq }) }) }),
}));
beforeEach(() => {
  mocks.eq.mockReturnValue({ maybeSingle: mocks.single });
  mocks.single.mockResolvedValue({ data: null, error: null });
});

describe("beer appearance database", () => {
  it("covers every selectable beer style, including Radler", () => {
    for (const style of BEER_STYLE_OPTIONS) expect(BEER_PHYSICS[style.bierstil]).toBeDefined();
    expect(BEER_PHYSICS.radler.hex).toBe("#FAE86B");
  });
  it("uses the current database color rather than hardcoded defaults", async () => {
    const profile = { ...BEER_PHYSICS.radler, hex: "#DDE055", liquid: "pale lemon-yellow Radler" };
    mocks.single.mockResolvedValue({ data: { profile }, error: null });
    expect(await readBeerAppearance("Radler")).toEqual(profile);
    expect(mocks.eq).toHaveBeenCalledWith("bierstil", "radler");
  });
  it("falls back safely for a missing profile or database error", async () => {
    expect(await readBeerAppearance("dunkel")).toEqual(BEER_PHYSICS.dunkel);
    mocks.single.mockResolvedValue({ data: null, error: { message: "unavailable" } });
    expect(await readBeerAppearance("radler")).toEqual(BEER_PHYSICS.radler);
  });
  it("rejects malformed profiles", async () => {
    mocks.single.mockResolvedValue({ data: { profile: { ...BEER_PHYSICS.radler, hex: "not a color" } }, error: null });
    expect(await readBeerAppearance("radler")).toEqual(BEER_PHYSICS.radler);
  });
});
