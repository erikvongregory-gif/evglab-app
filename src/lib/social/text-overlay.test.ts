import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  composeSocialTextOverlay,
  parsePrimaryBrandColor,
  wrapCampaignText,
} from "@/lib/social/text-overlay";

describe("text-overlay", () => {
  it("parses primary brand hex", () => {
    expect(parsePrimaryBrandColor("#E8772E, #6B4423")).toBe("#E8772E");
    expect(parsePrimaryBrandColor("warm orange")).toBe("#FFFFFF");
  });

  it("balances campaign copy without orphaning or dropping words", () => {
    expect(wrapCampaignText("Tief verwurzelt. Doppelt stark.", 20, 2)).toEqual([
      "Tief verwurzelt.",
      "Doppelt stark.",
    ]);
    expect(wrapCampaignText("Unser Doppelbock – gebraut mit Charakter", 30, 2).join(" ")).toBe(
      "Unser Doppelbock – gebraut mit Charakter",
    );
  });

  it("renders German campaign text with the bundled fallback font", async () => {
    const imageBuffer = await sharp({
      create: { width: 1024, height: 1280, channels: 3, background: "#8A6A42" },
    }).png().toBuffer();
    const output = await composeSocialTextOverlay({
      imageBuffer,
      overlay: {
        width: 1024,
        height: 1280,
        headline: "Frisch & gut <heute> – Grüße aus München",
        subline: "Jetzt im Biergarten",
        ctaText: "Mehr erfahren",
      },
    });
    await expect(sharp(output).metadata()).resolves.toMatchObject({
      width: 1024,
      height: 1280,
      format: "png",
    });

    const renderHeadline = (headline: string) => composeSocialTextOverlay({
      imageBuffer,
      overlay: {
        width: 1024,
        height: 1280,
        headline,
      },
    });
    const whiteSpan = async (buffer: Buffer) => {
      const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
      let min = info.width;
      let max = -1;
      for (let index = 0; index < data.length; index += info.channels) {
        if (data[index] > 230 && data[index + 1] > 230 && data[index + 2] > 230) {
          const x = (index / info.channels) % info.width;
          min = Math.min(min, x);
          max = Math.max(max, x);
        }
      }
      return max - min + 1;
    };
    const narrow = await whiteSpan(await renderHeadline("iiiiiiii"));
    const wide = await whiteSpan(await renderHeadline("WWWWWWWW"));
    expect(wide).toBeGreaterThan(narrow * 2);
  });
});
