import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { enforceSameOrigin } from "@/lib/security/requestGuards";
import { persistInstagramConnectionForUser } from "@/lib/brand/instagram-persist-connection";

export const runtime = "nodejs";

export async function POST(req: Request) {
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

  await persistInstagramConnectionForUser({
    userId: user.id,
    userMetadata: user.user_metadata,
    connection: null,
  });

  return NextResponse.json({ ok: true, connected: false });
}
