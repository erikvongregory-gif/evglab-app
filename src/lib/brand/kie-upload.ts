function extractUploadedFileUrl(input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  const directCandidates = [record.fileUrl, record.url, record.downloadUrl, record.path];
  for (const candidate of directCandidates) {
    if (typeof candidate === "string" && /^https?:\/\//i.test(candidate)) {
      return candidate;
    }
  }
  for (const value of Object.values(record)) {
    const nested = extractUploadedFileUrl(value);
    if (nested) return nested;
  }
  return null;
}

export async function uploadBase64ToKie(
  apiKey: string,
  base64DataUrl: string,
  index: number,
  mime: string,
): Promise<string | null> {
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const uploadRes = await fetch("https://kieai.redpandaai.co/api/file-base64-upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      base64Data: base64DataUrl,
      uploadPath: "evglab/brand-reference-uploads",
      fileName: `brand-ref-${Date.now()}-${index + 1}.${ext}`,
    }),
  });
  const uploadPayload = (await uploadRes.json()) as Record<string, unknown>;
  if (!uploadRes.ok) return null;
  return extractUploadedFileUrl(uploadPayload);
}

export async function uploadImagesToKie(
  kieKey: string,
  images: Array<{ base64: string; mime: string }>,
): Promise<string[]> {
  const urls: string[] = [];
  for (let i = 0; i < images.length; i += 1) {
    const image = images[i];
    if (!image) continue;
    const dataUrl = `data:${image.mime};base64,${image.base64}`;
    const url = await uploadBase64ToKie(kieKey, dataUrl, i, image.mime);
    if (url) urls.push(url);
  }
  return urls.slice(0, 10);
}
