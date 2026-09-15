import sharp from "sharp";
import { classifyProviderResponse } from "@/lib/ai/providerErrors";
import { ProviderError, withProviderRetry } from "@/lib/ai/providerRequest";
import {
  aspectRatioToCropRect,
  mapAspectRatioToOpenAiSize,
  type OpenAiImageSize,
} from "@/lib/openai/imageAspectRatio";

export type { OpenAiImageSize } from "@/lib/openai/imageAspectRatio";
export { aspectRatioToOutputDimensions, mapAspectRatioToOpenAiSize } from "@/lib/openai/imageAspectRatio";
export type OpenAiImageQuality = "low" | "medium" | "high" | "auto";

export type OpenAiReferenceImage = { base64: string; mime: string };

/** Center-Crop auf das gewählte UI-Format (OpenAI liefert nur 1:1 / 2:3 / 3:2). */
export async function cropImageBufferToAspectRatio(
  buffer: Buffer,
  aspectRatio: string,
  outputFormat: "png" | "jpg" = "png",
): Promise<Buffer> {
  const crop = aspectRatioToCropRect(aspectRatio);
  const source = mapAspectRatioToOpenAiSize(aspectRatio);
  const [nativeW, nativeH] = source.split("x").map(Number);
  if (crop.width === nativeW && crop.height === nativeH) return buffer;

  const pipeline = sharp(buffer).extract(crop);
  return outputFormat === "jpg" ? pipeline.jpeg({ quality: 92 }).toBuffer() : pipeline.png().toBuffer();
}

function parseOpenAiBase64(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const data = record.data;
  if (!Array.isArray(data) || data.length === 0) return null;
  const first = data[0];
  if (!first || typeof first !== "object") return null;
  const b64 = (first as Record<string, unknown>).b64_json;
  return typeof b64 === "string" && b64.length > 0 ? b64 : null;
}

function referenceToFile(reference: OpenAiReferenceImage, index: number): File {
  const buffer = Buffer.from(reference.base64, "base64");
  const mime = reference.mime.toLowerCase().includes("jpeg") ? "image/jpeg" : reference.mime;
  const ext = mime.includes("jpeg") ? "jpg" : mime.includes("webp") ? "webp" : "png";
  return new File([buffer], `reference-${index}.${ext}`, { type: mime });
}

/**
 * Erzeugt EIN Bild direkt ueber die OpenAI Images API (gpt-image-2.5-sunburst).
 * - Mit Referenzbild(ern) → `images/edits` (multipart, bis zu 16 Bilder) fuer
 *   Form-/Etikett-Treue (i2i). Reihenfolge der `referenceImages` ist relevant
 *   (z. B. Bild 1 = Flaschenform, Bild 2 = Etikett) und muss im Prompt erklaert
 *   werden.
 * - Ohne Referenz → `images/generations`.
 * WICHTIG: `response_format` wird NICHT gesendet — GPT-Image-Modelle lehnen es ab
 * und liefern immer base64. Gibt den Bild-Buffer zurueck.
 */
export async function generateOpenAiImage(args: {
  apiKey: string;
  model: string;
  prompt: string;
  size: OpenAiImageSize;
  outputFormat: "png" | "jpg";
  quality?: OpenAiImageQuality;
  referenceImage?: OpenAiReferenceImage | null;
  referenceImages?: OpenAiReferenceImage[] | null;
}): Promise<Buffer> {
  const { apiKey, model, prompt, size, outputFormat, quality, referenceImage, referenceImages } = args;
  const outputFmt = outputFormat === "jpg" ? "jpeg" : "png";

  const refs = (referenceImages ?? []).filter(Boolean);
  if (referenceImage) refs.unshift(referenceImage);

  // Jeder Versuch baut Request-Body und FormData neu auf — Streams sind nicht
  // wiederverwendbar.
  return withProviderRetry(
    "openai",
    async () => {
      let res: Response;
      if (refs.length > 0) {
        const form = new FormData();
        form.append("model", model);
        // Mehrere Referenzbilder: jedes als eigenes `image`-Feld (Array-Semantik).
        refs.forEach((ref, index) => form.append("image", referenceToFile(ref, index)));
        form.append("prompt", prompt);
        form.append("size", size);
        form.append("output_format", outputFmt);
        if (quality) form.append("quality", quality);
        res = await fetch("https://api.openai.com/v1/images/edits", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: form,
        });
      } else {
        res = await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            prompt,
            size,
            output_format: outputFmt,
            ...(quality ? { quality } : {}),
          }),
        });
      }

      const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        throw new ProviderError(classifyProviderResponse("openai", res, payload));
      }

      const base64 = parseOpenAiBase64(payload);
      if (!base64) {
        throw new ProviderError(
          classifyProviderResponse("openai", { status: 502 }, { error: { message: "OpenAI lieferte kein Bild." } }),
        );
      }
      return Buffer.from(base64, "base64");
    },
    { label: `images:${model}` },
  );
}
