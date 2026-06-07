import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getBreweryImageSkillSystemPrompt } from "@/lib/prompts/brewerySkill";
import { createAnthropicMessageWithModelFallback } from "@/lib/anthropic/modelCandidates";
import { enforceRateLimitPersistent, enforceSameOrigin } from "@/lib/security/requestGuards";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  buildBrandProfilePromptContext,
  getBrandProfileFromMetadata,
  isBrandProfileComplete,
} from "@/lib/dashboard/brandProfile";
import {
  type ContentCreationPreset,
  getPresetSystemDirectives,
  getRequiredFieldsByPreset,
} from "@/lib/image-types/policy";

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
  preset: z.enum(["hyperreal", "product_cutout", "product_studio", "campaign_social"]).optional().default("hyperreal"),
});

const MIN_FOLLOW_UPS_BEFORE_COMPLETE = 2;
type HybridPreset = ContentCreationPreset;

const ENGLISH_FINALIZE_SYSTEM = [
  "You prepare the final text for an English-only image generation model.",
  "Output ONLY fluent English prose: one cohesive image prompt, no headings, no bullet lists, no JSON, no quotes around the whole text.",
  "Translate every German (or other non-English) phrase into natural English.",
  "Keep proper nouns as real names when they are brand, beer, or place names; do not leave explanatory German around them.",
  "Preserve all creative and technical detail from the draft; do not drop constraints.",
].join(" ");

