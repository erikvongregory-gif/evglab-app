import { describe, expect, it } from "vitest";
import {
  isTruthyTermsAcceptance,
  TERMS_ACCEPTANCE_FORM_FIELD,
  termsAcceptanceMetadata,
} from "./termsAcceptance";

describe("termsAcceptance", () => {
  it("accepts common truthy form values", () => {
    expect(isTruthyTermsAcceptance("1")).toBe(true);
    expect(isTruthyTermsAcceptance("on")).toBe(true);
    expect(isTruthyTermsAcceptance("true")).toBe(true);
    expect(isTruthyTermsAcceptance(null)).toBe(false);
    expect(isTruthyTermsAcceptance("0")).toBe(false);
  });

  it("builds metadata with version stamp", () => {
    const meta = termsAcceptanceMetadata("2026-09-16T10:00:00.000Z");
    expect(meta.terms_accepted_at).toBe("2026-09-16T10:00:00.000Z");
    expect(meta.terms_version).toBeTruthy();
    expect(TERMS_ACCEPTANCE_FORM_FIELD).toBe("accepted_terms");
  });
});
