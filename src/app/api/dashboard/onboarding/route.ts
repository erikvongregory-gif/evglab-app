import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { enforceRateLimitPersistent, enforceSameOrigin } from "@/lib/security/requestGuards";
import { getDashboardMetadata, mergeDashboardMetadata } from "@/lib/dashboard/metadata";
import { readDashboardMedia } from "@/lib/dashboard/media-store";
import {
  EMPTY_STUDIO_ONBOARDING_STATE,
  mergeStudioOnboardingState,
  sanitizeStudioOnboardingState,
  type StudioOnboardingProgress,
} from "@/lib/dashboard/onboarding";
import { getEffectiveBillingRow } from "@/lib/billing/store";
import { hasActiveSubscription } from "@/lib/billing/access";

const patchSchema = z.object({
  welcome: z.boolean().optional(),
  checklistDismissed: z.boolean().optional(),
  celebrated: z.boolean().optional(),
  hints: z.array(z.string().max(40)).max(24).optional(),
});

async function deriveProgress(
  userId: string,
  userMetadata: unknown,
): Promise<StudioOnboardingProgress> {
  const dashboard = getDashboardMetadata(userMetadata);
  const brandMode = dashboard.settings?.brandProfileMode;
  const team = dashboard.teamMembers ?? [];

  let plan = false;
  try {
    plan = hasActiveSubscription(await getEffectiveBillingRow(userId));
  } catch {
    /* Billing optional — Checkliste bleibt nutzbar */
  }

  const media = await readDashboardMedia(userId).catch(() => dashboard.mediaLibrary ?? []);
  return {
    brand: brandMode === "guided" || brandMode === "skip",
    motif: media.length > 0,
    plan,
    team: team.some((member) => member.role !== "owner"),
  };
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase ist nicht konfiguriert." }, { status: 500 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  return NextResponse.json({
    state: getDashboardMetadata(user.user_metadata).onboarding ?? EMPTY_STUDIO_ONBOARDING_STATE,
    progress: await deriveProgress(user.id, user.user_metadata),
  });
}

export async function PATCH(req: Request) {
  const rateError = await enforceRateLimitPersistent(req, {
    keyPrefix: "dashboard-onboarding",
    limit: 40,
    windowMs: 60_000,
  });
  if (rateError) return rateError;
  const originError = enforceSameOrigin(req);
  if (originError) return originError;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase ist nicht konfiguriert." }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültiger Onboarding-Status." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const current = sanitizeStudioOnboardingState(
    getDashboardMetadata(user.user_metadata).onboarding,
  );
  const next = mergeStudioOnboardingState(current, parsed.data);
  const { error } = await supabase.auth.updateUser({
    data: mergeDashboardMetadata(user.user_metadata, { onboarding: next }),
  });
  if (error) {
    return NextResponse.json(
      { error: "Onboarding-Status konnte nicht gespeichert werden." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    state: next,
    progress: await deriveProgress(user.id, user.user_metadata),
  });
}
