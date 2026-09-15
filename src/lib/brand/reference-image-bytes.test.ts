import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/security/public-fetch",()=>({publicFetch:vi.fn(async()=>({status:200,body:PNG_1X1,headers:{"content-type":"image/png"}}))}));
import { resolveReferenceImageForVision } from "./reference-image-bytes";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

describe("resolveReferenceImageForVision", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("laedt auch KIE-Temp-HTTPS-URLs (nicht nur interne Store-IDs)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(PNG_1X1, { status: 200, headers: { "content-type": "image/png" } }),
      ),
    );

    const result = await resolveReferenceImageForVision(
      "https://tempfile.redpandaai.co/label.png",
      {},
    );

    expect(result).not.toBeNull();
    expect(result?.mime).toBe("image/png");
    expect(result?.base64).toBe(PNG_1X1.toString("base64"));
  });
});
