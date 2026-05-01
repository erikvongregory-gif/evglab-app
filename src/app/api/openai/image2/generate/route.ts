import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { consumeTokens, ensureBillingRow, getBillingRow } from "@/lib/billing/store";
import {
  buildBrandProfilePromptContext,
  getBrandProfileFromMetadata,
  isBrandProfileComplete,
} from "@/lib/dashboard/brandProfile";
import { enforceRateLimitPersistent, enforceSameOrigin } from "@/lib/security/requestGuards";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { buildCampaignCreativePrompt } from "@/lib/kie/campaignImagePrompt";

type GenerateImageBody = {
  prompt: string;
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
  prompt: z.string().trim().min(1).max(12000),
  aspectRatio: z
    .enum(["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9", "auto"])
    .optional(),
  resolution: z.enum(["1K", "2K", "4K"]).optional(),
  outputFormat: z.enum(["png", "jpg"]).optional(),
  referenceImageUrls: z.array(z.string().max(12_000_000)).max(2).optional(),
  strictLabelMode: z.boolean().optional(),
  plattform: z.string().optional(),
  textImLabel: z.string().optional(),
  campaignMode: z.boolean().optional(),
  subline: z.string().trim().max(800).optional(),
  cta: z.string().trim().max(400).optional(),
});

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
      return NextResponse.json({ error: "Ungueltige Anfrage." }, { status: 400 });
    }
    const body = parsed.data as GenerateImageBody;

    const headline = (body.textImLabel ?? "").trim();
    const isInstagramTextCase = body.plattform === "Instagram Post" && headline.length > 0;
    if (!isInstagramTextCase) {
      return NextResponse.json(
        {
          error:
            body.campaignMode === true
              ? "Fuer Kampagnenbilder bitte Plattform Instagram Post und eine Headline angeben."
              : "ChatGPT Image 2 ist nur fuer textbasierte Instagram-Posts mit Headline freigegeben.",
        },
        { status: 400 },
      );
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
    let freeTrialUsed = false;
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
      freeTrialUsed = Boolean(user.user_metadata?.free_trial_image_used_at);
      const profile = getBrandProfileFromMetadata(user.user_metadata);
      if (!isBrandProfileComplete(profile)) {
        return NextResponse.json(
          { error: "Bitte zuerst dein Markenprofil vollständig ausfüllen.", code: "brand_profile_incomplete" },
          { status: 400 },
        );
      }
      brandContext = buildBrandProfilePromptContext(profile);
    }

    if (!userId) {
      return NextResponse.json({ error: "Nicht angemeldet.", code: "auth_required" }, { status: 401 });
    }

    await ensureBillingRow(userId);
    const currentState = await getBillingRow(userId);
    const hasActiveSubscription = Boolean(
      currentState?.plan &&
        currentState.monthly_tokens > 0 &&
        currentState.subscription_status !== "none" &&
        currentState.subscription_status !== "canceled",
    );
    const isFreeTrialRequest = !hasActiveSubscription;
    if (isFreeTrialRequest && freeTrialUsed) {
      return NextResponse.json(
        { error: "Dein kostenloses Bild wurde bereits genutzt. Bitte Abo aktivieren, um weiter zu generieren." },
        { status: 402 },
      );
    }

    const hasReferenceImage = Boolean(body.referenceImageUrls?.length);
    const baseCost = body.resolution === "4K" ? 35 : body.resolution === "2K" ? 20 : 10;
    const tokenCost = baseCost + (hasReferenceImage ? 5 : 0) + (body.strictLabelMode ? 10 : 0);
    if (!isFreeTrialRequest) {
      const remainingTokens = Math.max((currentState?.monthly_tokens ?? 0) - (currentState?.used_tokens ?? 0), 0);
      if (remainingTokens < tokenCost) {
        return NextResponse.json(
          { error: `Nicht genug Tokens. Benoetigt: ${tokenCost}, verfuegbar: ${remainingTokens}.` },
          { status: 402 },
        );
      }
    }

    const model = process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-1";
    const scenePrompt = body.prompt.trim();
    const creativeCore =
      body.campaignMode === true
        ? buildCampaignCreativePrompt(scenePrompt, headline, body.subline ?? "", body.cta ?? "")
        : scenePrompt;
    const prompt = [creativeCore, "", brandContext].filter(Boolean).join("\n");
    const openAiRes = await fetch("https://api.openai.com/v1/images/generations", {
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
      const errorMessage =
        ((openAiPayload.error as Record<string, unknown> | undefined)?.message as string | undefined) ||
        "OpenAI Bildgenerierung fehlgeschlagen.";
      return NextResponse.json({ error: errorMessage }, { status: openAiRes.status });
    }
    const base64Image = parseOpenAiBase64(openAiPayload);
    if (!base64Image) {
      return NextResponse.json({ error: "OpenAI lieferte kein Bild." }, { status: 502 });
    }

    const imageUrl = await uploadBase64ToKie(kieKey, base64Image, body.outputFormat ?? "png");

    if (isFreeTrialRequest) {
      const admin = createAdminClient();
      const { error: metadataError } = await admin.auth.admin.updateUserById(userId, {
        user_metadata: {
          ...currentUserMetadata,
          free_trial_image_used_at: new Date().toISOString(),
        },
      });
      if (metadataError) {
        return NextResponse.json({ error: "Kostenloses Bild konnte nicht verbucht werden." }, { status: 500 });
      }
      return NextResponse.json({
        generationId: `openai-${randomUUID()}`,
        imageUrl,
        usedModel: "chatgpt-image-2",
        billing: { freeTrial: true, consumed: 0 },
      });
    }

    const consumeResult = await consumeTokens(userId, tokenCost);
    if (!consumeResult.ok) {
      return NextResponse.json({ error: consumeResult.error }, { status: 402 });
    }

    return NextResponse.json({
      generationId: `openai-${randomUUID()}`,
      imageUrl,
      usedModel: "chatgpt-image-2",
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
