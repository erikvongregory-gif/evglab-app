import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { hyperrealisticSchema } from "@/app/(dashboard)/inhalte-erstellen/lib/schemas";
import { buildBeerColorReference } from "./beerColorReference";
import { BEER_PHYSICS } from "@/lib/beverages/beer-appearance";

const input = hyperrealisticSchema.parse({ etikettBild: "https://example.com/product.png", flaschenTyp: "nrw_500", bierstil: "dunkel", szene: "biergarten_sommer", behaelter: "B" });

describe("beer color swatch", () => {
  it("uses a database Radler color for the actual reference pixels", async () => {
    const appearance = { ...BEER_PHYSICS.radler, hex: "#DDE055" };
    const reference = await buildBeerColorReference({ ...input, bierstil: "radler" }, appearance);
    const pixel = await sharp(Buffer.from(reference!.base64, "base64"))
      .extract({ left: 256, top: 256, width: 1, height: 1 }).removeAlpha().raw().toBuffer();
    expect([...pixel]).toEqual([0xdd, 0xe0, 0x55]);
  });
  it("sends chestnut brown for Dunkel and a different swatch for Helles", async () => {
    const dark = await buildBeerColorReference(input);
    const light = await buildBeerColorReference({ ...input, bierstil: "helles" });
    expect(dark?.mime).toBe("image/png");
    expect(dark?.base64).not.toBe(light?.base64);
    const pixel = await sharp(Buffer.from(dark!.base64, "base64")).extract({ left: 256, top: 256, width: 1, height: 1 }).removeAlpha().raw().toBuffer();
    expect([...pixel]).toEqual([0x6b, 0x3a, 0x1e]);
  });

  it("adds no liquid reference for bottle-only or non-beer images", async () => {
    expect(await buildBeerColorReference({ ...input, behaelter: "F" })).toBeNull();
    expect(await buildBeerColorReference({ ...input, produktKategorie: "mineralwasser" })).toBeNull();
  });
});
