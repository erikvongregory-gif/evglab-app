import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { consumeTokens, ensureBillingRow, getBillingRow } from "@/lib/billing/store";
import { enforceRateLimit, enforceSameOrigin } from "@/lib/security/requestGuards";
import { createAdminClient } from "@/lib/supabase/admin";
import { withPendingTask } from "@/lib/kie/taskBillingMetadata";
import {
  buildBrandProfilePromptContext,
  getBrandProfileFromMetadata,
  isBrandProfileComplete,
} from "@/lib/dashboard/brandProfile";
import { mapAspectRatioForGptImage2, normalizeResolutionForGptImage2 } from "@/lib/kie/gptImage2TaskInput";

type CreateTaskBody = {
  prompt: string;
  aspectRatio?: string;
  resolution?: "1K" | "2K" | "4K";
  outputFormat?: "png" | "jpg";
  referenceImageUrls?: string[];
  strictLabelMode?: boolean;
};

const KIE_MODEL_TEXT_TO_IMAGE = (process.env.KIE_IMAGE_MODEL?.trim() || "gpt-image-2-text-to-image") as string;
const KIE_MODEL_IMAGE_TO_IMAGE = (process.env.KIE_IMAGE_TO_IMAGE_MODEL?.trim() || "gpt-image-2-image-to-image") as string;

const createTaskSchema = z.object({
  prompt: z.string().trim().min(1).max(12000),
  aspectRatio: z
    .enum(["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9", "auto"])
    .optional(),
  resolution: z.enum(["1K", "2K", "4K"]).optional(),
  outputFormat: z.enum(["png", "jpg"]).optional(),
  referenceImageUrls: z.array(z.string().max(12_000_000)).max(2).optional(),
  strictLabelMode: z.boolean().optional(),
});

function extractTaskId(input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  const direct =
    (record.taskId as string | undefined) ||
    (record.recordId as string | undefined) ||
    (record.id as string | undefined);
  if (direct && typeof direct === "string") return direct;
  for (const value of Object.values(record)) {
    const nested = extractTaskId(value);
    if (nested) return nested;
  }
  return null;
}

function extractUploadedFileUrl(input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  const directCandidates = [record.fileUrl, record.url, record.downloadUrl, record.path];
  for (const candidate of directCandidates) {
    if (typeof candidate === "string" && /^https?:\/\//i.test(candidate)) {
      return candidate;
    }
  }
  for (const value of Object.values(record)) {
    const nested = extractUploadedFileUrl(value);
    if (nested) return nested;
  }
  return null;
}

