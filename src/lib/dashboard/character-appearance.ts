import Anthropic from "@anthropic-ai/sdk";
import { createAnthropicMessageWithModelFallback } from "@/lib/anthropic/modelCandidates";
import { resolveReferenceImageForVision } from "@/lib/brand/reference-image-bytes";

/**
 * Higgsfield-Style: Character Sheet / Appearance Lock — kein Face-i2i an OpenAI.
 * Fotos → stabile Textbeschreibung (Slots), die bei jeder Generierung wiederverwendet wird.
 */
export async function buildCharacterAppearanceLock(params: {
  name: string;
  role?: string;
  imageUrls: string[];
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return fallbackLock(params.name, params.role);
  }

  const images = [];
  for (const url of params.imageUrls.slice(0, 3)) {
    const resolved = await resolveReferenceImageForVision(url, {});
    if (resolved) images.push(resolved);
  }
  if (!images.length) return fallbackLock(params.name, params.role);

  const anthropic = new Anthropic({ apiKey });
  const label = [params.name.trim(), params.role?.trim()].filter(Boolean).join(", ");
  try {
    const response = await createAnthropicMessageWithModelFallback(anthropic, {
      max_tokens: 280,
      temperature: 0.2,
      system: [
        "You write a compact ENGLISH appearance lock for brewery lifestyle image prompts.",
        "Describe one ORIGINAL adult character inspired by the photos (age band, skin, face shape, hair, build, typical clothing vibe).",
        "Do NOT say real person, likeness, identity, celebrity, or 'same face as photo'.",
        "Do NOT invent a biography. One dense comma-separated paragraph, max 70 words.",
        "Start with: identical original adult character",
      ].join(" "),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Brand spokesperson label: ${label || "brewery adult"}. Build the appearance lock from these reference photos.`,
            },
            ...images.map((img) => ({
              type: "image" as const,
              source: {
                type: "base64" as const,
                media_type: img.mime as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
                data: img.base64,
              },
            })),
          ],
        },
      ],
    });
    const text = response.content.find((b) => b.type === "text");
    const lock = text?.type === "text" ? text.text.trim().replace(/\s+/g, " ") : "";
    if (lock.length >= 40) return lock.slice(0, 600);
  } catch (error) {
    console.warn("[character-appearance] vision lock failed:", error);
  }
  return fallbackLock(params.name, params.role);
}

function fallbackLock(name: string, role?: string): string {
  const label = [name.trim(), role?.trim()].filter(Boolean).join(", ");
  return `identical original adult character (${label || "brewery spokesperson"}), natural face, mature bone structure, authentic brewery lifestyle look, unretouched skin texture`;
}
