import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { consumeTokens, ensureBillingRow, getBillingRow } from "@/lib/billing/store";
import { requireActiveSubscription } from "@/lib/billing/access";
import { enforceRateLimit, enforceSameOrigin } from "@/lib/security/requestGuards";
import { createAdminClient } from "@/lib/supabase/admin";
import { withPendingTask } from "@/lib/kie/taskBillingMetadata";
import { extractTaskId } from "@/lib/kie/taskResponse";
import {
  KIE_SEEDANCE_MODEL,
  calculateSeedanceVideoTokenCost,
  durationForPreset,
  mapAspectRatioForSeedance,
  type SeedanceResolution,
} from "@/lib/kie/seedanceTaskInput";

const createTaskSchema = z.object({
  prompt: z.string().trim().min(3).max(20_000),
  aspectRatio: z.enum(["1:1", "9:16", "16:9"]).optional(),
  duration: z.number().int().min(4).max(15).optional(),
  resolution: z.enum(["480p", "720p", "1080p"]).optional(),
  generateAudio: z.boolean().optional(),
  presetId: z
    .enum(["ugc", "tutorial", "unboxing", "review", "tv_spot", "wild_card"])
    .optional(),
});

export async function POST(req: Request) {
  try {
    const rateError = enforceRateLimit(req, {
      keyPrefix: "kie-seedance-create-task",
      limit: 6,
      windowMs: 60_000,
    });
    if (rateError) return rateError;
    const originError = enforceSameOrigin(req);
    if (originError) return originError;

    let userId: string | null = null;
    let currentUserMetadata: Record<string, unknown> = {};
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
    }

    const apiKey = process.env.KIE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "KIE_API_KEY fehlt." }, { status: 500 });
    }

    const parseResult = createTaskSchema.safeParse(await req.json());
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0];
      const detail = firstIssue ? `${firstIssue.path.join(".")}: ${firstIssue.message}` : "Payload ungültig.";
      return NextResponse.json({ error: `Ungültige Anfrage. ${detail}` }, { status: 400 });
    }
    const body = parseResult.data;

    if (!userId) {
      return NextResponse.json({ error: "Nicht angemeldet.", code: "auth_required" }, { status: 401 });
    }

    const subscriptionError = await requireActiveSubscription(userId);
    if (subscriptionError) return subscriptionError;

    await ensureBillingRow(userId);
    const currentState = await getBillingRow(userId);

    const resolution = (body.resolution ?? "720p") as SeedanceResolution;
    const duration = body.duration ?? durationForPreset(body.presetId);
    const generateAudio = body.generateAudio ?? false;
    const aspectRatio = mapAspectRatioForSeedance(body.aspectRatio);
    const tokenCost = calculateSeedanceVideoTokenCost({ resolution, duration, generateAudio });
    const remainingTokens = Math.max((currentState?.monthly_tokens ?? 0) - (currentState?.used_tokens ?? 0), 0);
    if (remainingTokens < tokenCost) {
      return NextResponse.json(
        { error: `Nicht genug Tokens. Benötigt: ${tokenCost}, verfügbar: ${remainingTokens}.` },
        { status: 402 },
      );
    }

    const baseUrl = process.env.KIE_API_BASE_URL || "https://api.kie.ai";
    const upstream = await fetch(`${baseUrl}/api/v1/jobs/createTask`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: KIE_SEEDANCE_MODEL,
        input: {
          prompt: body.prompt.trim(),
          aspect_ratio: aspectRatio,
          duration,
          resolution,
          generate_audio: generateAudio,
          nsfw_checker: false,
          reference_image_urls: [],
          reference_video_urls: [],
          reference_audio_urls: [],
        },
      }),
    });

    const data = (await upstream.json()) as Record<string, unknown>;
    if (!upstream.ok) {
      const upstreamMessage =
        (data.msg as string | undefined) ||
        (data.error as string | undefined) ||
        ((data.data as Record<string, unknown> | undefined)?.msg as string | undefined);
      return NextResponse.json(
        {
          error: upstreamMessage ? `Video-Generierung fehlgeschlagen: ${upstreamMessage}` : "Video-Generierung fehlgeschlagen.",
          raw: data,
        },
        { status: upstream.status },
      );
    }

    const code = data.code as number | undefined;
    if (typeof code === "number" && code !== 200) {
      const upstreamMessage =
        (data.msg as string | undefined) ||
        (data.error as string | undefined) ||
        ((data.data as Record<string, unknown> | undefined)?.msg as string | undefined);
      return NextResponse.json(
        {
          error: upstreamMessage ? `Video-Task abgelehnt: ${upstreamMessage}` : "Video-Task wurde abgelehnt.",
          raw: data,
        },
        { status: 502 },
      );
    }

    const taskId = extractTaskId(data);
    if (!taskId) {
      return NextResponse.json({ error: "Kein Task-ID für die Video-Generierung erhalten." }, { status: 502 });
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

    return NextResponse.json({
      taskId,
      usedModel: KIE_SEEDANCE_MODEL,
      duration,
      resolution,
      aspectRatio,
      billing: {
        plan: consumeResult.state.plan,
        monthlyTokens: consumeResult.state.monthly_tokens,
        usedTokens: consumeResult.state.used_tokens,
        remainingTokens: Math.max(consumeResult.state.monthly_tokens - consumeResult.state.used_tokens, 0),
        consumed: tokenCost,
      },
    });
  } catch {
    return NextResponse.json({ error: "Video-Generierung konnte nicht gestartet werden." }, { status: 500 });
  }
}
