import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { enforceRateLimitPersistent, enforceSameOrigin } from "@/lib/security/requestGuards";
import { storeBrandReferenceImagesAsUrls } from "@/lib/brand/persist-reference-urls";

export const maxDuration = 60;

const bodySchema = z.object({
  images: z
    .array(
      z.object({
        base64: z.string().min(32).max(600_000),
        mime: z.enum(["image/jpeg", "image/png", "image/webp"]),
      }),
    )
    .max(5),
});

export async function POST(req: Request) {
  const rateError = await enforceRateLimitPersistent(req, {
    keyPrefix: "brand-persist-reference-images",
    limit: 20,
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
  if (!user) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  let parsed;
  try {
    parsed = bodySchema.safeParse(await req.json());
  } catch {
    return NextResponse.json({ error: "Ungueltige Anfrage." }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungueltige Referenzbilder." }, { status: 400 });
  }

  if (parsed.data.images.length === 0) {
    return NextResponse.json({ ok: true, urls: [] });
  }

  try {
    const urls = await storeBrandReferenceImagesAsUrls(parsed.data.images);

    return NextResponse.json({ ok: true, urls });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Referenzbilder konnten nicht gespeichert werden.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