async function finalizeEnglishOnlyPrompt(
  client: Anthropic,
  draft: string,
  brandProfileContext: string,
): Promise<string> {
  const trimmed = draft.trim();
  if (!trimmed) return trimmed;
  const response = await createAnthropicMessageWithModelFallback(client, {
    max_tokens: 2048,
    temperature: 0.15,
    system:
      ENGLISH_FINALIZE_SYSTEM +
      (brandProfileContext
        ? `\n\nBrand profile constraints (integrate in English; translate any non-English source):\n${brandProfileContext}`
        : ""),
    messages: [
      {
        role: "user",
        content: `Rewrite into one polished English-only image generation prompt. Input may mix languages — output must not.\n\n---\n${trimmed}\n---`,
      },
    ],
  });
  const textBlock = response.content.find((item) => item.type === "text");
  const out = textBlock?.type === "text" ? textBlock.text.trim() : "";
  return out || trimmed;
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

function buildCollectedBrief(initialInput: string, history: Array<{ question: string; answer: string }>): string {
  const items = [
    `Initial request: ${initialInput.trim()}`,
    ...history
      .map((item) => `${item.question.trim()}: ${item.answer.trim()}`)
      .filter((line) => line.length > 0),
  ];
  return items.join(" | ");
}

function buildHyperrealMasterPrompt(
  initialInput: string,
  history: Array<{ question: string; answer: string }>,
  draftPrompt?: string,
): string {
  const collectedBrief = buildCollectedBrief(initialInput, history);
  const draft = draftPrompt?.trim();
  const authoredDirectives = draft ? `Additional authored directives to preserve: ${draft}` : "";
  return [
    "Create a hyper-realistic commercial beer campaign photograph that is indistinguishable from a real camera capture.",
    "The scene must depict real-world context only, with physically plausible lighting, reflections, shadows, and material response.",
    "Render all people as clearly adult humans with natural anatomy, realistic proportions, and true skin detail (pores, subtle blemishes, under-eye texture, realistic lips and ears).",
    "Hands and faces must be artifact-free: no extra fingers, no fused fingers, no warped teeth, no uncanny asymmetry.",
    "Use premium ad-photography direction: cinematic color grading, realistic micro-textures, authored composition, and explicit camera intent.",
    "Define camera and lighting concretely (lens choice, angle, depth behavior, key/fill/rim logic) and keep the shot production-ready.",
    "Keep at least one hero bottle in crisp focus with fully legible label typography and undistorted branding geometry.",
    "If pouring is shown, enforce liquid continuity: bottle fill level, poured volume, foam growth, and final glass level must be physically consistent.",
    "Avoid stock-photo genericity by including specific environmental cues, concrete surface details, believable urban or venue texture, and brand-coded styling anchors.",
    "Strictly forbid illustration, cartoon, painting, CGI, 3D render aesthetics, and synthetic AI-art styling.",
    "Client intent to fulfill exactly (translate and refine internally into polished production English):",
    collectedBrief,
    authoredDirectives,
    "Negative constraints: no waxy plastic skin, no malformed hands, no duplicate limbs, no mirrored or gibberish label text, no stretched typography, no synthetic flat liquid behavior.",
  ]
    .filter(Boolean)
    .join(" ");
}

function buildLocalFallbackPrompt(
  initialInput: string,
  history: Array<{ question: string; answer: string }>,
  preset: HybridPreset,
): string {
  const followUps = history
    .map((item) => `- ${item.question}: ${item.answer}`)
    .join("\n");

  if (preset === "product_cutout") {
    return [
      "Create a single premium e-commerce product cutout image.",
      `Core request: ${initialInput}.`,
      followUps ? `Collected follow-up details:\n${followUps}` : "",
      "Mandatory constraints:",
      "- True transparent alpha background only (no visible background scene).",
      "- Exactly one centered product with complete silhouette and clean contour extraction.",
      "- No environment, no props, no people, no text overlays, no decorative objects.",
      "- Preserve brand and label authenticity with fully readable text and undistorted geometry.",
      "- Edge quality must be clean and production-ready: no halo, no fringing, no jagged border artifacts.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (preset === "product_studio") {
    return [
      "Create a premium controlled studio product hero shot for a brewery brand.",
      `Core request: ${initialInput}.`,
      followUps ? `Collected follow-up details:\n${followUps}` : "",
      "Mandatory constraints:",
      "- Commercial-grade studio setup with defined key/fill/rim lighting and controlled reflections.",
      "- Hero product in tack-sharp focus with crystal-clear label readability.",
      "- Designed studio background with tasteful color/texture control and depth separation.",
      "- Optional brewery-relevant companion elements (hops, barley, citrus, herbs) arranged intentionally with no clutter.",
      "- No people and no random lifestyle environment.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (preset === "campaign_social") {
    return [
      "Create a premium Instagram campaign visual with baked-in text hierarchy.",
      `Core request: ${initialInput}.`,
      followUps ? `Collected follow-up details:\n${followUps}` : "",
      "Mandatory constraints:",
      "- Headline is dominant and high-contrast; subline is supporting; CTA is concise and clearly readable.",
      "- Composition must preserve clean copy zones and safe margins for mobile feed readability.",
      "- Typography must be coherent and correctly spelled, with no gibberish or warped letters.",
      "- Keep brand colors, product identity, and campaign message tightly aligned.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  return buildHyperrealMasterPrompt(initialInput, history);
}

function toGermanFieldLabel(field: string): string {
  const normalized = field.trim().toLowerCase();
  const labels: Record<string, string> = {
    bildtyp: "Bildtyp",
    biertyp: "Biertyp",
    behaelter: "Behälter (Flasche/Glas)",
    markenname: "Marke/Etikett",
    zielgruppe: "Zielgruppe",
    plattform: "Zielplattform",
    stimmung: "Stimmung",
    shottype: "Kameraperspektive/Shot-Typ",
    motiv: "Motiv",
    headline: "Headline",
    subline_oder_keine: "Subline oder keine",
    cta_oder_keine: "CTA oder keine",
    kampagnenziel: "Kampagnenziel",
    brandfarben: "Brandfarben",
    produkt: "Produkt",
    perspektive: "Perspektive",
    freisteller_spezifikation: "Freisteller-Vorgabe",
    label_anforderung: "Label-Anforderung",
    studio_hintergrund: "Studio-Hintergrund",
    licht_setup: "Licht-Setup",
    komposition: "Komposition",
    props: "Props/Beielemente",
  };
  return labels[normalized] ?? field;
}

function buildFallbackFollowUpQuestion(
  questionCount: number,
  preset: HybridPreset,
  missingFields?: string[],
): string {
  if (preset === "product_cutout") {
    if (questionCount === 0) {
      return "Bitte nenne Produkt (z. B. Flasche/Dose/Glas), Ansicht (frontal/45°/Top) und ob transparentes PNG ohne Hintergrund strikt Pflicht ist.";
    }
    return "Welche Details muessen exakt erhalten bleiben (Labeltext, Farben, Material, Kratzer/Prägung) und was ist strikt verboten (Props, Schatten, Text-Overlays)?";
  }
  if (preset === "product_studio") {
    if (questionCount === 0) {
      return "Welches Studio-Setup willst du konkret: Hintergrundart/Farbe, Lichtstimmung (clean, dramatisch, warm/kuehl) und Hauptperspektive?";
    }
    return "Welche Companion-Elemente sollen neben dem Produkt sichtbar sein (z. B. Hopfen, Gerste, Zitrone), und welche davon sind Pflicht vs. optional?";
  }
  if (preset === "campaign_social") {
    if (questionCount === 0) {
      return "Bitte gib mir die exakten Texte fuer Headline, optionale Subline und CTA sowie den Kampagnenanlass (Angebot/Event/Launch).";
    }
    return "Welche visuelle Tonalitaet soll das Kampagnenmotiv haben (z. B. premium, frisch, festival) und welche Brand-Farben muessen dominant sein?";
  }
  if (Array.isArray(missingFields) && missingFields.length > 0) {
    const mapped = missingFields
      .slice(0, 3)
      .map((field) => toGermanFieldLabel(String(field).trim()))
      .filter(Boolean);
    if (mapped.length > 0) {
      return `Kurz nachgeschärft: Bitte nenne noch ${mapped.join(", ")} konkret, damit ich den Prompt sauber finalisieren kann.`;
    }
  }
  if (questionCount === 0) {
    return "Bitte konkretisiere Motiv, Biertyp/Behälter und Zielplattform (z. B. Instagram Feed, Story oder Website).";
  }
  if (questionCount === 1) {
    return "Welche Stimmung, Zielgruppe und Bildwirkung möchtest du genau (z. B. rustikal, premium, modern, urban)?";
  }
  return "Letzter Feinschliff: Welche konkreten Markenanker (Farben, Etikett-Details, Umfeld/Location) sollen zwingend sichtbar sein?";
}

function buildFallbackFollowUpOptions(
  questionCount: number,
  preset: HybridPreset,
  _missingFields?: string[],
): string[] {
  if (preset === "product_cutout") {
    if (questionCount === 0) {
      return [
        "Flasche frontal, transparentes PNG Pflicht",
        "Dose 45°, transparentes PNG Pflicht",
        "Glas frontal, transparentes PNG Pflicht",
      ];
    }
    return [
      "Label 1:1 behalten, keine Props, keine Overlays",
      "Farbe/Material exakt, nur subtiler Kontaktschatten",
      "Kratzer/Prägung behalten, sonst clean freistellen",
    ];
  }
  if (preset === "product_studio") {
    if (questionCount === 0) {
      return [
        "Dunkles Premium-Setup, Rim-Light, 45° Hero",
        "Helles Clean-Setup, soft key light, frontal",
        "Dramatisch warm, Spot-Hintergrund, low angle",
      ];
    }
    return [
      "Mit Hopfen + Gerste, minimal und sauber",
      "Mit Zitrone + Kondenswasser, frisch-modern",
      "Ohne Props, nur High-End Studio-Look",
    ];
  }
  if (preset === "campaign_social") {
    if (questionCount === 0) {
      return [
        'Headline: "Frisch gezapft am Wochenende" | CTA: "Jetzt entdecken"',
        'Headline: "Sommer im Glas" | CTA: "Jetzt probieren"',
        'Headline: "Neuer Anstich" | CTA: "Mehr erfahren"',
      ];
    }
    return [
      "Premium und dunkel-kontrastreich",
      "Frisch und hell, sommerlich",
      "Eventig und dynamisch, hohe Energie",
    ];
  }
  if (questionCount === 0) {
    return [
      "Instagram Feed, Helles im Willibecher, junge Zielgruppe",
      "Instagram Story, Pils in Flasche+Glas, urban",
      "Website Hero, Weizen im Biergarten, Premium-Look",
    ];
  }
  return [
    "Stimmung: warm, authentisch, golden hour",
    "Stimmung: modern, clean, kontrastreich",
    "Stimmung: rustikal, regional, natuerlich",
  ];
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
            "Bitte vervollständige zuerst dein Markenprofil unter Einstellungen (Abschnitt Markenprofil oben: fünf Instagram-Post-Screenshots mit KI auswerten) oder aktiviere die Nutzung ohne Markenprofil.",
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

    const { initialInput, history, questionCount, preset } = parsed.data;
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

    async function respondComplete(rawPrompt: string, warning?: string) {
      let prompt = rawPrompt.trim();
      if (!prompt) {
        prompt = buildLocalFallbackPrompt(initialInput, history, preset);
      }
      if (preset === "hyperreal") {
        prompt = buildHyperrealMasterPrompt(initialInput, history, prompt);
      }
      if (anthropic) {
        try {
          prompt = await finalizeEnglishOnlyPrompt(anthropic, prompt, brandProfileContext);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "unknown";
          console.error("[hybrid-prompt] English finalize failed:", msg);
        }
      }
      return NextResponse.json(
        warning
          ? { status: "complete" as const, prompt, warning }
          : { status: "complete" as const, prompt },
        { status: 200 },
      );
    }

    if (!apiKey) {
      if (questionCount < MIN_FOLLOW_UPS_BEFORE_COMPLETE) {
        return NextResponse.json(
          {
            status: "follow_up",
            question: buildFallbackFollowUpQuestion(questionCount, preset),
            options: buildFallbackFollowUpOptions(questionCount, preset),
            warning: "Claude ist nicht konfiguriert (ANTHROPIC_API_KEY fehlt). Lokaler Follow-up-Fallback wird verwendet.",
          },
          { status: 200 },
        );
      }
      return NextResponse.json(
        {
          status: "complete",
          prompt: buildLocalFallbackPrompt(initialInput, history, preset),
          warning: "Claude ist nicht konfiguriert (ANTHROPIC_API_KEY fehlt). Lokaler Fallback wurde verwendet.",
        },
        { status: 200 },
      );
    }

    const claude = anthropic as Anthropic;

    const requiredFields = getRequiredFieldsByPreset(preset);

    let response: Anthropic.Messages.Message;
    try {
      response = await createAnthropicMessageWithModelFallback(claude, {
        max_tokens: 900,
        temperature: 0.2,
        system:
          `${getBreweryImageSkillSystemPrompt()}\n\n` +
          "You are an expert brewery image prompt strategist. Reply with JSON only. " +
          'Schema: {"status":"follow_up","question":"...","missingFields":["..."],"collected":{"field":"value"}} OR {"status":"complete","prompt":"...","collected":{"field":"value"}}.' +
          "Follow-up questions must be short, specific, and in German. " +
          "In complete mode, DO NOT paste raw user text; rewrite the intent into a clean authored production prompt. " +
          "When status=complete, the prompt string must be 100% English: fully translate every phrase from the user's German (or other non-English) request and Q&A into natural English. " +
          "Never mix German and English inside the prompt; proper nouns (brand/beer/place names) may stay as names. " +
          `${getPresetSystemDirectives(preset)} ` +
          "Final prompt must be production-ready for image generation. " +
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
              `Selected preset: ${preset}`,
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
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown";
      console.error("[hybrid-prompt] Anthropic call failed:", reason);
      if (questionCount < MIN_FOLLOW_UPS_BEFORE_COMPLETE) {
        return NextResponse.json(
          {
            status: "follow_up",
            question: buildFallbackFollowUpQuestion(questionCount, preset),
            options: buildFallbackFollowUpOptions(questionCount, preset),
            warning: `Claude-Aufruf fehlgeschlagen (${reason}). Lokaler Follow-up-Fallback wird verwendet.`,
          },
          { status: 200 },
        );
      }
      return await respondComplete(
        buildLocalFallbackPrompt(initialInput, history, preset),
        `Claude-Aufruf fehlgeschlagen (${reason}). Lokaler Fallback wurde verwendet.`,
      );
    }

    const textBlock = response.content.find((item) => item.type === "text");
    const text = textBlock?.type === "text" ? textBlock.text : "";
    const payload = parseJsonObject(text);

    if (!payload) {
      if (questionCount < MIN_FOLLOW_UPS_BEFORE_COMPLETE) {
        return NextResponse.json(
          {
            status: "follow_up",
            question: buildFallbackFollowUpQuestion(questionCount, preset),
            options: buildFallbackFollowUpOptions(questionCount, preset),
          },
          { status: 200 },
        );
      }
      return await respondComplete(buildLocalFallbackPrompt(initialInput, history, preset));
    }

    const status = payload.status;
    if (status === "follow_up") {
      const question = typeof payload.question === "string" ? payload.question.trim() : "";
      const missingFields = Array.isArray(payload.missingFields)
        ? payload.missingFields.map((item) => String(item).trim()).filter(Boolean)
        : undefined;
      const fallbackQuestion = buildFallbackFollowUpQuestion(questionCount, preset, missingFields);
      const normalizedQuestion = question || fallbackQuestion;
      if (normalizedQuestion) {
        const parsedOptions = Array.isArray(payload.options)
          ? payload.options.map((item) => String(item).trim()).filter(Boolean).slice(0, 6)
          : [];
        return NextResponse.json(
          {
            status: "follow_up",
            question: normalizedQuestion,
            options: parsedOptions.length > 0 ? parsedOptions : buildFallbackFollowUpOptions(questionCount, preset),
          },
          { status: 200 },
        );
      }
    }
    if (status === "complete" && questionCount < MIN_FOLLOW_UPS_BEFORE_COMPLETE) {
      const missingFields = Array.isArray(payload.missingFields) ? payload.missingFields.map((v) => String(v)) : undefined;
      return NextResponse.json(
        {
          status: "follow_up",
          question: buildFallbackFollowUpQuestion(questionCount, preset, missingFields),
          options: buildFallbackFollowUpOptions(questionCount, preset, missingFields),
        },
        { status: 200 },
      );
    }

    const prompt = typeof payload.prompt === "string" ? payload.prompt.trim() : "";
    return await respondComplete(prompt);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler.";
    console.error("[hybrid-prompt] Request failed:", message);
    return NextResponse.json({ error: `Hybrid-Prompt konnte nicht verarbeitet werden: ${message}` }, { status: 500 });
  }
}
