import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { classifyProviderResponse } from "@/lib/ai/providerErrors";
import { logProviderFailure, providerErrorResponse } from "@/lib/ai/providerRequest";
import { consumeTokens, ensureBillingRow, getEffectiveBillingRow } from "@/lib/billing/store";
import { requireActiveSubscription } from "@/lib/billing/access";
import {
  buildBrandProfilePromptContext,
  canUseCampaignWithTextProfile,
  getBrandProfileFromMetadata,
  isBrandProfileComplete,
} from "@/lib/dashboard/brandProfile";
import { enforceRateLimitPersistent, enforceSameOrigin } from "@/lib/security/requestGuards";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import {
  buildCampaignCreativeFromReferencesPrompt,
  buildCampaignCreativePrompt,
} from "@/lib/kie/campaignImagePrompt";
import {
  type ContentCreationPreset,
  MAX_REFERENCE_UPLOADS,
  applyContentPresetPrompt,
  validateImageTypePolicy,
} from "@/lib/image-types/policy";

type GenerateImageBody = {
  prompt: string;
  imageType?: ContentCreationPreset;
  aspectRatio?: string;
  resolution?: "1K" | "2K" | "4K";
  outputFormat?: "png" | "jpg";
  referenceImageUrls?: string[];
  strictLabelMode?: boolean;
  plattform?: string;
  textImLabel?: string;
  campaignMode?: boolean;
  subline?: string;
  cta?: string;
};

const schema = z.object({
  prompt: z.string().trim().min(1).max(40000),
  imageType: z.enum(["hyperreal", "product_cutout", "product_studio", "campaign_social"]),
  aspectRatio: z
    .enum(["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9", "auto"])
    .optional(),
  resolution: z.enum(["1K", "2K", "4K"]).optional(),
  outputFormat: z.enum(["png", "jpg"]).optional(),
  referenceImageUrls: z.array(z.string().max(12_000_000)).max(MAX_REFERENCE_UPLOADS).optional(),
  strictLabelMode: z.boolean().optional(),
  plattform: z.string().optional(),
  textImLabel: z.string().optional(),
  campaignMode: z.boolean().optional(),
  subline: z.string().trim().max(800).optional(),
  cta: z.string().trim().max(400).optional(),
});

const MAX_OPENAI_PROMPT_CHARS = 12_000;

function mapAspectRatioToOpenAiSize(aspectRatio: string | undefined): "1024x1024" | "1024x1536" | "1536x1024" {
  if (!aspectRatio) return "1024x1024";
  if (["9:16", "4:5", "3:4", "2:3"].includes(aspectRatio)) return "1024x1536";
  if (["16:9", "21:9", "4:3", "3:2", "5:4"].includes(aspectRatio)) return "1536x1024";
  return "1024x1024";
}

function toOpenAiOutputFormat(format: "png" | "jpg" | undefined): "png" | "jpeg" {
  return format === "jpg" ? "jpeg" : "png";
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

function base64DataUrlToFile(dataUrl: string, fileName: string): File {
  const match = dataUrl.match(/^data:(.+?);base64,(.+)$/);
  if (!match) {
    throw new Error("Referenzbild ist kein gueltiges Base64-Data-URL.");
  }
  const mimeType = match[1] || "image/png";
  const buffer = Buffer.from(match[2] || "", "base64");
  return new File([buffer], fileName, { type: mimeType });
}

async function uploadBase64ToKie(apiKey: string, base64Data: string, format: "png" | "jpg"): Promise<string> {
  const uploadRes = await fetch("https://kieai.redpandaai.co/api/file-base64-upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      base64Data: `data:image/${format === "jpg" ? "jpeg" : "png"};base64,${base64Data}`,
      uploadPath: "evglab/generated-images",
      fileName: `chatgpt-image2-${Date.now()}.${format === "jpg" ? "jpg" : "png"}`,
    }),
  });
  const uploadPayload = (await uploadRes.json()) as Record<string, unknown>;
  if (!uploadRes.ok) {
    throw new Error(
      (uploadPayload.msg as string | undefined) ||
        (uploadPayload.error as string | undefined) ||
        "Upload der Bilddatei fehlgeschlagen.",
    );
  }
  const candidates = [
    uploadPayload.fileUrl,
    uploadPayload.url,
    uploadPayload.downloadUrl,
    (uploadPayload.data as Record<string, unknown> | undefined)?.fileUrl,
    (uploadPayload.data as Record<string, unknown> | undefined)?.url,
  ];
  const url = candidates.find((item) => typeof item === "string" && /^https?:\/\//i.test(item as string));
  if (typeof url !== "string") {
    throw new Error("Upload lieferte keine gueltige Datei-URL.");
  }
  return url;
}

