export type OpenAiImageSize = "1024x1024" | "1024x1536" | "1536x1024";
export type OpenAiImageQuality = "low" | "medium" | "high" | "auto";

export type OpenAiReferenceImage = { base64: string; mime: string };

/**
 * Mappt unsere UI-Seitenverhaeltnisse auf die von den GPT-Image-Modellen
 * garantiert unterstuetzten Standardgroessen (quadratisch / hoch / quer).
 */
export function mapAspectRatioToOpenAiSize(aspectRatio: string | undefined): OpenAiImageSize {
  if (!aspectRatio) return "1024x1024";
  if (["9:16", "4:5", "3:4", "2:3"].includes(aspectRatio)) return "1024x1536";
  if (["16:9", "21:9", "3:2", "4:3", "5:4"].includes(aspectRatio)) return "1536x1024";
  return "1024x1024";
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

function referenceToFile(reference: OpenAiReferenceImage): File {
  const buffer = Buffer.from(reference.base64, "base64");
  const mime = reference.mime.toLowerCase().includes("jpeg") ? "image/jpeg" : reference.mime;
  const ext = mime.includes("jpeg") ? "jpg" : mime.includes("webp") ? "webp" : "png";
  return new File([buffer], `reference.${ext}`, { type: mime });
}

/**
 * Erzeugt EIN Bild direkt ueber die OpenAI Images API (gpt-image-2/1).
 * - Mit Referenzbild → `images/edits` (multipart) fuer Etikett-Treue (i2i).
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
}): Promise<Buffer> {
  const { apiKey, model, prompt, size, outputFormat, quality, referenceImage } = args;
  const outputFmt = outputFormat === "jpg" ? "jpeg" : "png";

  let res: Response;
  if (referenceImage) {
    const form = new FormData();
    form.append("model", model);
    form.append("image", referenceToFile(referenceImage));
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
    const message =
      ((payload.error as Record<string, unknown> | undefined)?.message as string | undefined) ||
      `OpenAI Bildgenerierung fehlgeschlagen (HTTP ${res.status}).`;
    throw new Error(message);
  }

  const base64 = parseOpenAiBase64(payload);
  if (!base64) {
    throw new Error("OpenAI lieferte kein Bild.");
  }
  return Buffer.from(base64, "base64");
}
