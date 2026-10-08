import sharp from "sharp";
import type { BeerPhysicsProfile } from "@/lib/beverages/beer-appearance";
import type { HyperrealisticInput } from "@/app/(dashboard)/inhalte-erstellen/lib/schemas";
import { resolveBeerPhysics } from "@/app/(dashboard)/inhalte-erstellen/lib/prompt-builders/hyperrealism-blocks";
import type { OpenAiReferenceImage } from "./generateImage";

/** Data-only swatch: no reference scene, person, wardrobe, glass or photographic treatment. */
export async function buildBeerColorReference(input: HyperrealisticInput, appearance?: BeerPhysicsProfile): Promise<OpenAiReferenceImage | null> {
  if ((input.produktKategorie ?? "bier") !== "bier" || input.behaelter === "F") return null;
  const { hex } = appearance ?? resolveBeerPhysics(input.bierstil);
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return null;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="#ffffff"/><text x="256" y="44" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#222">POURED BEER COLOR ONLY</text><rect x="32" y="72" width="448" height="368" fill="${hex}"/><text x="256" y="480" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#222">${hex}</text></svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return { base64: png.toString("base64"), mime: "image/png" };
}
