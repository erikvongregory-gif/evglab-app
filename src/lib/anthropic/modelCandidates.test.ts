import { afterEach, describe, expect, it } from "vitest";
import { getAnthropicModelCandidates } from "./modelCandidates";

describe("getAnthropicModelCandidates", () => {
  const original = process.env.ANTHROPIC_MODEL;

  afterEach(() => {
    if (original === undefined) delete process.env.ANTHROPIC_MODEL;
    else process.env.ANTHROPIC_MODEL = original;
  });

  it("uses active Sonnet/Haiku fallbacks without retired 3.5 models", () => {
    delete process.env.ANTHROPIC_MODEL;
    const models = getAnthropicModelCandidates();
    expect(models[0]).toBe("claude-sonnet-4-6");
    expect(models).toContain("claude-haiku-4-5-20251001");
    expect(models).not.toContain("claude-3-5-haiku-20241022");
    expect(models).not.toContain("claude-3-5-sonnet-20241022");
    expect(models).not.toContain("claude-sonnet-4-20250514");
  });

  it("prepends env override before fallbacks", () => {
    process.env.ANTHROPIC_MODEL = "claude-opus-4-6";
    expect(getAnthropicModelCandidates()[0]).toBe("claude-opus-4-6");
  });
});
