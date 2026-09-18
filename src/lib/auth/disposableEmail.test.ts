import { describe, expect, it } from "vitest";
import { isDisposableEmail, normalizeEmailIdentity } from "./disposableEmail";

describe("disposableEmail", () => {
  it("flags known throwaway domains", () => {
    expect(isDisposableEmail("a@mailinator.com")).toBe(true);
    expect(isDisposableEmail("a@yopmail.com")).toBe(true);
    expect(isDisposableEmail("a@gmail.com")).toBe(false);
  });

  it("collapses gmail aliases", () => {
    expect(normalizeEmailIdentity("E.rik+brew@gmail.com")).toBe("erik@gmail.com");
    expect(normalizeEmailIdentity("erik@googlemail.com")).toBe("erik@gmail.com");
  });
});
