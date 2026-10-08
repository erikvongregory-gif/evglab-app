import { describe, expect, it } from "vitest";
import { parseLabelTextResponse } from "./label-text";

describe("parseLabelTextResponse", () => {
  it("keeps exact spelling and drops duplicates, quotes and overlong lines", () => {
    expect(parseLabelTextResponse('Sure: ["Hausbräu", "EDEL", "edel", "Spe\\"zial", "' + "x".repeat(50) + '"]')).toEqual([
      "Hausbräu",
      "EDEL",
      "Spezial",
    ]);
  });

  it("returns nothing for unclear answers", () => {
    expect(parseLabelTextResponse("[]")).toEqual([]);
    expect(parseLabelTextResponse("I cannot read it")).toEqual([]);
    expect(parseLabelTextResponse('{"a": 1}')).toEqual([]);
  });

  it("caps the list at four words", () => {
    expect(parseLabelTextResponse('["A1","B2","C3","D4","E5"]')).toHaveLength(4);
  });
});
