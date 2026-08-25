import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { enforceRateLimitPersistent, enforceSameOrigin } from "@/lib/security/requestGuards";
import { clampBrandSettingsFields } from "@/lib/dashboard/settingsPayload";
import {
  persistBrandProfileForUser,
  prepareMetadataForSave,
  resolveBrandReferenceImageUrls,
} from "@/lib/brand/save-brand-profile";

export const runtime = "nodejs";
export const maxDuration = 30;

const bodySchema = z.object({
  breweryName: z.string().min(1).max(120),
  brandTone: z.string().min(1).max(300),
  brandColors: z.string().min(1).max(300),
  brandDos: z.string().min(1).max(600),
  brandDonts: z.string().min(1).max(600),
  brandInstagramUrl: z.string().max(1200).optional().default(""),
  brandWebsiteUrl: z.string().max(1200).optional().default(""),
  brandProfileSource: z.enum(["url", "instagram", "manual"]),
  brandReferenceImageUrls: z.array(z.string().max(1200)).max(10).optional().default([]),
  brandLabelReferenceUrl: z.string().max(1200).optional().default(""),
  referenceImagePayloads: z
    .array(
      z.object({
        base64: z.string().min(32).max(600_000),
        mime: z.enum(["image/jpeg", "image/png", "image/webp"]),
      }),
    )
    .max(5)
    .optional(),
});

export async function POST(req: Request) {
  try {
    const rateError = await enforceRateLimitPersistent(req, {
      keyPrefix: "brand-activate-profile",
      limit: 15,
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

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json({ error: "Ungueltige Anfrage." }, { status: 400 });
    }

    const clamped = clampBrandSettingsFields(
      typeof rawBody === "object" && rawBody !== null ? (rawBody as Record<string, unknown>) : {},
    );
    const parsed = bodySchema.safeParse(clamped);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const detail = firstIssue ? `${firstIssue.path.join(".")}: ${firstIssue.message}` : "Validierung fehlgeschlagen";
      return NextResponse.json({ error: `Ungueltige Markenprofil-Daten (${detail}).` }, { status: 400 });
    }

    const input = parsed.data;
    let referenceImageUrls: string[] = [];
    try {
      referenceImageUrls = await resolveBrandReferenceImageUrls({
        referenceImageUrls: input.brandReferenceImageUrls,
        referenceImagePayloads: input.referenceImagePayloads,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Referenzbilder konnten nicht gespeichert werden.";
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const origin = new URL(req.url).origin;
    const latestMetadata = prepareMetadataForSave(user.user_metadata);

    let saved;
    try {
      saved = await persistBrandProfileForUser({
        userId: user.id,
        latestMetadata,
        origin,
        input,
        referenceImageUrls,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Markenprofil konnte nicht gespeichert werden.";
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      settings: saved.settings,
      referenceImageUrls: saved.referenceImageUrls,
    });
  } catch (error) {
    console.error("[brand/activate-profile]", error);
    const msg = error instanceof Error ? error.message : "Markenprofil konnte nicht gespeichert werden.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
