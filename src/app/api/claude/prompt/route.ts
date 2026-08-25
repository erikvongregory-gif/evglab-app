import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import { classifyThrownProviderError } from "@/lib/ai/providerErrors";
import { logProviderFailure, providerErrorResponse } from "@/lib/ai/providerRequest";
import { generateBrauereiBildPrompt } from "@/lib/prompts/brauerei-bild/generate-prompt";
import { enforceRateLimitPersistent, enforceSameOrigin } from "@/lib/security/requestGuards";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  buildBrandProfilePromptContext,
  getBrandProfileFromMetadata,
  isBrandProfileComplete,
} from "@/lib/dashboard/brandProfile";
import { type ContentCreationPreset, getPresetSystemDirectives } from "@/lib/image-types/policy";

type PromptRequestBody = {
  imageType?: ContentCreationPreset;
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
  imageType: z.enum(["hyperreal", "product_cutout", "product_studio", "campaign_social"]).optional(),
  bildtyp: z.string().trim().max(160).optional(),
  biertyp: z.string().trim().min(1).max(160),
  behaelter: z.string().trim().max(100).optional(),
  flaschenTyp: z.string().trim().max(100).optional(),
  flaschenVolumen: z.string().trim().max(100).optional(),
  markenname: z.string().trim().min(1).max(240),
  zielgruppe: z.string().trim().min(1).max(200),
  plattform: z.string().trim().min(1).max(120),
  stimmung: z.string().trim().min(1).max(200),
  personenModus: z.string().trim().max(160).optional(),
  shotType: z.string().trim().max(160).optional(),
  studioStyle: z.string().trim().max(160).optional(),
  studioProps: z.string().trim().max(600).optional(),
  kiPlattform: z.string().trim().max(120),
  etikettModus: z.string().trim().max(50).optional(),
  referenzStaerke: z.enum(["Niedrig", "Mittel", "Hoch", "Strikt"]).optional(),
  referenzen: z.string().trim().max(1200).optional(),
  besondererHintergrund: z.string().trim().max(1200).optional(),
  saisonalerBezug: z.string().trim().max(600).optional(),
  textImLabel: z.string().trim().max(600).optional(),
  vermeiden: z.string().trim().max(1200).optional(),
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

function respondWithAnthropicFailure(error: unknown, label: string) {
  const classified = classifyThrownProviderError("anthropic", error);
  logProviderFailure(classified, { label });
  return providerErrorResponse(classified);
}

function buildClaudeInput(body: PromptRequestBody): string {
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

  const presetDirectives = body.imageType ? getPresetSystemDirectives(body.imageType) : "";
  return [
    "Erstelle einen hochwertigen ENGLISCHEN Image-Generation Prompt für eine Brauerei auf Basis dieses Briefings.",
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
    presetDirectives ? `- ${presetDirectives}` : "",
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
            "Bitte lege zuerst dein Markenprofil an: Öffne im Dashboard den Bereich „Markenprofil“ und gib deine Website ein — oder wähle dort „Ohne Markenprofil“.",
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
      const firstIssue = parseResult.error.issues[0];
      const detail = firstIssue ? `${firstIssue.path.join(".")}: ${firstIssue.message}` : "Payload konnte nicht validiert werden.";
      return NextResponse.json({ error: `Ungültige Anfrage. ${detail}` }, { status: 400 });
    }

    const body = parseResult.data as PromptRequestBody;
    const anthropic = new Anthropic({ apiKey });

    let prompt: string;
    try {
      prompt = await generateBrauereiBildPrompt({
        anthropic,
        userMessage: buildClaudeInput(body),
        brandProfileContext,
        maxTokens: 1000,
        temperature: 0.4,
      });
    } catch (lastError) {
      return respondWithAnthropicFailure(lastError, "claude-prompt");
    }

    if (!prompt) {
      return NextResponse.json({ error: "Claude hat keinen Prompt geliefert." }, { status: 502 });
    }

    return NextResponse.json({ prompt });
  } catch (error) {
    return respondWithAnthropicFailure(error, "claude-prompt");
  }
}
