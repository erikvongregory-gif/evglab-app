import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { applyAiWatermark, buildAiWatermarkOverlay } from "./aiWatermark";

describe("buildAiWatermarkOverlay", () => {
  it("places path-based AI badge in bottom-right with readable size", () => {
    const { svg, x, y, boxWidth, boxHeight, fontSize } = buildAiWatermarkOverlay(1024, 1280);
    const text = svg.toString("utf8");
    expect(text).toContain("<path");
    expect(text).not.toContain("<text");
    expect(x + boxWidth).toBeLessThanOrEqual(1024 - 10);
    expect(y + boxHeight).toBeLessThanOrEqual(1280 - 10);
    expect(fontSize).toBeGreaterThanOrEqual(14);
    expect(boxWidth).toBeGreaterThanOrEqual(36);
    expect(boxWidth).toBeLessThan(90);
  });

  it("supports bottom-left placement", () => {
    const { x } = buildAiWatermarkOverlay(864, 1536, "bottom-left");
    expect(x).toBeGreaterThanOrEqual(10);
    expect(x).toBeLessThan(200);
  });
});

describe("applyAiWatermark", () => {
  it("rasterizes bright AI glyph pixels in the bottom-right corner", async () => {
    const base = await sharp({
      create: { width: 400, height: 500, channels: 3, background: { r: 40, g: 40, b: 40 } },
    })
      .png()
      .toBuffer();

    const marked = await applyAiWatermark(base, "png");
    const { data, info } = await sharp(marked).raw().toBuffer({ resolveWithObject: true });

    const overlay = buildAiWatermarkOverlay(info.width, info.height);
    let bright = 0;
    for (let y = overlay.y; y < overlay.y + overlay.boxHeight; y++) {
      for (let x = overlay.x; x < overlay.x + overlay.boxWidth; x++) {
        const i = (y * info.width + x) * info.channels;
        // Glyph-Pixel: deutlich heller als der dunkle Badge-Hintergrund
        if (data[i]! > 140 && data[i + 1]! > 140 && data[i + 2]! > 140) bright += 1;
      }
    }
    expect(bright).toBeGreaterThan(20);
  });
});
