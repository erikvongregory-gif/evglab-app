import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/brand/kie-upload", () => ({
  uploadImagesToKie: vi.fn(async () => ["https://cdn.example/kie-1.jpg"]),
}));

vi.mock("@/lib/brand/reference-image-store", () => ({
  prepareReferenceImagePayloads: vi.fn(async (images: Array<{ base64: string; mime: string }>) => images),
}));

import { storeBrandReferenceImagesAsUrls } from "@/lib/brand/persist-reference-urls";
import { uploadImagesToKie } from "@/lib/brand/kie-upload";

describe("storeBrandReferenceImagesAsUrls", () => {
  it("prefers KIE URLs when API key is set", async () => {
    vi.stubEnv("KIE_API_KEY", "test-key");
    const urls = await storeBrandReferenceImagesAsUrls([
      { base64: "aGVsbG8=", mime: "image/jpeg", sourceUrl: "https://brauerei.de/a.jpg" },
    ]);
    expect(uploadImagesToKie).toHaveBeenCalled();
    expect(urls).toEqual(["https://cdn.example/kie-1.jpg"]);
    vi.unstubAllEnvs();
  });

  it("falls back to HTTPS source URLs without KIE key", async () => {
    vi.stubEnv("KIE_API_KEY", "");
    const urls = await storeBrandReferenceImagesAsUrls(
      [{ base64: "aGVsbG8=", mime: "image/jpeg", sourceUrl: "https://brauerei.de/flasche.png" }],
      { preferSourceUrls: true },
    );
    expect(urls).toEqual(["https://brauerei.de/flasche.png"]);
    vi.unstubAllEnvs();
  });
});
