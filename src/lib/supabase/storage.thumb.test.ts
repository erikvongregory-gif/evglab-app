import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { makeWebpThumb } from "@/lib/supabase/storage";

describe("makeWebpThumb", () => {
  it("creates a smaller webp within max edge", async () => {
    const source = await sharp({
      create: { width: 2000, height: 1200, channels: 3, background: { r: 40, g: 80, b: 120 } },
    })
      .png()
      .toBuffer();

    const thumb = await makeWebpThumb(source);
    const meta = await sharp(thumb).metadata();

    expect(meta.format).toBe("webp");
    expect(meta.width).toBeLessThanOrEqual(512);
    expect(meta.height).toBeLessThanOrEqual(512);
    expect(thumb.byteLength).toBeLessThan(source.byteLength);
  });
});
