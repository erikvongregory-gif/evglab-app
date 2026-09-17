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
  });

  it("does not silently drop extras on the product path", () => {
    const assembled = assembleGenerationReferences({
      useCharacterIdentity: false,
      characterRefs: [ref("face")],
      visionReference: ref("bottle"),
      extraRefs: [ref("kiste")],
      shapeReference: ref("shape"),
    });
    expect(assembled.references.map((item) => item.base64)).toEqual(["bottle", "kiste", "shape"]);
  });
});
