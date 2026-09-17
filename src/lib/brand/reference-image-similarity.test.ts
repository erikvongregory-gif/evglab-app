import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { matchingReferenceFingerprints, referenceImageFingerprint } from "./reference-image-similarity";
import { pickBrandReferenceImages, type DownloadedImage } from "./website-intake";

async function scene(color = "#527c26") {
  return sharp({ create: { width: 400, height: 300, channels: 3, background: color } })
    .composite([{ input: Buffer.from('<svg width="400" height="100"><rect width="400" height="100" fill="#b89260"/><circle cx="80" cy="20" r="30" fill="#694221"/></svg>'), top: 200, left: 0 }])
    .png().toBuffer();
}

function image(base64: string, url: string, visualFingerprint?: string): DownloadedImage {
  return { base64, url, visualFingerprint, alt: "Biergarten", score: 90, productScore: 30, lifestyleScore: 90, isPackshot: false, mediaType: "image/jpeg", mime: "image/jpeg", sizeBytes: 1000 };
}

describe("reference image deduplication", () => {
  it("keeps one scene across different URLs, resolutions and encodings", async () => {
    const original = await scene();
    const copies = await Promise.all([200, 600, 800].map(width => sharp(original).resize(width).jpeg({ quality: 75 }).toBuffer()));
    const images = await Promise.all([original, ...copies].map(async (buffer, index) => image(buffer.toString("base64"), `https://brew.example/biergarten-${index}.jpg`, await referenceImageFingerprint(buffer))));
    expect(pickBrandReferenceImages(images)).toHaveLength(1);
  });

  it("keeps distinct scenes", async () => {
    const [a, b] = await Promise.all([scene(), scene("#4056af")]);
    expect(matchingReferenceFingerprints(await referenceImageFingerprint(a), await referenceImageFingerprint(b))).toBe(false);
  });

  it("keeps different compositions with the same colors", async () => {
    const original = await scene();
    const flipped = await sharp(original).flip().png().toBuffer();
    expect(matchingReferenceFingerprints(await referenceImageFingerprint(original), await referenceImageFingerprint(flipped))).toBe(false);
  });

  it("deduplicates exact bytes even without a visual fingerprint", () => {
    expect(pickBrandReferenceImages([image("same-bytes", "https://brew.example/biergarten.jpg"), image("same-bytes", "https://brew.example/terrasse.jpg")])).toHaveLength(1);
  });

  it("does not merge different product labels by a coarse thumbnail", () => {
    const fingerprint = Buffer.alloc(768, 100).toString("base64");
    const images = [image("label-a", "https://brew.example/pils.jpg", fingerprint), image("label-b", "https://brew.example/helles.jpg", fingerprint)].map(item => ({ ...item, isPackshot: true }));
    expect(pickBrandReferenceImages(images)).toHaveLength(2);
  });
});