async function uploadReferenceImagesToKie(apiKey: string, referenceImageUrls?: string[]) {
  if (!referenceImageUrls?.length) return undefined;
  const uploadBase = "https://kieai.redpandaai.co";
  const uploadedUrls: string[] = [];

  for (const [index, base64Data] of referenceImageUrls.entries()) {
    const uploadRes = await fetch(`${uploadBase}/api/file-base64-upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        base64Data,
        uploadPath: "evglab/reference-images",
        fileName: `reference-${Date.now()}-${index + 1}.png`,
      }),
    });

    const uploadData = (await uploadRes.json()) as Record<string, unknown>;
    if (!uploadRes.ok) {
      throw new Error(
        ((uploadData.msg as string) || (uploadData.error as string) || "Kie Upload fehlgeschlagen.").trim(),
      );
    }

    const code = uploadData.code as number | undefined;
    if (typeof code === "number" && code !== 200) {
      throw new Error(((uploadData.msg as string) || "Kie Upload wurde abgelehnt.").trim());
    }

    const fileUrl = extractUploadedFileUrl(uploadData);
    if (!fileUrl) {
      const topLevelKeys = Object.keys(uploadData).join(", ");
      throw new Error(`Kie Upload liefert keine verwendbare Datei-URL (keys: ${topLevelKeys || "none"}).`);
    }
    uploadedUrls.push(fileUrl);
  }

  return uploadedUrls;
}

export async function POST(req: Request) {
  try {
    const rateError = enforceRateLimit(req, {
      keyPrefix: "kie-create-task",
      limit: 12,
      windowMs: 60_000,
    });
    if (rateError) return rateError;
    const originError = enforceSameOrigin(req);
    if (originError) return originError;

    let userId: string | null = null;
    let freeTrialUsed = false;
    let currentUserMetadata: Record<string, unknown> = {};
    let bodyBrandProfileContext = "";
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
      bodyBrandProfileContext = buildBrandProfilePromptContext(brandProfile);
    }

    const apiKey = process.env.KIE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "KIE_API_KEY fehlt." }, { status: 500 });
    }

    const baseUrl = process.env.KIE_API_BASE_URL || "https://api.kie.ai";
    const parseResult = createTaskSchema.safeParse(await req.json());
    if (!parseResult.success) {
      return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
    }
    const body = parseResult.data as CreateTaskBody;

    if (!body.prompt?.trim()) {
      return NextResponse.json({ error: "Prompt fehlt." }, { status: 400 });
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

    const hasReferenceImages = Boolean(body.referenceImageUrls?.length);
    const kieModel = hasReferenceImages ? KIE_MODEL_IMAGE_TO_IMAGE : KIE_MODEL_TEXT_TO_IMAGE;

    const mappedAspect = mapAspectRatioForGptImage2(body.aspectRatio);
    const effectiveResolution = normalizeResolutionForGptImage2(body.resolution, mappedAspect);
    const baseCost = effectiveResolution === "4K" ? 35 : effectiveResolution === "2K" ? 20 : 10;
    const tokenCost = baseCost + (hasReferenceImages ? 5 : 0) + (body.strictLabelMode ? 10 : 0);
    if (!isFreeTrialRequest) {
      const remainingTokens = Math.max((currentState?.monthly_tokens ?? 0) - (currentState?.used_tokens ?? 0), 0);
      if (remainingTokens < tokenCost) {
        return NextResponse.json(
          { error: `Nicht genug Tokens. Benötigt: ${tokenCost}, verfügbar: ${remainingTokens}.` },
          { status: 402 },
        );
      }
    }

    const strictLabelPromptPrefix = body.strictLabelMode
      ? [
          "Brand/label fidelity lock (MANDATORY):",
          "- Preserve the exact original brand identity and label layout 1:1 for any branded bottles or packaging shown.",
          "- Keep logo mark, typography, color blocks, crest placement, and bottle label geometry authentic and undistorted.",
          "- Any visible label text must be sharp and readable; no gibberish, mirrored, stretched, or melted lettering.",
          "- Do not invent substitute branding or alter the original product identity.",
          "- Keep at least one bottle as a hero product in sharp focus with tack-sharp label readability.",
          "- Avoid blur specifically on the label/logo area (no motion blur, no depth-of-field blur on primary brand text).",
          "- If depth-of-field is used, keep branded bottle text plane inside the focal plane.",
        ].join("\n")
      : "";
    const negativePromptBlock = [
      "Negative prompt constraints (MANDATORY):",
      "- no waxy/plastic skin, no uncanny facial geometry",
      "- no extra/fused fingers, malformed hands, duplicate limbs",
      "- no distorted teeth/lips/eyes, no asymmetrical face glitches",
      "- no CGI/3D-render look",
      "- no gibberish or mirrored label text, no stretched/melted typography",
      "- no fake substitute branding",
    ].join("\n");
    const promptWithLabelLock = strictLabelPromptPrefix
      ? `${strictLabelPromptPrefix}\n\n${body.prompt.trim()}\n\n${negativePromptBlock}`
      : `${body.prompt.trim()}\n\n${negativePromptBlock}`;
    const promptWithBrandContext = [
      promptWithLabelLock,
      "",
      bodyBrandProfileContext,
    ]
      .filter(Boolean)
      .join("\n");

    const uploadedReferenceUrls = hasReferenceImages
      ? await uploadReferenceImagesToKie(apiKey, body.referenceImageUrls)
      : undefined;
    if (hasReferenceImages && (!uploadedReferenceUrls || uploadedReferenceUrls.length === 0)) {
      return NextResponse.json({ error: "Referenzbilder konnten nicht zu Kie hochgeladen werden." }, { status: 502 });
    }

    const resolutionForKie = isFreeTrialRequest ? "1K" : effectiveResolution;
    const nsfwFalse = { nsfw_checker: false as const };

    const kieInput = hasReferenceImages
      ? {
          prompt: promptWithBrandContext,
          input_urls: uploadedReferenceUrls,
          aspect_ratio: mappedAspect,
          resolution: resolutionForKie,
          ...nsfwFalse,
        }
      : {
          prompt: promptWithBrandContext,
          aspect_ratio: mappedAspect,
          resolution: resolutionForKie,
          ...nsfwFalse,
        };

    const upstream = await fetch(`${baseUrl}/api/v1/jobs/createTask`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: kieModel,
        input: kieInput,
      }),
    });

    const data = (await upstream.json()) as Record<string, unknown>;
    if (!upstream.ok) {
      return NextResponse.json(
        {
          error: "Kie createTask fehlgeschlagen.",
        },
        { status: upstream.status },
      );
    }

    const code = data.code as number | undefined;
    if (typeof code === "number" && code !== 200) {
      return NextResponse.json(
        {
          error: "Kie hat den Task abgelehnt.",
        },
        { status: 502 },
      );
    }

    const taskId = extractTaskId(data);
    if (!taskId) {
      return NextResponse.json(
        {
          error: "Kein taskId von Kie erhalten.",
        },
        { status: 502 },
      );
    }

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
        taskId,
        usedModel: kieModel,
        billing: {
          freeTrial: true,
          consumed: 0,
        },
      });
    }

    const consumeResult = await consumeTokens(userId, tokenCost);
    if (!consumeResult.ok) {
      return NextResponse.json({ error: consumeResult.error }, { status: 402 });
    }
    const admin = createAdminClient();
    const { error: pendingBillingError } = await admin.auth.admin.updateUserById(userId, {
      user_metadata: withPendingTask(currentUserMetadata, taskId, {
        consumed: tokenCost,
        createdAt: new Date().toISOString(),
        freeTrial: false,
      }),
    });
    if (pendingBillingError) {
      return NextResponse.json(
        { error: "Tokenverbrauch wurde verbucht, aber Task-Buchung konnte nicht gespeichert werden." },
        { status: 500 },
      );
    }
    const response = NextResponse.json({
      taskId,
      usedModel: kieModel,
      billing: {
        plan: consumeResult.state.plan,
        monthlyTokens: consumeResult.state.monthly_tokens,
        usedTokens: consumeResult.state.used_tokens,
        remainingTokens: Math.max(consumeResult.state.monthly_tokens - consumeResult.state.used_tokens, 0),
        consumed: tokenCost,
      },
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Kie createTask fehlgeschlagen." }, { status: 500 });
  }
}
