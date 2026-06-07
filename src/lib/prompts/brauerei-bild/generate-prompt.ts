import type Anthropic from "@anthropic-ai/sdk";
import { createAnthropicMessageWithModelFallback } from "@/lib/anthropic/modelCandidates";
import type { VisionReferenceImage } from "@/lib/brand/reference-image-bytes";
import {
  getDashboardBrauereiBildSystemPrompt,
  sanitizeClaudePromptOutput,
} from "@/lib/prompts/brewerySkill";

const MAX_VISION_IMAGES = 4;

type ClaudeImageBlock = {
  type: "image";
  source: { type: "base64"; media_type: string; data: string };
};
type ClaudeTextBlock = { type: "text"; text: string };
type ClaudeUserContent = Array<ClaudeImageBlock | ClaudeTextBlock>;

function buildImageBlocks(images?: VisionReferenceImage[]): ClaudeImageBlock[] {
  if (!images?.length) return [];
  const blocks: ClaudeImageBlock[] = [];
  for (const img of images.slice(0, MAX_VISION_IMAGES)) {
    if (!img?.base64 || !img.mime) continue;
    blocks.push({
      type: "image",
      source: { type: "base64", media_type: img.mime, data: img.base64 },
    });
  }
  return blocks;
}

export async function generateBrauereiBildPrompt(params: {
  anthropic: Anthropic;
  userMessage: string;
  brandProfileContext?: string;
  maxTokens?: number;
  temperature?: number;
  referenceImages?: VisionReferenceImage[];
}): Promise<string> {
  const system = getDashboardBrauereiBildSystemPrompt();
  const brandBlock = params.brandProfileContext?.trim()
    ? `\n\nMarkenprofil (PFLICHT beruecksichtigen, ins Englische uebersetzen wo noetig):\n${params.brandProfileContext}`
    : "";

  const imageBlocks = buildImageBlocks(params.referenceImages);
  const content: ClaudeUserContent = [...imageBlocks, { type: "text", text: params.userMessage }];

  const response = await createAnthropicMessageWithModelFallback(params.anthropic, {
    max_tokens: params.maxTokens ?? 1200,
    temperature: params.temperature ?? 0.35,
    system: system + brandBlock,
    messages: [
      { role: "user", content: content as unknown as Anthropic.Messages.MessageParam["content"] },
    ],
  });

  const textBlock = response.content.find((item) => item.type === "text");
  const raw = textBlock?.type === "text" ? textBlock.text : "";
  const prompt = sanitizeClaudePromptOutput(raw);
  if (!prompt) {
    throw new Error("Claude hat keinen Prompt geliefert.");
  }
  return prompt;
}
