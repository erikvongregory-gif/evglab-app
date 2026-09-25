import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  reserve: vi.fn(),
  resume: vi.fn(),
  finish: vi.fn(),
  render: vi.fn(),
  persist: vi.fn(),
}));

vi.mock("@/app/(dashboard)/inhalte-erstellen/lib/api-guards", () => ({
  requireImageGenerationUser: async () => ({ ok: true, userId: "user", userMetadata: {} }),
}));
vi.mock("@/lib/billing/access", () => ({ requireActiveSubscription: async () => null }));
vi.mock("@/lib/billing/store", () => ({
  ensureBillingRow: async () => {},
  getEffectiveBillingRow: async () => ({ monthly_tokens: 1000, used_tokens: 0 }),
}));
vi.mock("@/lib/billing/generationJobs", () => ({
  resumeGenerationIfPresent: mocks.resume,
  reserveGeneration: mocks.reserve,
  finishGeneration: mocks.finish,
  saveGenerationProgress: vi.fn(),
  buildGenerationBillingSnapshot: vi.fn(() => ({ consumed: 20, remainingTokens: 980, perVariant: 10 })),
  linkProviderTask: vi.fn(),
  getGenerationJobForUser: async () => ({ id: "job", user_id: "user", result: {} }),
}));
vi.mock("@/lib/openai/imageApiKey", () => ({ requireOpenAiImageApiKey: () => "test-key" }));
vi.mock("@/lib/brand/reference-image-bytes", () => ({
  resolveReferenceImageForVision: async (raw: string) => ({ mime: "image/png", base64: raw.slice(-8) }),
}));
vi.mock("@/lib/openai/bottleShapeReference", () => ({ loadBottleShapeReference: async () => null }));
vi.mock("@/lib/openai/glassShapeReference", () => ({ loadGlassShapeReference: async () => null }));
vi.mock("@/lib/dashboard/brandProfile", () => ({
  getBrandProfileFromMetadata: () => ({
    breweryName: "Test",
    brandLabelReferenceUrl: "https://cdn.example/brand.png",
    brandHeadlineFontName: "",
    brandFontFileUrl: "",
    brandColors: "#112233",
    brandFontWeight: "700",
  }),
  canUseCampaignWithTextProfile: () => true,
  buildBrandProfilePromptContext: () => "brand look",
}));
vi.mock("@/lib/prompts/prompt-compiler", () => ({
  compileBrief: async () => ({
    blocking_issues: [],
    image_prompt: "A beer garden.",
    generation_settings: { aspectRatio: "16:9", quality: "medium" },
    normalized_brief: { scene: "garden", action: "", people: "" },
    missing_information: [],
    reference_roles: [],
  }),
}));
vi.mock("@/lib/openai/generateImage", () => ({
  generateOpenAiImage: mocks.render,
  mapAspectRatioToOpenAiSize: () => "1024x1536",
  cropImageBufferToAspectRatio: async (buffer: Buffer) => buffer,
}));
vi.mock("@/lib/openai/aiWatermark", () => ({ applyAiWatermark: async (buffer: Buffer) => buffer }));
vi.mock("@/lib/supabase/storage", () => ({
  uploadGeneratedImageToStorage: async () => "https://cdn.example/out.png",
  uploadGeneratedImageWithThumb: async () => ({
    imageUrl: "https://cdn.example/out.png",
    thumbUrl: "https://cdn.example/out-thumb.webp",
  }),
}));
vi.mock("@/lib/dashboard/persistGeneratedMedia", () => ({ persistGeneratedMediaItems: mocks.persist }));
vi.mock("@/lib/kie/nanoBananaCharacterGenerate", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/kie/nanoBananaCharacterGenerate")>();
  return {
    ...actual,
    generateCharacterIdentityImage: mocks.render,
    cropBufferFaceSafe: async (buffer: Buffer) => buffer,
  };
});
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: () => undefined };
});

import { POST as product } from "@/app/api/inhalte-erstellen/create-task/route";

const characterPayload = {
  etikettBild: "https://cdn.example/beer.png",
  flaschenTyp: "nrw_500",
  bierstil: "helles",
  szene: "biergarten_sommer",
  etikettModus: "marke",
  keepLabel: true,
  characterName: "Marta",
  characterReferenceImages: ["https://cdn.example/marta.jpg"],
  extraReferenceImages: [
    "https://cdn.example/scene.png",
    "https://cdn.example/look.png",
    "https://cdn.example/too-many.png",
  ],
  extraReferenceRoles: ["scene", "look", "scene"],
  aspectRatio: "16:9",
  variantCount: 1,
  quality: "medium",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("KIE_API_KEY", "test-kie");
  mocks.resume.mockResolvedValue(null);
  mocks.reserve.mockResolvedValue({ id: "job", user_id: "user" });
  mocks.finish.mockResolvedValue({ ok: true, state: { monthly_tokens: 1000, used_tokens: 20 } });
  mocks.persist.mockResolvedValue([{ id: "gen-job-0" }]);
  mocks.render.mockResolvedValue(Buffer.from("img"));
});

describe("studio generation contract", () => {
  it("rejects character plus too many extra refs before reserving tokens", async () => {
    const response = await product(
      new Request("https://app.example/api/inhalte-erstellen/create-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(characterPayload),
      }),
    );
    expect(response.status).toBe(422);
    expect((await response.json()).code).toBe("extra_refs_overflow");
    expect(mocks.reserve).not.toHaveBeenCalled();
  });

  it("stores the effective character format on the accepted snapshot", async () => {
    const response = await product(
      new Request("https://app.example/api/inhalte-erstellen/create-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...characterPayload, extraReferenceImages: ["https://cdn.example/scene.png"] }),
      }),
    );
    expect(response.status).toBe(202);
    const body = await response.json();
    expect(body.snapshot.aspectRatio).toBe("4:5");
    expect(body.aspectRatio).toBe("4:5");
    expect(mocks.reserve).toHaveBeenCalledTimes(1);
  });

  it("resumes the same job instead of reserving again", async () => {
    mocks.resume.mockResolvedValueOnce(
      new Response(JSON.stringify({ images: [{ imageUrl: "https://cdn.example/done.png" }], jobId: "job" }), {
        status: 200,
      }),
    );
    const response = await product(
      new Request("https://app.example/api/inhalte-erstellen/create-task", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": "same-key" },
        body: JSON.stringify({ ...characterPayload, extraReferenceImages: [] }),
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.reserve).not.toHaveBeenCalled();
  });
});
