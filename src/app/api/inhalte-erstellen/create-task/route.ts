import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireImageGenerationUser } from "@/app/(dashboard)/inhalte-erstellen/lib/api-guards";
import { buildHyperrealisticPrompt } from "@/app/(dashboard)/inhalte-erstellen/lib/prompt-builders/hyperrealistic";
import {
  enforceHyperrealisticPromptConstraints,
  shouldUseImageReferenceForGeneration,
} from "@/app/(dashboard)/inhalte-erstellen/lib/prompt-builders/enforce-prompt-constraints";
import { hyperrealisticSchema, type HyperrealisticInput } from "@/app/(dashboard)/inhalte-erstellen/lib/schemas";
import { uploadBase64ToKie } from "@/lib/brand/kie-upload";
import { resolveReferenceImageForVision } from "@/lib/brand/reference-image-bytes";
import { createReferenceResolverFromMetadata } from "@/lib/brand/resolve-reference-for-generation";
import { buildBrandProfilePromptContext, getBrandProfileFromMetadata } from "@/lib/dashboard/brandProfile";
import { calculateGenerationTokenCost, calculatePerVariantTokenCost } from "@/lib/billing/generationTokenCost";
import { consumeTokens, ensureBillingRow, getBillingRow } from "@/lib/billing/store";
import { requireActiveSubscription } from "@/lib/billing/access";
import { mapAspectRatioForGptImage2, normalizeResolutionForGptImage2 } from "@/lib/kie/gptImage2TaskInput";
import { withPendingTask } from "@/lib/kie/taskBillingMetadata";
import { generateBrauereiBildPrompt } from "@/lib/prompts/brauerei-bild/generate-prompt";
import { buildHyperrealisticClaudeUserMessage } from "@/lib/prompts/brauerei-bild/map-hyperrealistic-brief";
import { applyContentPresetPrompt } from "@/lib/image-types/policy";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PROMPT_CHARS = 12_000;
/**
 * Anzahl Varianten, die pro Generieren-Klick erzeugt werden.
 * Marketing-Versprechen: „drei Varianten im Markenstil“ → 3 parallele Kie-Tasks.
 * Spaeter via UI/Schema konfigurierbar wenn noetig.
 */
const VARIANT_COUNT = 3;

/**
 * Stellt sicher, dass die Referenz-URL eine fuer Kie zugaengliche HTTPS-URL ist.
 * - Wenn `data:image/...;base64,...` → upload via Kie's file-base64-upload
 * - Wenn interne `/api/brand/reference-image/<id>` → Buffer holen, base64-encode, upload
 * - Wenn bereits HTTPS → unveraendert zurueckgeben
 */
async function ensureKieReferenceUrl(
  rawUrl: string,
  userMetadata: unknown,
  kieApiKey: string,
): Promise<string | null> {
  if (!rawUrl) return null;

  if (rawUrl.startsWith("data:")) {
    const match = rawUrl.match(/^data:(.+?);base64,/);
    const mime = match?.[1] ?? "image/png";
    return uploadBase64ToKie(kieApiKey, rawUrl, 0, mime);
  }

  if (/^https?:\/\//i.test(rawUrl)) {
    const resolver = createReferenceResolverFromMetadata(userMetadata);
    const buffer = await resolver(rawUrl, 0).catch(() => null);
    if (buffer && buffer.byteLength > 0) {
      const base64 = buffer.toString("base64");
      const mime = "image/png";
      return uploadBase64ToKie(kieApiKey, `data:${mime};base64,${base64}`, 0, mime);
    }
    return rawUrl;
  }

  return null;
}

function pickAspectRatio(aspect: HyperrealisticInput["aspectRatio"]) {
  return mapAspectRatioForGptImage2(aspect);
}

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

