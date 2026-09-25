import { describe, expect, it } from "vitest";
import { assembleGenerationReferences } from "./nanoBananaCharacterGenerate";

const ref = (label: string) => ({ mime: "image/png", base64: label });

describe("assembleGenerationReferences", () => {
  it("keeps extra refs on the character path when there is room", () => {
    const assembled = assembleGenerationReferences({
      useCharacterIdentity: true,
      characterRefs: [ref("face")],
      visionReference: ref("bottle"),
      extraRefs: [ref("biergarten")],
      shapeReference: ref("shape"),
    });
    expect(assembled.references.map((item) => item.base64)).toEqual(["face", "bottle", "biergarten"]);
    expect(assembled.extraRefCount).toBe(1);
    expect(assembled.campaignRefCount).toBe(0);
  });

  it("does not silently drop extras on the product path", () => {
    const assembled = assembleGenerationReferences({
      useCharacterIdentity: false,
      characterRefs: [ref("face")],
      visionReference: ref("bottle"),
      extraRefs: [ref("kiste")],
      extraRefRoles: ["scene"],
      shapeReference: ref("shape"),
      glassReference: ref("glass"),
    });
    expect(assembled.references.map((item) => item.base64)).toEqual(["bottle", "shape", "glass", "kiste"]);
    expect(assembled.roles).toEqual([
      { index: 1, role: "product" },
      { index: 2, role: "shape" },
      { index: 3, role: "glass" },
      { index: 4, role: "scene" },
    ]);
    expect(assembled.campaignRefCount).toBe(0);
  });

  it("adds internal campaign images as look-only references without displacing user refs", () => {
    const assembled = assembleGenerationReferences({
      useCharacterIdentity: true,
      characterRefs: [ref("face")],
      visionReference: ref("bottle"),
      extraRefs: [ref("user-scene")],
      extraRefRoles: ["scene"],
      campaignRefs: [ref("campaign-1"), ref("campaign-2")],
      shapeReference: null,
    });
    expect(assembled.references.map((item) => item.base64)).toEqual([
      "face",
      "bottle",
      "campaign-1",
      "campaign-2",
      "user-scene",
    ]);
    expect(assembled.extraRefCount).toBe(1);
    expect(assembled.campaignRefCount).toBe(2);
    expect(assembled.roles.at(-1)).toEqual({ index: 5, role: "scene" });
  });
});
