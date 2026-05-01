import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { enforceRateLimitPersistent, enforceSameOrigin } from "@/lib/security/requestGuards";
import {
  type DashboardMediaItem,
  getDashboardMetadata,
  mergeDashboardMetadata,
} from "@/lib/dashboard/metadata";

const mediaSchema = z.object({
  id: z.string().min(1).max(120),
  imageUrl: z.string().url().max(2000),
  prompt: z.string().min(1).max(240),
  createdAt: z.string().datetime(),
  aspectRatio: z.string().max(20),
  resolution: z.enum(["1K", "2K", "4K"]),
  outputFormat: z.enum(["png", "jpg"]),
});

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase ist nicht konfiguriert." }, { status: 500 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const dashboard = getDashboardMetadata(user.user_metadata);
  const media = (dashboard.mediaLibrary ?? [])
    .slice()
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 12);
  return NextResponse.json({ items: media });
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

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase ist nicht konfiguriert." }, { status: 500 });
  }

  const parsed = mediaSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültiges Mediathek-Element." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const item = parsed.data as DashboardMediaItem;
  const current = getDashboardMetadata(user.user_metadata).mediaLibrary ?? [];
  const next = [item, ...current.filter((entry) => entry.id !== item.id)]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 12);
  const merged = mergeDashboardMetadata(user.user_metadata, { mediaLibrary: next });
  const { error } = await supabase.auth.updateUser({ data: merged });
  if (error) {
    return NextResponse.json({ error: "Mediathek konnte nicht gespeichert werden." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, items: next });
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

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase ist nicht konfiguriert." }, { status: 500 });
  }
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id fehlt." }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const current = getDashboardMetadata(user.user_metadata).mediaLibrary ?? [];
  const next = current.filter((entry) => entry.id !== id);
  const merged = mergeDashboardMetadata(user.user_metadata, { mediaLibrary: next });
  const { error } = await supabase.auth.updateUser({ data: merged });
  if (error) {
    return NextResponse.json({ error: "Mediathek konnte nicht aktualisiert werden." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, items: next });
}