export async function POST(req: Request) {
  try {
    const rateError = await enforceRateLimitPersistent(req, {
      keyPrefix: "openai-image2-generate",
      limit: 12,
      windowMs: 60_000,
    });
    if (rateError) return rateError;
    const originError = enforceSameOrigin(req);
    if (originError) return originError;

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const detail = firstIssue ? `${firstIssue.path.join(".")}: ${firstIssue.message}` : "Payload validation failed.";
      return NextResponse.json({ error: `Ungueltige Anfrage. ${detail}` }, { status: 400 });
    }
    const body = parsed.data as GenerateImageBody;

    const headline = (body.textImLabel ?? "").trim();
    const violation = validateImageTypePolicy({
      preset: body.imageType ?? "hyperreal",
      engine: "chatgpt_image2",
      referenceImageCount: body.referenceImageUrls?.length ?? 0,
      campaignMode: body.campaignMode,
    });
    if (violation) {
      return NextResponse.json({ error: violation.message, code: violation.code }, { status: 400 });
    }

    const openAiKey = process.env.OPENAI_API_KEY?.trim();
    if (!openAiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY fehlt." }, { status: 500 });
    }
    const kieKey = process.env.KIE_API_KEY?.trim();
    if (!kieKey) {
      return NextResponse.json({ error: "KIE_API_KEY fehlt fuers Speichern der Bilddatei." }, { status: 500 });
    }

    let userId: string | null = null;
    let currentUserMetadata: Record<string, unknown> = {};
    let brandContext = "";
    if (isSupabaseConfigured()) {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json({ error: "Nicht angemeldet.", code: "auth_required" }, { status: 401 });
      }
      userId = user.id;
      currentUserMetadata = (user.user_metadata as Record<string, unknown> | null) ?? {};
      const profile = getBrandProfileFromMetadata(user.user_metadata);
      if (!isBrandProfileComplete(profile)) {
        return NextResponse.json(
          {
            error:
              "Bitte lege zuerst dein Markenprofil an: Öffne im Dashboard den Bereich „Markenprofil“ und gib deine Website ein — oder wähle dort „Ohne Markenprofil“.",
            code: "brand_profile_incomplete",
          },
          { status: 400 },
        );
      }
      if ((body.imageType === "campaign_social" || body.campaignMode) && !canUseCampaignWithTextProfile(profile)) {
        return NextResponse.json(
          {
            error:
              "Kampagnenbild mit Text ist nur mit aktivem Markenprofil möglich. Lege es im Dashboard unter „Markenprofil“ an — ein Website-Link genügt.",
            code: "campaign_requires_guided_brand_profile",
          },
          { status: 400 },
        );
      }
      brandContext = buildBrandProfilePromptContext(profile);
    }

    if (!userId) {
      return NextResponse.json({ error: "Nicht angemeldet.", code: "auth_required" }, { status: 401 });
    }

    const subscriptionError = await requireActiveSubscription(userId);
    if (subscriptionError) return subscriptionError;

    await ensureBillingRow(userId);
    const currentState = await getEffectiveBillingRow(userId);

    const hasReferenceImage = Boolean(body.referenceImageUrls?.length);
    const usedModelLabel = hasReferenceImage ? "gpt-image-2-image-to-image" : "gpt-image-2-text-to-image";
    const baseCost = body.resolution === "4K" ? 35 : body.resolution === "2K" ? 20 : 10;
    const tokenCost = baseCost + (hasReferenceImage ? 5 : 0) + (body.strictLabelMode ? 10 : 0);
    const remainingTokens = Math.max((currentState?.monthly_tokens ?? 0) - (currentState?.used_tokens ?? 0), 0);
    if (remainingTokens < tokenCost) {
      return NextResponse.json(
        { error: `Nicht genug Tokens. Benoetigt: ${tokenCost}, verfuegbar: ${remainingTokens}.` },
        { status: 402 },
      );
    }

    const model =
      process.env.KIE_CHATGPT_IMAGE2_TEXT_MODEL?.trim() ||
      process.env.OPENAI_IMAGE_MODEL?.trim() ||
      "gpt-image-1";
    const scenePrompt = body.prompt.trim();
    const subTrim = (body.subline ?? "").trim();
    const ctaTrim = (body.cta ?? "").trim();
    const imageLedCampaign =
      body.campaignMode === true &&
      hasReferenceImage &&
      !headline &&
      !subTrim &&
      !ctaTrim;
    const creativeCore =
      body.campaignMode === true
        ? imageLedCampaign
          ? buildCampaignCreativeFromReferencesPrompt(scenePrompt)
          : buildCampaignCreativePrompt(scenePrompt, headline, subTrim, ctaTrim)
        : scenePrompt;
    const policyPrompt = applyContentPresetPrompt(creativeCore, body.imageType ?? "hyperreal");
    const promptRaw = [policyPrompt, "", brandContext].filter(Boolean).join("\n");
    const prompt = promptRaw.length > MAX_OPENAI_PROMPT_CHARS ? promptRaw.slice(0, MAX_OPENAI_PROMPT_CHARS) : promptRaw;
    const openAiRes = hasReferenceImage
      ? await (async () => {
          const firstReference = body.referenceImageUrls?.[0];
          if (!firstReference) {
            throw new Error("Referenzbild fehlt.");
          }
          const imageFile = base64DataUrlToFile(firstReference, "reference.png");
          const formData = new FormData();
          formData.append("model", model);
          formData.append("image", imageFile);
          formData.append("prompt", prompt);
          formData.append("size", mapAspectRatioToOpenAiSize(body.aspectRatio));
          formData.append("output_format", toOpenAiOutputFormat(body.outputFormat));
          formData.append("response_format", "b64_json");
          return fetch("https://api.openai.com/v1/images/edits", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${openAiKey}`,
            },
            body: formData,
          });
        })()
      : await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openAiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            prompt,
            size: mapAspectRatioToOpenAiSize(body.aspectRatio),
            output_format: toOpenAiOutputFormat(body.outputFormat),
            response_format: "b64_json",
          }),
        });
    const openAiPayload = (await openAiRes.json()) as Record<string, unknown>;
    if (!openAiRes.ok) {
      // Kein Token-Abzug: `consumeTokens` laeuft erst nach erfolgreichem Bild.
      const classified = classifyProviderResponse("openai", openAiRes, openAiPayload);
      logProviderFailure(classified, { label: "openai-image2-generate", userId });
      return providerErrorResponse(classified);
    }
    const base64Image = parseOpenAiBase64(openAiPayload);
    if (!base64Image) {
      return NextResponse.json({ error: "OpenAI lieferte kein Bild." }, { status: 502 });
    }

    const imageUrl = await uploadBase64ToKie(kieKey, base64Image, body.outputFormat ?? "png");

    const consumeResult = await consumeTokens(userId, tokenCost);
    if (!consumeResult.ok) {
      return NextResponse.json({ error: consumeResult.error }, { status: 402 });
    }

    return NextResponse.json({
      generationId: `openai-${randomUUID()}`,
      imageUrl,
      usedModel: usedModelLabel,
      billing: {
        plan: consumeResult.state.plan,
        monthlyTokens: consumeResult.state.monthly_tokens,
        usedTokens: consumeResult.state.used_tokens,
        remainingTokens: Math.max(consumeResult.state.monthly_tokens - consumeResult.state.used_tokens, 0),
        consumed: tokenCost,
      },
    });
  } catch {
    return NextResponse.json({ error: "ChatGPT Image 2 Generierung fehlgeschlagen." }, { status: 500 });
  }
}
