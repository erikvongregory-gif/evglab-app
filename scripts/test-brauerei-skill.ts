/**
 * Einmaliger Live-Test des brauerei-bild Skills (gleiche Pipeline wie Dashboard).
 * Usage: npx tsx --env-file=.env.local scripts/test-brauerei-skill.ts
 */
import Anthropic from "@anthropic-ai/sdk";
import { generateBrauereiBildPrompt } from "../src/lib/prompts/brauerei-bild/generate-prompt";
import { getBrauereiBildSkillMarkdown } from "../src/lib/prompts/brewerySkill";

const brief = {
  biertyp: "Hefeweizen",
  behaelter: "Nur Glas",
  markenname: "Paulaner",
  zielgruppe: "Der Geniesser",
  plattform: "Instagram Story (9:16)",
  seitenverhaeltnis: "9:16",
  stimmung: "Aktiv/Frisch",
  kiPlattform: "GPT Image 2",
  personenModus: "GRUPPE E1 — Selfie-POV",
  gruppeAnzahl: "4",
  gruppeDynamik: "Selfie-POV, lachend in Kamera, Weizenglaeser gestreckt",
  setting: "Alpine Holzhuette, Berge im Hintergrund",
  shotType: "POV / Selfie-Style",
  etikettModus: "Generisch",
  besondererHintergrund: "Bayerische Alpen, sonniger Nachmittag",
};

const brandProfileContext = [
  "Brand profile lock (MANDATORY):",
  "- Brand/Brewery: Paulaner",
  "- Brand tone: Traditionsreich, bayerisch, gesellig, authentisch",
  "- Brand colors/style cues: Blau-Weiss, warmes Gold, Alpen-Biergarten",
  "- Must include: echte Bierkultur, Genussmomente, keine Stock-Foto-Klischees",
  "- Must avoid: WM-Kampagnen-Look, generische Party-Stockfotos",
].join("\n");

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY fehlt. Bitte in .env.local setzen.");
    process.exit(1);
  }

  const skill = getBrauereiBildSkillMarkdown();
  console.log("--- Skill geladen ---");
  console.log(`Zeichen: ${skill.length} | GRUPPE: ${skill.includes("[E] GRUPPE")} | GPT Image 2: ${skill.includes("platform_gpt_image_2")}`);
  console.log("");

  const userMessage = [
    "Erstelle einen kopierfertigen englischen Bildgenerierungs-Prompt (Dashboard-API-Modus, nur Prompt-Text).",
    "Nutze den Personen-Modus GRUPPE E1 (Selfie-POV) aus dem Skill.",
    "Strukturiertes Briefing (JSON):",
    JSON.stringify(brief, null, 2),
  ].join("\n");

  console.log("--- Claude-Anfrage läuft … ---");
  const started = Date.now();
  const anthropic = new Anthropic({ apiKey });
  const prompt = await generateBrauereiBildPrompt({
    anthropic,
    userMessage,
    brandProfileContext,
    maxTokens: 1400,
    temperature: 0.35,
  });
  const ms = Date.now() - started;

  console.log(`\n--- Ergebnis (${ms} ms) ---\n`);
  console.log(prompt);
  console.log("\n--- Checks ---");
  console.log("Englisch:", !/\b(und|der|die|das|ein|eine)\b/i.test(prompt.slice(0, 120)) ? "ok" : "evtl. Deutsch gemischt");
  console.log("SRM/Hex:", /SRM|#[0-9A-Fa-f]{6}|hex/i.test(prompt) ? "ok" : "fehlt");
  console.log("Weizen-Glas:", /weizen/i.test(prompt) ? "ok" : "fehlt");
  console.log("High-fidelity:", /high-fidelity|ultra-detailed|photorealistic/i.test(prompt) ? "ok" : "fehlt");
  console.log("Negative/Avoid:", /avoid|do not include|exclude/i.test(prompt) ? "ok" : "fehlt");
  console.log("Gruppe/Selfie:", /selfie|group|clink|cheer|POV/i.test(prompt) ? "ok" : "fehlt");
}

main().catch((err) => {
  console.error("Test fehlgeschlagen:", err instanceof Error ? err.message : err);
  process.exit(1);
});
