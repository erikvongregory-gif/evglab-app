import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { readBrandReferenceImageBuffer } from "@/lib/brand/reference-image-store";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase ist nicht konfiguriert." }, { status: 500 });
  }

  const { id } = await context.params;
  if (!/^br_[a-zA-Z0-9_-]{8,24}$/.test(id)) {
    return NextResponse.json({ error: "Ungueltige Bild-ID." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const image = readBrandReferenceImageBuffer(user.user_metadata, id);
  if (!image) {
    return NextResponse.json({ error: "Referenzbild nicht gefunden." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(image.buffer), {
    headers: {
      "Content-Type": image.mime,
      "Cache-Control": "private, max-age=86400",
    },
  });
}
