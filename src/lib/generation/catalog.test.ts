import { describe, expect, it } from "vitest";
import { getModel, MODELS, parseSettings } from "./catalog";
import { normalizePlane } from "./plane";
import { toModelArkBody, isModelArkRequestId, isSeedanceModel } from "./modelark";

describe("generation catalog", () => {
  it("lists only ModelArk Seedance models", () => {
    expect(MODELS.length).toBeGreaterThan(0);
    expect(MODELS.every((m) => m.provider === "modelark" && m.surface === "video")).toBe(true);
  });

  it("parseSettings clamps to catalog allow-list", () => {
    const model = getModel("seedance-2.5");
    const settings = parseSettings(model, {
      aspectRatio: "16:9",
      duration: 8,
      resolution: "720p",
      generateAudio: true,
      outputFormat: "mp4",
      unknown: "drop-me",
    });
    expect(settings.aspectRatio).toBe("16:9");
    expect(settings.duration).toBe(8);
    expect(settings).not.toHaveProperty("unknown");
  });

  it("normalizePlane respects role caps", () => {
    const model = getModel("seedance-2");
    const plane = normalizePlane(model, {
      model: model.id,
      prompt: { text: "beer garden reel" },
      media: {
        start: [
          { id: "1", url: "https://example.com/a.jpg", role: "start" },
          { id: "2", url: "https://example.com/b.jpg", role: "start" },
        ],
        reference: Array.from({ length: 12 }, (_, i) => ({
          id: String(i),
          url: `https://example.com/r${i}.jpg`,
          role: "reference" as const,
        })),
      },
      settings: {},
    });
    expect(plane.media.start).toHaveLength(1);
    expect(plane.media.reference).toHaveLength(9);
  });
});

describe("modelark body", () => {
  it("maps seedance plane to ModelArk content", () => {
    const model = getModel("seedance-2.5");
    const plane = normalizePlane(model, {
      model: model.id,
      prompt: { text: "sunset pour" },
      media: {
        start: [{ id: "s", url: "https://example.com/start.jpg", role: "start" }],
        reference: [{ id: "r", url: "https://example.com/ref.jpg", role: "reference" }],
      },
      settings: { generateAudio: true, duration: 5, resolution: "720p" },
    });
    const body = toModelArkBody(plane);
    expect(body.model).toBe("dreamina-seedance-2-5-260628");
    expect(body.generate_audio).toBe(true);
    expect(body.resolution).toBe("720p");
    expect(body.ratio).toBeUndefined(); // first_frame present
    const content = body.content as Array<Record<string, unknown>>;
    expect(content[0]).toMatchObject({ type: "text" });
    expect(content.some((c) => c.role === "first_frame")).toBe(true);
    expect(content.some((c) => c.role === "reference_image")).toBe(true);
  });

  it("detects ModelArk request ids", () => {
    expect(isModelArkRequestId("cgt-abc")).toBe(true);
    expect(isModelArkRequestId("kie-xyz")).toBe(false);
    expect(isSeedanceModel("seedance-2.5-edit")).toBe(true);
  });
});
