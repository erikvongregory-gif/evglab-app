import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { enforceRateLimitPersistent, enforceSameOrigin } from "@/lib/security/requestGuards";
import {
  MAX_MY_BEERS,
  getDashboardMetadata,
  mergeDashboardMetadata,
  sanitizeDashboardBeers,
  type DashboardBeer,
} from "@/lib/dashboard/metadata";
import { uploadUserImageToStorage } from "@/lib/supabase/storage";

export const runtime = "nodejs";
export const maxDuration = 30;

const beerSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(80),
  bierstil: z.string().min(1).max(60),
  flaschenTyp: z.string().min(1).max(60),
  flaschenfarbe: z.enum(["braun", "gruen", "klar"]),
  etikettUrl: z.string().max(1200).optional().default(""),
  createdAt: z.string().max(40).optional().default(""),
  /** Optionaler Etikett-Upload — wird server-seitig als kurze HTTPS-URL persistiert. */
  etikettPayload: z
    .object({
      base64: z.string().min(32).max(600_000),
      mime: z.enum(["image/jpeg", "image/png", "image/webp"]),
    })
    .optional(),
});

const putSchema = z.object({
  beers: z.array(beerSchema).max(MAX_MY_BEERS),
});

function toHttpUrlOrEmpty(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : "";
  } catch {
    return "";
  }
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

  return NextResponse.json({ beers: getDashboardMetadata(user.user_metadata).myBeers ?? [] });
}

export async function PUT(req: Request) {
  const rateError = await enforceRateLimitPersistent(req, {
    keyPrefix: "dashboard-my-beers",
    limit: 20,
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

  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const detail = issue ? `${issue.path.join(".")}: ${issue.message}` : "Validierung fehlgeschlagen.";
    return NextResponse.json({ error: `Ungültige Bier-Daten (${detail}).` }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  // Etikett-Uploads in kurze HTTPS-URLs umwandeln (nie Base64 in user_metadata).
  const beers: DashboardBeer[] = [];
  for (const beer of parsed.data.beers) {
    let etikettUrl = toHttpUrlOrEmpty(beer.etikettUrl);
    if (beer.etikettPayload) {
      try {
        const buffer = Buffer.from(beer.etikettPayload.base64, "base64");
        if (buffer.byteLength < 32) {
          return NextResponse.json(
            { error: `Etikett für „${beer.name}“ ist leer oder beschädigt.` },
            { status: 400 },
          );
        }
        etikettUrl = await uploadUserImageToStorage({
          userId: user.id,
          buffer,
          mime: beer.etikettPayload.mime,
          folder: "beer-labels",
        });
      } catch (uploadError) {
        console.warn("[dashboard/my-beers] Etikett-Upload fehlgeschlagen:", uploadError);
        return NextResponse.json(
          { error: `Etikett für „${beer.name}“ konnte nicht gespeichert werden. Bitte erneut versuchen.` },
          { status: 502 },
        );
      }
    }
    beers.push({
      id: beer.id,
      name: beer.name.trim(),
      bierstil: beer.bierstil,
      flaschenTyp: beer.flaschenTyp,
      flaschenfarbe: beer.flaschenfarbe,
      etikettUrl,
      createdAt: beer.createdAt || new Date().toISOString(),
    });
  }

  const sanitized = sanitizeDashboardBeers(beers);
  const { error } = await supabase.auth.updateUser({
    data: mergeDashboardMetadata(user.user_metadata, { myBeers: sanitized }),
  });
  if (error) {
    return NextResponse.json({ error: "Sortiment konnte nicht gespeichert werden." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, beers: sanitized });
}
