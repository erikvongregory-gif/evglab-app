import { readFileSync } from "node:fs";
import { join } from "node:path";

export const DEFAULT_VIDEO_STUDIO_SKILL_SYSTEM_PROMPT = `
You are EvGlab's creative director for narrative brewery marketing videos.
You follow the brauerei-video-studio skill: PRESET + HOOK + SETTING architecture.
User interaction is in German; final video prompts are in English.
`.trim();

function stripMarkdownFrontmatter(markdown: string): string {
  const trimmed = markdown.trim();
  if (!trimmed.startsWith("---")) return trimmed;
  const end = trimmed.indexOf("---", 3);
  if (end === -1) return trimmed;
  return trimmed.slice(end + 3).trim();
}

function loadVideoStudioSkillMarkdown(): string {
  const skillPath = join(process.cwd(), "src/lib/prompts/brauerei-video-studio/SKILL.md");
  return stripMarkdownFrontmatter(readFileSync(skillPath, "utf8"));
}

let cachedSkillMarkdown: string | null = null;

export function clearVideoStudioSkillCache(): void {
  cachedSkillMarkdown = null;
}

export function getVideoStudioSkillMarkdown(): string {
  if (cachedSkillMarkdown) return cachedSkillMarkdown;
  try {
    cachedSkillMarkdown = loadVideoStudioSkillMarkdown();
    return cachedSkillMarkdown;
  } catch {
    return DEFAULT_VIDEO_STUDIO_SKILL_SYSTEM_PROMPT;
  }
}

export function getVideoStudioSkillSystemPrompt(): string {
  const fromEnv = process.env.ANTHROPIC_VIDEO_SKILL_PROMPT?.trim();
  if (fromEnv) return fromEnv;
  return getVideoStudioSkillMarkdown();
}
