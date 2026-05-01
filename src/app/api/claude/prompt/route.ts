import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import { DEFAULT_BREWERY_IMAGE_SKILL_SYSTEM_PROMPT } from "@/lib/prompts/brewerySkill";
import { enforceRateLimitPersistent, enforceSameOrigin } from "@/lib/security/requestGuards";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  buildBrandProfilePromptContext,
  getBrandProfileFromMetadata,
  isBrandProfileComplete,
} from "@/lib/dashboard/brandProfile";

type PromptRequestBody = {
  bildtyp?: string;
  biertyp: string;
  behaelter?: string;
  flaschenTyp?: string;
  flaschenVolumen?: string;
  markenname: string;
  zielgruppe: string;
  plattform: string;
  stimmung: string;
  personenModus?: string;
  shotType?: string;
  studioStyle?: string;
  studioProps?: string;
  kiPlattform: string;
  etikettModus?: string;
  referenzStaerke?: "Niedrig" | "Mittel" | "Hoch" | "Strikt";
  referenzen?: string;
  besondererHintergrund?: string;
  saisonalerBezug?: string;
  textImLabel?: string;
  vermeiden?: string;
  personGeschlecht?: "Frau" | "Mann" | "Egal";
};

const promptRequestSchema = z.object({
  bildtyp: z.string().trim().max(80).optional(),
  biertyp: z.string().trim().min(1).max(80),
  behaelter: z.string().trim().max(50).optional(),
  flaschenTyp: z.string().trim().max(50).optional(),
  flaschenVolumen: z.string().trim().max(50).optional(),
  markenname: z.string().trim().min(1).max(120),
  zielgruppe: z.string().trim().min(1).max(80),
  plattform: z.string().trim().min(1).max(80),
  stimmung: z.string().trim().min(1).max(80),
  personenModus: z.string().trim().max(80).optional(),
  shotType: z.string().trim().max(80).optional(),
  studioStyle: z.string().trim().max(80).optional(),
  studioProps: z.string().trim().max(240).optional(),
  kiPlattform: z.string().trim().max(80),
  etikettModus: z.string().trim().max(50).optional(),
  referenzStaerke: z.enum(["Niedrig", "Mittel", "Hoch", "Strikt"]).optional(),
  referenzen: z.string().trim().max(500).optional(),
  besondererHintergrund: z.string().trim().max(500).optional(),
  saisonalerBezug: z.string().trim().max(240).optional(),
  textImLabel: z.string().trim().max(240).optional(),
  vermeiden: z.string().trim().max(500).optional(),
  personGeschlecht: z.enum(["Frau", "Mann", "Egal"]).optional(),
});

function getStrictGlassRule(biertyp: string): string {
  const beer = biertyp.toLowerCase();
  if (/(helles|lager|export|radler|alkoholfrei)/i.test(beer)) {
    return "Mandatory glass constraint: use ONLY a traditional Willibecher glass. NEVER use a Weizen glass.";
  }
  if (/(weizen|weissbier|hefeweizen)/i.test(beer)) {
    return "Mandatory glass constraint: use ONLY a tall curved Weizen glass. NEVER use a Willibecher.";
  }
  if (/(pils|pilsner)/i.test(beer)) {
    return "Mandatory glass constraint: use ONLY a tall slender Pilsner flute. NEVER use a Weizen glass.";
  }
  return "Mandatory glass constraint: use the beer-style-correct glass only. Never substitute with a Weizen glass unless beer style is Weizen.";
}

function getClaudeSystemPrompt(): string {
  const fromEnv = process.env.ANTHROPIC_SKILL_PROMPT?.trim();
  return fromEnv || DEFAULT_BREWERY_IMAGE_SKILL_SYSTEM_PROMPT;
}

function getPreferredModel(): string {
  const fromEnv = process.env.ANTHROPIC_MODEL?.trim();
  if (fromEnv) return fromEnv;
  // Stable default alias from Anthropic docs; avoids brittle hard-coded snapshot names.
  return "claude-3-5-sonnet-latest";
}

