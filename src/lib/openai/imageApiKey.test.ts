import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getOpenAiImageApiKey,
  LEGACY_OPENAI_KEY_ENV,
  OPENAI_IMAGE_KEY_ENV,
  requireOpenAiImageApiKey,
} from "@/lib/openai/imageApiKey";

describe("imageApiKey", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("bevorzugt OPENAI_IMAGE_API_KEY", () => {
    vi.stubEnv(OPENAI_IMAGE_KEY_ENV, "sk-image");
    vi.stubEnv(LEGACY_OPENAI_KEY_ENV, "sk-legacy");
    expect(getOpenAiImageApiKey()).toBe("sk-image");
    expect(requireOpenAiImageApiKey()).toBe("sk-image");
  });

  it("faellt auf OPENAI_API_KEY zurueck", () => {
    vi.stubEnv(LEGACY_OPENAI_KEY_ENV, "sk-legacy");
    expect(getOpenAiImageApiKey()).toBe("sk-legacy");
  });

  it("wirft wenn kein Key gesetzt ist", () => {
    expect(getOpenAiImageApiKey()).toBeNull();
    expect(() => requireOpenAiImageApiKey()).toThrow(/OPENAI_IMAGE_API_KEY fehlt/);
  });
});