export async function POST(req: Request) {
  try {
    const guard = await requireImageGenerationUser(req, "inhalte-erstellen-create-task");
    if (!guard.ok) return guard.response;

    const subscriptionError = await requireActiveSubscription(guard.userId);
    if (subscriptionError) return subscriptionError;

    const currentUserMetadata = (guard.userMetadata as Record<string, unknown> | null) ?? {};

    await ensureBillingRow(guard.userId);
    const currentState = await getBillingRow(guard.userId);

    const kieApiKey = process.env.KIE_API_KEY?.trim();
    if (!kieApiKey) {
      return NextResponse.json({ error: "KIE_API_KEY fehlt." }, { status: 500 });
    }

    const parsed = hyperrealisticSchema.safeParse(await req.json());
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const detail = issue ? `${issue.path.join(".")}: ${issue.message}` : "Payload validation failed.";
      return NextResponse.json({ error: `Ungueltige Anfrage. ${detail}` }, { status: 400 });
    }
    const input = parsed.data;

    const brandProfile = getBrandProfileFromMetadata(guard.userMetadata);
    const brandProfileContext = buildBrandProfilePromptContext(brandProfile);

    // Referenzbild fuer Claude vision vorbereiten (Schritt A–D im Skill).
    // Nur ausfuehren, wenn der User wirklich ein Markenetikett verwenden moechte.
    const wantsBrandLabel = input.etikettModus !== "generisch";
    const profileReferenceUrl = brandProfile.brandReferenceImageUrls[0]?.trim() || "";
    let effectiveEtikettBild = input.etikettBild?.trim() ?? "";
    if (
      wantsBrandLabel &&
      (!effectiveEtikettBild || effectiveEtikettBild.includes("example.com/placeholder")) &&
      profileReferenceUrl
    ) {
      effectiveEtikettBild = profileReferenceUrl;
    }
    const hasEtikettInput =
      Boolean(effectiveEtikettBild) && !effectiveEtikettBild.includes("example.com/placeholder");
    let visionReference = null as Awaited<ReturnType<typeof resolveReferenceImageForVision>>;
    if (wantsBrandLabel && hasEtikettInput) {
      try {
        visionReference = await resolveReferenceImageForVision(effectiveEtikettBild, guard.userMetadata);
      } catch (visionError) {
        console.warn("[inhalte-erstellen/create-task] vision reference resolve failed:", visionError);
      }
    }

    // 1) Prompt via Claude (Skill) erzeugen — Fallback: lokaler Builder.
    let prompt = buildHyperrealisticPrompt(input, { breweryName: brandProfile.breweryName });
    const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (anthropicKey) {
      try {
        const anthropic = new Anthropic({ apiKey: anthropicKey });
        prompt = await generateBrauereiBildPrompt({
          anthropic,
          userMessage: buildHyperrealisticClaudeUserMessage(input, {
            breweryName: brandProfile.breweryName,
            hasReferenceImage: Boolean(visionReference),
          }),
          brandProfileContext,
          maxTokens: 1400,
          temperature: 0.35,
          referenceImages: visionReference ? [visionReference] : undefined,
        });
      } catch (skillError) {
        console.warn("[inhalte-erstellen/create-task] brauerei-bild skill fallback:", skillError);
      }
    }
    if (prompt.length > MAX_PROMPT_CHARS) prompt = prompt.slice(0, MAX_PROMPT_CHARS);
    prompt = enforceHyperrealisticPromptConstraints(prompt, input, brandProfile.breweryName);
    prompt = applyContentPresetPrompt(prompt, "hyperreal");
    if (prompt.length > MAX_PROMPT_CHARS) prompt = prompt.slice(0, MAX_PROMPT_CHARS);

    // 2) Referenzbild fuer Kie — NICHT bei „Nur Glas“ (i2i wuerde Flasche aus Referenz kopieren).
    const useImageReference = shouldUseImageReferenceForGeneration(input) && hasEtikettInput;
    let referenceUrl: string | null = null;
    if (useImageReference) {
      referenceUrl = await ensureKieReferenceUrl(effectiveEtikettBild, guard.userMetadata, kieApiKey);
      if (!referenceUrl) {
        return NextResponse.json(
          { error: "Referenzbild konnte nicht zu Kie hochgeladen werden. Bitte erneut hochladen oder „Generisch“ waehlen." },
          { status: 502 },
        );
      }
    }

    // 3) Kie createTask aufrufen — Modell je nach mit/ohne Referenz.
    const baseUrl = process.env.KIE_API_BASE_URL || "https://api.kie.ai";
    const sanitizeModel = (raw: string | undefined, fallback: string) => {
      const trimmed = raw?.trim() ?? "";
      if (!trimmed) return fallback;
      if (/^paste_/i.test(trimmed)) return fallback;
      if (/placeholder/i.test(trimmed)) return fallback;
      return trimmed;
    };
    const textModel = sanitizeModel(process.env.KIE_CHATGPT_IMAGE2_TEXT_MODEL, "gpt-image-2-text-to-image");
    const imageModel = sanitizeModel(process.env.KIE_CHATGPT_IMAGE2_IMAGE_MODEL, "gpt-image-2-image-to-image");
    const kieModel = referenceUrl ? imageModel : textModel;
    const mappedAspect = pickAspectRatio(input.aspectRatio);
    const resolution = normalizeResolutionForGptImage2(input.quality === "high" ? "2K" : "1K", mappedAspect);
    const billingResolution = (input.quality === "high" ? "2K" : "1K") as "1K" | "2K";
    const hasReferenceForBilling = Boolean(referenceUrl);
    const strictLabelMode = input.etikettModus === "marke" && hasReferenceForBilling;
    const perVariantCost = calculatePerVariantTokenCost({
      resolution: billingResolution,
      hasReferenceImage: hasReferenceForBilling,
      strictLabelMode,
    });
    const variantsToCreate = VARIANT_COUNT;
    const expectedTotalCost = calculateGenerationTokenCost({
      resolution: billingResolution,
      hasReferenceImage: hasReferenceForBilling,
      strictLabelMode,
      variantCount: variantsToCreate,
    });

    const remainingTokens = Math.max((currentState?.monthly_tokens ?? 0) - (currentState?.used_tokens ?? 0), 0);
    if (remainingTokens < expectedTotalCost) {
      return NextResponse.json(
        {
          error: `Nicht genug Tokens. Benötigt: ${expectedTotalCost}, verfügbar: ${remainingTokens}.`,
        },
        { status: 402 },
      );
    }

    const kieInput: Record<string, unknown> = {
      prompt,
      aspect_ratio: mappedAspect,
      resolution,
      nsfw_checker: false,
    };
    if (referenceUrl) kieInput.input_urls = [referenceUrl];

    // 3a) Drei parallele Tasks feuern — Kie variiert pro Task automatisch via Seed/Noise.
    //     Promise.allSettled, damit einzelne Fehler nicht den gesamten Run kippen.
    const createOne = async (
      variantIndex: number,
    ): Promise<
      | { ok: true; taskId: string }
      | { ok: false; error: string; raw?: unknown }
    > => {
      const upstream = await fetch(`${baseUrl}/api/v1/jobs/createTask`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${kieApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: kieModel, input: kieInput }),
      });
      const data = (await upstream.json().catch(() => ({}))) as Record<string, unknown>;
      if (!upstream.ok) {
        const msg =
          (data.msg as string | undefined) ||
          (data.error as string | undefined) ||
          ((data.data as Record<string, unknown> | undefined)?.msg as string | undefined) ||
          `Kie createTask fehlgeschlagen (HTTP ${upstream.status}).`;
        return { ok: false, error: `Variante ${variantIndex + 1}: ${msg}`, raw: data };
      }
      const code = data.code as number | undefined;
      if (typeof code === "number" && code !== 200) {
        const msg =
          (data.msg as string | undefined) ||
          (data.error as string | undefined) ||
          ((data.data as Record<string, unknown> | undefined)?.msg as string | undefined) ||
          "Kie hat den Task abgelehnt.";
        return { ok: false, error: `Variante ${variantIndex + 1}: ${msg}`, raw: data };
      }
      const taskId = extractTaskId(data);
      if (!taskId) {
        return { ok: false, error: `Variante ${variantIndex + 1}: kein taskId erhalten.`, raw: data };
      }
      return { ok: true, taskId };
    };

    const settled = await Promise.allSettled(
      Array.from({ length: variantsToCreate }, (_, i) => createOne(i)),
    );
    const taskIds: string[] = [];
    const errors: string[] = [];
    for (const r of settled) {
      if (r.status === "fulfilled") {
        if (r.value.ok) taskIds.push(r.value.taskId);
        else errors.push(r.value.error);
      } else {
        errors.push(r.reason instanceof Error ? r.reason.message : "Unbekannter Fehler.");
      }
    }

    if (taskIds.length === 0) {
      return NextResponse.json(
        {
          error: errors[0] ?? "Alle Kie-Tasks fehlgeschlagen.",
          details: errors,
        },
        { status: 502 },
      );
    }

    const totalConsumed = perVariantCost * taskIds.length;
    const consumeResult = await consumeTokens(guard.userId, totalConsumed);
    if (!consumeResult.ok) {
      return NextResponse.json({ error: consumeResult.error }, { status: 402 });
    }

    let nextMetadata: Record<string, unknown> = currentUserMetadata;
    for (const taskId of taskIds) {
      nextMetadata = withPendingTask(nextMetadata, taskId, {
        consumed: perVariantCost,
        createdAt: new Date().toISOString(),
        freeTrial: false,
      });
    }
    const admin = createAdminClient();
    const { error: pendingBillingError } = await admin.auth.admin.updateUserById(guard.userId, {
      user_metadata: nextMetadata,
    });
    if (pendingBillingError) {
      return NextResponse.json(
        { error: "Tokenverbrauch wurde verbucht, aber Task-Buchung konnte nicht gespeichert werden." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      taskIds,
      // Backward-compat: erster taskId weiterhin als `taskId` exportieren.
      taskId: taskIds[0],
      variantCount: taskIds.length,
      expectedVariants: variantsToCreate,
      partial: taskIds.length < variantsToCreate,
      partialErrors: errors.length > 0 ? errors : undefined,
      model: kieModel,
      prompt,
      hasReference: Boolean(referenceUrl),
      aspect_ratio: mappedAspect,
      resolution,
      billing: {
        freeTrial: false,
        consumed: totalConsumed,
        perVariant: perVariantCost,
        plan: consumeResult.state.plan,
        monthlyTokens: consumeResult.state.monthly_tokens,
        usedTokens: consumeResult.state.used_tokens,
        remainingTokens: Math.max(consumeResult.state.monthly_tokens - consumeResult.state.used_tokens, 0),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Kie Task-Erstellung fehlgeschlagen." },
      { status: 500 },
    );
  }
}
