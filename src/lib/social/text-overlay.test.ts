import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  composeSocialTextOverlay,
  parsePrimaryBrandColor,
} from "@/lib/social/text-overlay";

describe("text-overlay", () => {
  it("parses primary brand hex", () => {
    expect(parsePrimaryBrandColor("#E8772E, #6B4423")).toBe("#E8772E");
    expect(parsePrimaryBrandColor("warm orange")).toBe("#FFFFFF");
  });

  it("renders German campaign text with the bundled fallback font", async () => {
    const imageBuffer = await sharp({
      create: { width: 1024, height: 1024, channels: 3, background: "#8A6A42" },
    }).png().toBuffer();
    const fontBuffer = await readFile(
      join(process.cwd(), "public", "public", "fonts", "work-sans-latin-ext-700-normal.woff2"),
    );
    const output = await composeSocialTextOverlay({
      imageBuffer,
      overlay: {
        width: 1024,
        height: 1024,
        headline: "Frisch & gut <heute> – Grüße aus München",
        subline: "Jetzt im Biergarten",
        ctaText: "Mehr erfahren",
        fontName: "Work Sans",
        fontBuffer,
        fontMime: "font/woff2",
      },
    });
    await expect(sharp(output).metadata()).resolves.toMatchObject({
      width: 1024,
      height: 1024,
      format: "png",
    });

    const renderHeadline = (headline: string) => composeSocialTextOverlay({
      imageBuffer,
      overlay: {
        width: 1024,
        height: 1024,
        headline,
        fontName: "Work Sans",
        fontBuffer,
        fontMime: "font/woff2",
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
