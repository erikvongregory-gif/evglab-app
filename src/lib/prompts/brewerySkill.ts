import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Kurzer Fallback, falls SKILL.md nicht geladen werden kann. */
export const DEFAULT_BREWERY_IMAGE_SKILL_SYSTEM_PROMPT = `
You are BrewAI's senior creative director for brewery marketing visuals in DACH.
You convert structured German briefing data into one technically precise, production-ready English image prompt.

Hard rules:
- Output ONLY the final English prompt as plain text.
- No markdown, no headings, no explanations, no JSON, no code fences.
- Always assume target model is GPT Image 2 unless briefing specifies otherwise.
- Keep result looking like an unretouched handheld photograph, not a CGI ad.
`.trim();

export const DASHBOARD_PROMPT_OUTPUT_RULES = `
Dashboard-API-Modus (ueberschreibt Schritt 5 Ausgabeformat):
- Gib NUR den finalen englischen Bildprompt als reinen Fliesstext zurueck.
- Kein Markdown, keine Ueberschriften, kein Deutsch, kein Konfigurationsblock.
- Wende Schritte 2–4 intern an (Glas-Mapping, SRM-Farbe, Licht, Kamera, Negative als Prosa am Ende).
- Bei GPT Image 2: beginne mit "Unretouched handheld photograph, Kodak Portra 400.", nutze SRM+Hex im Subject-Block. VERBOTEN als Qualitaets-Trigger: ultra-detailed, professionally retouched, photorealistic commercial product shot.
- Integriere Negative Prompts als "Avoid ... Do not include ... Exclude ..." am Promptende.
`.trim();

function stripMarkdownFrontmatter(markdown: string): string {
  const trimmed = markdown.trim();
  if (!trimmed.startsWith("---")) return trimmed;
  const end = trimmed.indexOf("---", 3);
  if (end === -1) return trimmed;
  return trimmed.slice(end + 3).trim();
}

function loadBrauereiBildSkillMarkdown(): string {
  const skillPath = join(process.cwd(), "src/lib/prompts/brauerei-bild/SKILL.md");
  return stripMarkdownFrontmatter(readFileSync(skillPath, "utf8"));
}

let cachedSkillMarkdown: string | null = null;

export function clearBrauereiBildSkillCache(): void {
  cachedSkillMarkdown = null;
}

export function getBrauereiBildSkillMarkdown(): string {
  if (cachedSkillMarkdown) return cachedSkillMarkdown;
  try {
    cachedSkillMarkdown = loadBrauereiBildSkillMarkdown();
    return cachedSkillMarkdown;
  } catch {
    return DEFAULT_BREWERY_IMAGE_SKILL_SYSTEM_PROMPT;
  }
}

/** Vollstaendiger brauerei-bild Skill fuer Claude System-Prompts. */
export function getBreweryImageSkillSystemPrompt(): string {
  const fromEnv = process.env.ANTHROPIC_SKILL_PROMPT?.trim();
  if (fromEnv) return fromEnv;
  return getBrauereiBildSkillMarkdown();
}

/** System-Prompt fuer Dashboard-APIs: Skill + Plain-Text-Ausgabe. */
export function getDashboardBrauereiBildSystemPrompt(): string {
  return `${getBreweryImageSkillSystemPrompt()}\n\n${DASHBOARD_PROMPT_OUTPUT_RULES}`;
}

export function sanitizeClaudePromptOutput(raw: string): string {
  return raw.replace(/^```[a-zA-Z]*\s*/g, "").replace(/```$/g, "").trim();
}