function classifyAnthropicError(message: string) {
  const lower = message.toLowerCase();
  if (/credit balance|billing|insufficient|payment/.test(lower)) {
    return { code: "CLAUDE_BILLING", error: "Anthropic-Guthaben ist zu niedrig.", status: 402 };
  }
  if (/api key|authentication|unauthorized|forbidden|permission/.test(lower)) {
    return { code: "CLAUDE_AUTH", error: "Anthropic-Authentifizierung fehlgeschlagen.", status: 401 };
  }
  if (/rate limit|too many requests|429/.test(lower)) {
    return { code: "CLAUDE_RATE_LIMIT", error: "Anthropic-Rate-Limit erreicht. Bitte kurz warten.", status: 429 };
  }
  if (/model|not found/.test(lower)) {
    return { code: "CLAUDE_MODEL", error: "Anthropic-Modellzugriff nicht verfügbar.", status: 502 };
  }
  return { code: "CLAUDE_UNKNOWN", error: "Claude-Anfrage fehlgeschlagen.", status: 500 };
}

function buildClaudeInput(body: PromptRequestBody, brandProfileContext: string): string {
  const strictGlassRule = getStrictGlassRule(body.biertyp ?? "");
  const containerRule =
    body.behaelter === "Nur Flasche"
      ? "Container constraint: show only bottle/can, no poured glass visible."
      : body.behaelter === "Nur Glas"
        ? "Container constraint: show only glass, no bottle/can visible."
        : "Container constraint: if both bottle and glass are shown, keep realistic scale and matching style.";

  const effectiveReferenceStrength =
    body.etikettModus === "Ja, Etikett 1:1"
      ? "Strikt"
      : (body.referenzStaerke ?? "Mittel");
  const referenceStrengthRule =
    effectiveReferenceStrength === "Strikt"
      ? "Reference adherence: STRICT. Prioritize exact branding fidelity to the reference (logo placement, typography proportions, color blocks). Avoid any stylized drift."
      : effectiveReferenceStrength === "Hoch"
        ? "Reference adherence: HIGH. Keep visual identity and label style very close to the reference."
        : effectiveReferenceStrength === "Niedrig"
          ? "Reference adherence: LOW. Use reference mainly for overall mood and palette."
          : "Reference adherence: MEDIUM. Follow key elements from reference while keeping room for adaptation.";
  const labelFidelityRule =
    body.etikettModus === "Ja, Etikett 1:1"
      ? "Label fidelity (NON-NEGOTIABLE): keep the exact bottle/label brand identity from reference. Do not redesign, replace, or substitute branding. Do NOT paste or overlay the reference image itself. Re-render the bottle naturally in-scene. Text must be tack-sharp, front-readable, and non-distorted. No warped, melted, stretched, mirrored, or blurred lettering."
      : "If any label text is rendered, keep it clean and legible.";
  const physicalRealismRule =
    "Physical realism lock: bottle must have plausible real-world scale versus human anatomy and surrounding props; no giant or toy-like proportions. Enforce true scene integration with contact shadows, finger occlusion, grip pressure, and matching light direction/speculars. Absolutely avoid cutout/sticker/composited look.";
  const sceneLockRule =
    body.bildtyp === "Produkt-Studio"
      ? "Scene lock: enforce controlled studio product setup with neutral backdrop, clear product hierarchy, and no location storytelling."
      : body.bildtyp === "Biergarten/Genussmoment"
        ? "Scene lock: enforce outdoor beer-garden enjoyment context with social table cues and warm natural ambiance."
        : body.bildtyp === "Gastro-Serviermoment"
          ? "Scene lock: enforce active gastronomy serving action (pour/handoff/serving gesture) with realistic bar/table context."
          : body.bildtyp === "Event/Promotion"
            ? "Scene lock: enforce campaign-ready composition with copy-space, focal hierarchy, and promotional visual energy."
            : body.bildtyp === "Food-Pairing"
              ? "Scene lock: enforce visible food pairing element with appetizing plated dish and coherent dining context."
              : body.bildtyp === "Makro/Detail"
                ? "Scene lock: enforce true macro-detail optics with close-up texture focus, optical falloff, and material realism."
                : "Scene lock: enforce authentic lifestyle context with believable human/product interaction.";

  return [
    "Erstelle einen hochwertigen ENGLISCHEN Image-Generation Prompt für eine Brauerei auf Basis dieses Briefings.",
    "",
    brandProfileContext,
    "",
    "Nutze die folgenden Briefing-Daten:",
    JSON.stringify(body, null, 2),
    "",
    "Regeln:",
    "- Gib NUR den finalen Prompt als reinen Text aus (kein Markdown, keine Erklärung).",
    "- Der Prompt soll fotorealistisch und werblich nutzbar sein.",
    "- Baue Biertyp, Stimmung, Plattform, Licht, Kamera/Linse und Kompositionshinweise ein.",
    "- Wenn Label-Text angegeben ist, integriere ihn klar lesbar.",
    "- Wenn 'vermeiden' gesetzt ist, berücksichtige es im Prompt.",
    "- Wenn personGeschlecht 'Frau' oder 'Mann' ist (und Menschen vorgesehen sind), muss der englische Prompt das Geschlecht der dargestellten Person(en) klar und konsistent festlegen (nur Erwachsene, keine widersprüchliche Darstellung).",
    `- ${referenceStrengthRule}`,
    `- ${labelFidelityRule}`,
    `- ${physicalRealismRule}`,
    `- ${sceneLockRule}`,
    `- ${strictGlassRule}`,
    `- ${containerRule}`,
  ].join("\n");
}

