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

const requestSchema = z.object({
  initialInput: z.string().trim().min(1).max(2000),
  history: z
    .array(
      z.object({
        question: z.string().trim().min(1).max(400),
        answer: z.string().trim().min(1).max(1200),
      }),
    )
    .max(12)
    .default([]),
  questionCount: z.number().int().min(0).max(12),
});

function getPreferredModel(): string {
  const fromEnv = process.env.ANTHROPIC_MODEL?.trim();
  if (fromEnv) return fromEnv;
  return "claude-3-5-sonnet-latest";
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  const direct = trimmed.match(/\{[\s\S]*\}/);
  if (!direct) return null;
  try {
    return JSON.parse(direct[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const ANTI_GENERIC_MASTER_BLOCK = [
  "Anti-generic master directives (must be reflected in final prompt):",
  "- Force a distinct brand world: include concrete brand-coded visual anchors (packaging details, color accents, serving context, and mood signatures).",
  "- Avoid stock-photo look: no generic crowd-only scenes, no vague backgrounds, no overused ad clichés.",
  "- Lock subject continuity: keep the same person identity and wardrobe logic across perspective variants.",
  "- Require scene specificity: add at least 3 concrete environmental micro-details (surface textures, weather/light traces, venue cues, props).",
  "- Require camera authorship: explicit lens range, camera height/angle, framing intent, and depth-of-field behavior.",
  "- Require tactile realism: skin, fabric, glass, foam, condensation, and ground textures should read physically plausible at close inspection.",
  "- Keep constraints tight and commercial-grade while avoiding repetitive buzzword stuffing.",
].join("\n");

function buildLocalFallbackPrompt(initialInput: string, history: Array<{ question: string; answer: string }>): string {
  const followUps = history
    .map((item) => `- ${item.question}: ${item.answer}`)
    .join("\n");

  return [
    "Create a photorealistic commercial beer campaign image.",
    `Core request: ${initialInput}.`,
    followUps ? `Collected follow-up details:\n${followUps}` : "",
    "Mandatory constraints:",
    "- Hyper-realistic adult humans with natural anatomy and skin texture.",
    "- Preserve subject identity consistency (face, hair, body proportions, wardrobe details).",
    "- Physically plausible environment and water behavior; avoid generic stock-photo backgrounds.",
    "- If pouring is shown: liquid continuity must be physically consistent (bottle volume vs glass fill).",
    "- Premium ad photography: high dynamic range, realistic micro-textures, cinematic color grading.",
    "- Camera/lens, composition, and lighting should be explicit and production-ready.",
    "- Anti-generic lock: avoid stock look by using specific environmental cues, brand-coded styling, and authored camera direction.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function POST(req: Request) {
  try {
    const rateError = await enforceRateLimitPersistent(req, {
      keyPrefix: "claude-hybrid-prompt",
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

    const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
    }

    const { initialInput, history, questionCount } = parsed.data;
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          status: "complete",
          prompt: buildLocalFallbackPrompt(initialInput, history),
          warning: "Claude ist nicht konfiguriert (ANTHROPIC_API_KEY fehlt). Lokaler Fallback wurde verwendet.",
        },
        { status: 200 },
      );
    }

    const anthropic = new Anthropic({ apiKey });
    const requiredFields = [
      "bildtyp",
      "biertyp",
      "behaelter",
      "markenname",
      "zielgruppe",
      "plattform",
      "stimmung",
      "etikettModus",
      "personenModus",
      "shotType",
    ] as const;

    const response = await anthropic.messages.create({
      model: getPreferredModel(),
      max_tokens: 900,
      temperature: 0.2,
      system:
        `${DEFAULT_BREWERY_IMAGE_SKILL_SYSTEM_PROMPT}\n\n` +
        "You are an expert brewery image prompt strategist. Reply with JSON only. " +
        'Schema: {"status":"follow_up","question":"...","missingFields":["..."],"collected":{"field":"value"}} OR {"status":"complete","prompt":"...","collected":{"field":"value"}}.' +
        "Follow-up questions must be short, specific, and in German. " +
        "Final prompt must be in English and production-ready for image generation. " +
        "When status=complete, the prompt must be highly detailed (at least 180 words) and include: " +
        "scene setup, product and glass constraints, subject styling, camera/lens, lighting, composition, texture realism, color palette, and quality constraints. " +
        "Avoid short generic prompts. Keep constraints concise and integrated; avoid long repetitive MANDATORY lock blocks.\n\n" +
        ANTI_GENERIC_MASTER_BLOCK,
      messages: [
        {
          role: "user",
          content: [
            "User initial request:",
            initialInput,
            "",
            "Collected follow-up answers:",
            history.length > 0 ? JSON.stringify(history, null, 2) : "[]",
            "",
            `Already asked follow-up questions: ${questionCount}`,
            "",
            `Required fields that MUST be captured before completion: ${requiredFields.join(", ")}`,
            "",
            "Rules:",
            "- Extract all required fields from initialInput + history.",
            "- If at least one required field is missing, return status=follow_up.",
            "- Ask only ONE focused follow-up that can fill one or multiple missing required fields.",
            "- Never ask about fields already present in collected data.",
            "- Include missingFields array in follow_up response.",
            "- Only return complete when all required fields are present.",
            "- If questionCount >= 10 and still missing, ask one final compact multi-field follow-up.",
            "- In complete mode, produce a rich commercial-grade prompt with concrete visual directives, not a short sentence.",
            "- Always include a human realism directive in the final prompt: hyper-realistic adult humans, natural anatomy/proportions, and explicit anti-artifact constraints for faces/hands/skin.",
            "- Always include an environment realism directive for outdoor scenes: physically plausible water behavior, layered background depth, and anti-generic/no-stock-like scenery constraints.",
            "- Always include liquid continuity constraints for pouring scenes: bottle volume and glass fill must be physically consistent (no near-full bottle when glass is nearly full).",
            "- Always enforce the anti-generic master directives: distinctive brand anchors, specific scene details, and authored camera intent.",
            "- If user requests headline/text in the visual, instruct clean negative space and post-production text overlay instead of in-image typography rendering.",
            "",
            "Brand profile context (MUST apply to all outputs):",
            brandProfileContext,
          ].join("\n"),
        },
      ],
    });

    const textBlock = response.content.find((item) => item.type === "text");
    const text = textBlock?.type === "text" ? textBlock.text : "";
    const payload = parseJsonObject(text);

    if (!payload) {
      return NextResponse.json({ status: "complete", prompt: initialInput }, { status: 200 });
    }

    const status = payload.status;
    if (status === "follow_up") {
      const question = typeof payload.question === "string" ? payload.question.trim() : "";
      if (question) return NextResponse.json({ status: "follow_up", question }, { status: 200 });
    }

    const prompt = typeof payload.prompt === "string" ? payload.prompt.trim() : "";
    if (!prompt) {
      return NextResponse.json({ status: "complete", prompt: initialInput }, { status: 200 });
    }
    return NextResponse.json({ status: "complete", prompt }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Hybrid-Prompt konnte nicht verarbeitet werden." }, { status: 500 });
  }
}
