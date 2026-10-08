import { describe, expect, it } from "vitest";
import { readBrandReferenceImageBuffer } from "./reference-image-store";

describe("user-controlled reference image metadata", () => {
  const metadata = (mime: string) => ({ dashboard: { brandReferenceImages: {
    br_security123: { mime, base64: Buffer.from('<script>alert(1)</script>').toString('base64') },
  } } });

  it("rejects active documents supplied through editable auth metadata", () => {
    for (const mime of ["text/html", "image/svg+xml", "application/xhtml+xml", "text/javascript"]) {
      expect(readBrandReferenceImageBuffer(metadata(mime), "br_security123")).toBeNull();
    }
  });

  it("keeps existing raster references accessible", () => {
    for (const mime of ["image/jpeg", "image/png", "image/webp"]) {
      expect(readBrandReferenceImageBuffer(metadata(mime), "br_security123")?.mime).toBe(mime);
    }
  });
});
