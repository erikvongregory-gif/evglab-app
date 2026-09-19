import { describe, expect, it } from "vitest";
import {
  aspectRatioToCropRect,
  aspectRatioToOutputDimensions,
  mapAspectRatioToOpenAiSize,
} from "./imageAspectRatio";

describe("imageAspectRatio", () => {
  it("maps portrait ratios to OpenAI native size", () => {
    expect(mapAspectRatioToOpenAiSize("4:5")).toBe("1024x1536");
    expect(mapAspectRatioToOpenAiSize("16:9")).toBe("1536x1024");
  });

  it("maps 4K to custom long-edge sizes", () => {
    const square = mapAspectRatioToOpenAiSize("1:1", "4K");
    const [sw, sh] = square.split("x").map(Number);
    expect(sw).toBe(sh);
    expect(sw! * sh!).toBeLessThanOrEqual(8_294_400);
    expect(sw!).toBeGreaterThanOrEqual(2800);

    const landscape = mapAspectRatioToOpenAiSize("16:9", "4K");
    const [w, h] = landscape.split("x").map(Number);
    expect(w).toBeGreaterThan(h!);
    expect(Math.max(w!, h!)).toBeLessThanOrEqual(3824);
    expect(w! * h!).toBeLessThanOrEqual(8_294_400);
  });

  it("crops 4:5 from native 2:3 portrait", () => {
    expect(aspectRatioToOutputDimensions("4:5")).toEqual({ width: 1024, height: 1280 });
    expect(aspectRatioToCropRect("4:5")).toEqual({ left: 0, top: 128, width: 1024, height: 1280 });
  });

  it("crops 3:4 from native 2:3 portrait", () => {
    expect(aspectRatioToOutputDimensions("3:4")).toEqual({ width: 1024, height: 1365 });
  });

  it("crops 9:16 from native 2:3 portrait", () => {
    expect(aspectRatioToOutputDimensions("9:16")).toEqual({ width: 864, height: 1536 });
    expect(aspectRatioToCropRect("9:16").left).toBe(80);
  });

  it("crops 16:9 from native 3:2 landscape", () => {
    expect(aspectRatioToOutputDimensions("16:9")).toEqual({ width: 1536, height: 864 });
  });

  it("crops 4:3 from native 3:2 landscape", () => {
    expect(aspectRatioToOutputDimensions("4:3")).toEqual({ width: 1365, height: 1024 });
  });

  it("keeps 1:1 unchanged", () => {
    expect(aspectRatioToOutputDimensions("1:1")).toEqual({ width: 1024, height: 1024 });
  });
});