export async function POST(req: Request) {
  try {
    const rateError = await enforceRateLimitPersistent(req, {
      keyPrefix: "claude-prompt",
      limit: 20,
      windowMs: 60_000,
    });
    if (rateError) return rateError;
    const originError = enforceSameOrigin(req);
    if (originError) return originError;
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase-Konfiguration fehlt." }, { status: 500 });
    }
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
    }
    const brandProfile = getBrandProfileFromMetadata(user.user_metadata);
    if (!isBrandProfileComplete(brandProfile)) {
      return NextResponse.json(
        {
          error:
            "Bitte zuerst dein Markenprofil in den Einstellungen vollständig ausfüllen (Tonalität, Farben, Do/Don'ts und mindestens 1 Referenzbild-URL).",
          code: "brand_profile_incomplete",
        },
        { status: 400 },
      );
    }
    const brandProfileContext = buildBrandProfilePromptContext(brandProfile);

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY fehlt." }, { status: 500 });
    }

    const parseResult = promptRequestSchema.safeParse(await req.json());
    if (!parseResult.success) {
      return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
    }

    const body = parseResult.data as PromptRequestBody;
    const anthropic = new Anthropic({ apiKey });
    const modelCandidates = Array.from(
      new Set([
        getPreferredModel(),
        "claude-3-5-sonnet-latest",
        "claude-3-5-haiku-latest",
      ]),
    );

    let response: Awaited<ReturnType<typeof anthropic.messages.create>> | null = null;
    let lastError: unknown = null;
    for (const model of modelCandidates) {
      try {
        response = await anthropic.messages.create({
          model,
          max_tokens: 1000,
          temperature: 0.4,
          system: getClaudeSystemPrompt(),
          messages: [
            {
              role: "user",
              content: buildClaudeInput(body, brandProfileContext),
            },
          ],
        });
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!response) {
      const msg = lastError instanceof Error ? lastError.message : "Claude-Model konnte nicht geladen werden.";
      const classified = classifyAnthropicError(msg);
      return NextResponse.json(
        {
          error: classified.error,
          code: classified.code,
        },
        { status: classified.status },
      );
    }

    const textBlock = response.content.find((item) => item.type === "text");
    const promptRaw = textBlock?.type === "text" ? textBlock.text.trim() : "";
    const prompt = promptRaw.replace(/^```[a-zA-Z]*\s*/g, "").replace(/```$/g, "").trim();

    if (!prompt) {
      return NextResponse.json({ error: "Claude hat keinen Prompt geliefert." }, { status: 502 });
    }

    return NextResponse.json({ prompt });
  } catch (error) {
    console.error("Claude API error");
    const message = error instanceof Error ? error.message : "";
    const classified = classifyAnthropicError(message);
    return NextResponse.json(
      {
        error: classified.error,
        code: classified.code,
      },
      { status: classified.status },
    );
  }
}
