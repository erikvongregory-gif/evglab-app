import { workspaceResourceUser } from "@/lib/dashboard/workspace";
import { hasPassedTwoFactor } from "@/lib/auth/twoFactorSession";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { enforceRateLimitPersistent, enforceSameOrigin } from "@/lib/security/requestGuards";
import { type DashboardMediaItem } from "@/lib/dashboard/metadata";
import { readDashboardMedia, writeDashboardMedia, deleteDashboardMedia } from "@/lib/dashboard/media-store";

const mediaSchema = z.object({
  id: z.string().min(1).max(120),
  imageUrl: z.string().url().max(2000),
  title: z.string().min(1).max(120).optional(),
  prompt: z.string().min(1).max(240),
  createdAt: z.string().datetime(),
  aspectRatio: z.string().max(20),
  resolution: z.enum(["1K", "2K", "4K"]),
  outputFormat: z.enum(["png", "jpg"]),
});

const mediaPatchSchema = z.object({
  id: z.string().min(1).max(120),
  title: z.string().min(1).max(120),
});

async function requireUserId(write = false): Promise<string | NextResponse> {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase ist nicht konfiguriert." }, { status: 500 });
  }
  const supabase = await createClient();
  let {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && !(await hasPassedTwoFactor(user.id))) return NextResponse.json({ error: "Zwei-Faktor-Prüfung erforderlich.", code: "two_factor_required" }, { status: 403 });
  if (user) { try { user = await workspaceResourceUser(user, write); } catch { return NextResponse.json({error:"Teamzugriff nicht erlaubt."},{status:403}); } }
  if (!user) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  return user.id;
}

export async function GET() {
  const userId = await requireUserId();
  if (typeof userId !== "string") return userId;
  try {
    const items = await readDashboardMedia(userId);
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Mediathek konnte nicht geladen werden." },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const rateError = await enforceRateLimitPersistent(req, {
    keyPrefix: "dashboard-media-post",
    limit: 40,
    windowMs: 60_000,
  });
  if (rateError) return rateError;
  const originError = enforceSameOrigin(req);
  if (originError) return originError;

  const parsed = mediaSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültiges Mediathek-Element." }, { status: 400 });
  }

  const userId = await requireUserId(true);
  if (typeof userId !== "string") return userId;

  const payload = parsed.data;
  const item: DashboardMediaItem = {
    ...payload,
    title: (payload.title?.trim() || payload.prompt.trim()).slice(0, 120),
    prompt: payload.prompt.trim().slice(0, 240),
  };

  try {
    const next = await writeDashboardMedia(userId, [item]);
    return NextResponse.json({ ok: true, items: next });
  } catch (error) {
    console.warn("[dashboard/media] POST failed:", error);
    return NextResponse.json({ error: "Mediathek konnte nicht gespeichert werden." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const rateError = await enforceRateLimitPersistent(req, {
    keyPrefix: "dashboard-media-patch",
    limit: 60,
    windowMs: 60_000,
  });
  if (rateError) return rateError;
  const originError = enforceSameOrigin(req);
  if (originError) return originError;

  const parsed = mediaPatchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültiger Motiv-Titel." }, { status: 400 });
  }

  const userId = await requireUserId(true);
  if (typeof userId !== "string") return userId;

  const { id, title } = parsed.data;
  try {
    const current = await readDashboardMedia(userId);
    if (!current.some((entry) => entry.id === id)) {
      return NextResponse.json({ error: "Motiv nicht gefunden." }, { status: 404 });
    }
    const next = await writeDashboardMedia(
      userId,
      current.filter(entry => entry.id === id).map(entry => ({ ...entry, title: title.trim() })),
    );
    return NextResponse.json({ ok: true, items: next });
  } catch (error) {
    console.warn("[dashboard/media] PATCH failed:", error);
    return NextResponse.json({ error: "Titel konnte nicht gespeichert werden." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const rateError = await enforceRateLimitPersistent(req, {
    keyPrefix: "dashboard-media-delete",
    limit: 40,
    windowMs: 60_000,
  });
  if (rateError) return rateError;
  const originError = enforceSameOrigin(req);
  if (originError) return originError;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id fehlt." }, { status: 400 });

  const userId = await requireUserId(true);
  if (typeof userId !== "string") return userId;

  try {
    const next = await deleteDashboardMedia(userId, id);
    return NextResponse.json({ ok: true, items: next });
  } catch (error) {
    console.warn("[dashboard/media] DELETE failed:", error);
    return NextResponse.json({ error: "Mediathek konnte nicht aktualisiert werden." }, { status: 500 });
  }
}
