import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderError } from "./providerRequest";
import { classifyProviderError } from "./providerErrors";

const mocks = vi.hoisted(() => ({ render: vi.fn(), finish: vi.fn(), persist: vi.fn() }));
vi.mock("@/app/(dashboard)/inhalte-erstellen/lib/api-guards", () => ({
  requireImageGenerationUser: async () => ({ ok: true, userId: "user", userMetadata: {} }),
}));
vi.mock("@/lib/billing/access", () => ({ requireActiveSubscription: async () => null }));
vi.mock("@/lib/billing/store", () => ({
  ensureBillingRow: async () => {},
  getEffectiveBillingRow: async () => ({ monthly_tokens: 1000, used_tokens: 0 }),
}));
vi.mock("@/lib/billing/generationJobs", () => ({
  resumeGenerationIfPresent: async () => null,
  reserveGeneration: async () => ({ id: "job", user_id: "user" }),
  finishGeneration: mocks.finish,
  saveGenerationProgress: vi.fn(),
  buildGenerationBillingSnapshot: vi.fn(),
}));
vi.mock("@/lib/openai/imageApiKey", () => ({ requireOpenAiImageApiKey: () => "test-key" }));
vi.mock("@/lib/brand/reference-image-bytes", () => ({ resolveReferenceImageForVision: async () => null }));
vi.mock("@/lib/openai/bottleShapeReference", () => ({ loadBottleShapeReference: async () => null }));
vi.mock("@/lib/dashboard/brandProfile", () => ({
  getBrandProfileFromMetadata: () => ({
    breweryName: "Test", brandLabelReferenceUrl: "", brandHeadlineFontName: "",
    brandFontFileUrl: "", brandColors: "", brandFontWeight: "700",
  }),
  canUseCampaignWithTextProfile: () => true,
  buildBrandProfilePromptContext: () => "",
}));
vi.mock("@/lib/prompts/prompt-compiler", () => ({
  compileBrief: async () => ({
    blocking_issues: [], image_prompt: "A beer garden with adult guests.",
    generation_settings: { aspectRatio: "4:5", quality: "medium" },
  }),
}));
vi.mock("@/lib/openai/generateImage", () => ({
  generateOpenAiImage: mocks.render,
  mapAspectRatioToOpenAiSize: () => "1024x1536",
  cropImageBufferToAspectRatio: vi.fn(),
}));
vi.mock("@/lib/supabase/storage", () => ({ uploadGeneratedImageToStorage: vi.fn() }));
vi.mock("@/lib/dashboard/persistGeneratedMedia", () => ({ persistGeneratedMediaItems: mocks.persist }));

import { POST as product } from "@/app/api/inhalte-erstellen/create-task/route";
import { POST as social } from "@/app/api/inhalte-erstellen/social-post/route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.render.mockRejectedValue(new ProviderError(classifyProviderError({
    provider: "openai", status: 400, code: "moderation_blocked", message: "Blocked by safety system",
  })));
  mocks.finish.mockResolvedValue({ ok: true, state: {} });
});

describe.each([["product", product], ["social", social]] as const)("%s image rejection", (_name, post) => {
  it("stops after the first rejected variant and settles at zero before reporting no charge", async () => {
    const response = await post(new Request("https://app.example/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        etikettBild: "https://example.com/placeholder.png", flaschenTyp: "nrw_500",
        bierstil: "helles", szene: "biergarten_sommer", etikettModus: "generisch",
        stiltreue: "frei", variantCount: 3, quality: "medium", headline: "Oktoberfest",
        zusatzWunsch: "2 junge attraktive frauen auf dem oktoberfest trinken im dirndl ihr bier",
      }),
    }));
    expect(response.status).toBe(422);
    const result = await response.json();
    expect(result.code).toBe("provider_content_rejected");
    expect(result.error).toContain("keine Tokens berechnet");
    expect(mocks.render).toHaveBeenCalledTimes(1);
    expect(mocks.render.mock.calls[0][0].prompt).toContain("aged 25 or older");
    expect(mocks.finish).toHaveBeenCalledWith(
      expect.objectContaining({ id: "job" }), 0,
      expect.objectContaining({ error: result.error, images: [], billing: { consumed: 0 } }),
    );
    expect(mocks.persist).not.toHaveBeenCalled();
  });

  it("does not claim a refund when settlement fails", async () => {
    mocks.finish.mockRejectedValueOnce(new Error("Auftragsabschluss ausstehend."));
    const response = await post(new Request("https://app.example/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        etikettBild: "https://example.com/placeholder.png", flaschenTyp: "nrw_500",
        bierstil: "helles", szene: "biergarten_sommer", etikettModus: "generisch",
        stiltreue: "frei", variantCount: 1, headline: "Oktoberfest",
      }),
    }));
    expect(response.status).toBe(500);
    expect((await response.json()).error).not.toContain("keine Tokens berechnet");
  });
});
