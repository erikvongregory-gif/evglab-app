import { describe, expect, it } from "vitest";
import { ADULT_SCENE_CONTEXT, appendCustomerImageSafety, CUSTOMER_IMAGE_SAFETY_LOCK, withAdultSceneContext } from "./imageSceneContext";

describe("adult scene context", () => {
  it("clarifies unspecified adult ages without rewriting the Oktoberfest motif", () => {
    const brief = "2 junge attraktive frauen auf dem oktoberfest trinken im dirndl ihr bier";
    const prompt = withAdultSceneContext(brief);
    expect(prompt).toContain("aged 25 or older");
    expect(prompt).toContain(brief);
    expect(prompt).toContain("Preserve explicitly stated ages");
    expect(prompt).toContain("do not relabel minors as adults");
  });

  it("keeps the age context within the provider prompt limit", () => {
    const prompt = withAdultSceneContext("x".repeat(12_000));
    expect(prompt).toHaveLength(12_000);
    expect(prompt.startsWith(ADULT_SCENE_CONTEXT)).toBe(true);
    expect(prompt).toContain("Do not add people to a product-only scene");
  });
});

describe("customer image safety lock", () => {
  it("keeps the political and anatomy ban when the prompt is truncated", () => {
    const prompt = appendCustomerImageSafety("x".repeat(20_000), 12_000);
    expect(prompt).toHaveLength(12_000);
    expect(prompt.endsWith(CUSTOMER_IMAGE_SAFETY_LOCK)).toBe(true);
    expect(prompt).toContain("No political content");
    expect(prompt).toContain("fully inside its own shoe");
    expect(prompt).toContain("do not reproduce it");
  });
});
