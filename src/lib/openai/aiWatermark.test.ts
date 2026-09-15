import { describe, expect, it } from "vitest";
import { buildAiWatermarkOverlay } from "./aiWatermark";

describe("buildAiWatermarkOverlay", () => {
  it("places label in bottom-right with readable size", () => {
    const { svg, x, y, boxWidth, boxHeight } = buildAiWatermarkOverlay(1024, 1280);
    const text = svg.toString("utf8");
    expect(text).toContain(">AI</text>");
    expect(x + boxWidth).toBeLessThanOrEqual(1024 - 10);
    expect(y + boxHeight).toBeLessThanOrEqual(1280 - 10);
    expect(text).toMatch(/font-size="(1[3-9]|[2-9][0-9])"/);
  });

  it("supports bottom-left placement", () => {
    const { x } = buildAiWatermarkOverlay(864, 1536, "bottom-left");
    expect(x).toBeGreaterThanOrEqual(10);
    expect(x).toBeLessThan(200);
  });
});
