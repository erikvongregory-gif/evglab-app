import { hasPassedTwoFactor } from "@/lib/auth/twoFactorSession";
import { getDashboardMetadata, mergeDashboardMetadata } from "@/lib/dashboard/metadata";
import { sanitizeDashboardSettings } from "@/lib/dashboard/settingsPayload";
import { enforceRateLimitPersistent, enforceSameOrigin } from "@/lib/security/requestGuards";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { uploadProfileAvatarToStorage } from "@/lib/supabase/storage";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export async function POST(req: Request) {
  const rateError = await enforceRateLimitPersistent(req, {
    keyPrefix: "dashboard-avatar",
    limit: 10,
    windowMs: 60_000,
  });
  if (rateError) return rateError;
  const originError = enforceSameOrigin(req);
  if (originError) return originError;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase ist nicht konfiguriert." }, { status: 500 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && !(await hasPassedTwoFactor(user))) {
    return NextResponse.json(
      { error: "Zwei-Faktor-Prüfung erforderlich.", code: "two_factor_required" },
      { status: 403 },
    );
  }
  if (!user) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Bilddatei fehlt." }, { status: 400 });
  }

  const mime = (file.type || "").toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    return NextResponse.json({ error: "Nur JPG, PNG oder WebP erlaubt." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength === 0 || buffer.byteLength > MAX_AVATAR_BYTES) {
    return NextResponse.json({ error: "Bild ist leer oder zu groß (max. 5 MB)." }, { status: 400 });
  }

  try {
    const url = await uploadProfileAvatarToStorage({ userId: user.id, buffer });
    const admin = createAdminClient();
    const { data: adminUser } = await admin.auth.admin.getUserById(user.id);
    const meta = adminUser?.user?.user_metadata ?? user.user_metadata;
    const existing = sanitizeDashboardSettings(getDashboardMetadata(meta).settings);
    const nextSettings = { ...existing, profileAvatarUrl: url };
    const merged = mergeDashboardMetadata(meta, { settings: nextSettings });

    const { error } = await admin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...merged,
        avatar_url: url,
      },
    });
    if (error) {
      console.error("[dashboard/avatar] updateUserById failed:", error.message);
      return NextResponse.json({ error: "Profilbild konnte nicht gespeichert werden." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, profileAvatarUrl: url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Profilbild-Upload fehlgeschlagen." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  const rateError = await enforceRateLimitPersistent(req, {
    keyPrefix: "dashboard-avatar-delete",
    limit: 10,
    windowMs: 60_000,
  });
  if (rateError) return rateError;
  const originError = enforceSameOrigin(req);
  if (originError) return originError;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase ist nicht konfiguriert." }, { status: 500 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && !(await hasPassedTwoFactor(user))) {
    return NextResponse.json(
      { error: "Zwei-Faktor-Prüfung erforderlich.", code: "two_factor_required" },
      { status: 403 },
    );
  }
  if (!user) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  try {
    const admin = createAdminClient();
    const { data: adminUser } = await admin.auth.admin.getUserById(user.id);
    const meta = adminUser?.user?.user_metadata ?? user.user_metadata;
    const existing = sanitizeDashboardSettings(getDashboardMetadata(meta).settings);
    const nextSettings = { ...existing, profileAvatarUrl: "" };
    const merged = mergeDashboardMetadata(meta, { settings: nextSettings });

    const { error } = await admin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...merged,
        avatar_url: null,
      },
    });
    if (error) {
      console.error("[dashboard/avatar] delete updateUserById failed:", error.message);
      return NextResponse.json({ error: "Profilbild konnte nicht entfernt werden." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, profileAvatarUrl: "" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Profilbild konnte nicht entfernt werden." },
      { status: 500 },
    );
  }
}
