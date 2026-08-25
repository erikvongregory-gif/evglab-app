import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, createRouteHandlerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { enforceRateLimitPersistent, enforceSameOrigin } from "@/lib/security/requestGuards";
import { getDashboardMetadata, mergeDashboardMetadata, type DashboardSettings } from "@/lib/dashboard/metadata";
import { parseBrandReferenceIdFromUrl, repairBrandReferenceImageUrls } from "@/lib/brand/reference-image-store";
import { normalizeWebsiteUrl } from "@/lib/brand/url-intake";
import { clampBrandSettingsFields, sanitizeDashboardSettings } from "@/lib/dashboard/settingsPayload";

const optionalHttpUrl = z
  .string()
  .max(1200)
  .transform((v) => {
    const trimmed = v.trim();
    if (!trimmed) return "";
    return normalizeWebsiteUrl(trimmed) ?? "";
  });

const settingsSchema = z.object({
  profileName: z.string().max(120),
  breweryName: z.string().max(120),
  profilePhone: z.string().max(60),
  emailNotifications: z.boolean(),
  weeklySummary: z.boolean(),
  brandProfileMode: z.enum(["undecided", "guided", "skip"]),
  brandInstagramUrl: optionalHttpUrl,
  brandWebsiteUrl: optionalHttpUrl,
  brandProfileSource: z.enum(["url", "instagram", "manual", "skip"]),
  brandLockLevel: z.enum(["strict", "balanced", "loose"]),
  brandTone: z.string().max(300),
  brandColors: z.string().max(300),
  brandDos: z.string().max(600),
  brandDonts: z.string().max(600),
  brandReferenceImageUrls: z
    .array(z.string().max(1200))
    .max(10)
    .transform((urls) =>
      urls.filter((u) => {
        try {
          const parsed = new URL(u.trim());
          return parsed.protocol === "http:" || parsed.protocol === "https:";
        } catch {
          return false;
        }
      }),
    ),
  brandLabelReferenceUrl: z
    .string()
    .max(1200)
    .optional()
    .default("")
    .transform((value) => {
      try {
        const parsed = new URL(value.trim());
        return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : "";
      } catch {
        return "";
      }
    }),
  brandAnalyzedAt: z.string().max(64).optional(),
});

export async function GET(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase ist nicht konfiguriert." }, { status: 500 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const dashboard = getDashboardMetadata(user.user_metadata);
  const settings = dashboard.settings;
  const rawReferenceUrls = Array.isArray(settings?.brandReferenceImageUrls)
    ? settings.brandReferenceImageUrls.filter((item): item is string => typeof item === "string").slice(0, 10)
    : [];
  const origin = new URL(req.url).origin;
  const repairedRefs = repairBrandReferenceImageUrls(user.user_metadata, origin, rawReferenceUrls);

  const responseSettings: DashboardSettings = {
    profileName: typeof settings?.profileName === "string" ? settings.profileName : "",
    breweryName:
      typeof settings?.breweryName === "string"
        ? settings.breweryName
        : typeof user.user_metadata?.brewery === "string"
          ? user.user_metadata.brewery
          : "",
    profilePhone:
      typeof settings?.profilePhone === "string"
        ? settings.profilePhone
        : typeof user.user_metadata?.phone === "string"
          ? user.user_metadata.phone
          : "",
    emailNotifications:
      typeof settings?.emailNotifications === "boolean" ? settings.emailNotifications : true,
    weeklySummary: typeof settings?.weeklySummary === "boolean" ? settings.weeklySummary : true,
    brandProfileMode:
      settings?.brandProfileMode === "guided" || settings?.brandProfileMode === "skip"
        ? settings.brandProfileMode
        : ("undecided" as const),
    brandInstagramUrl: typeof settings?.brandInstagramUrl === "string" ? settings.brandInstagramUrl : "",
    brandWebsiteUrl: typeof settings?.brandWebsiteUrl === "string" ? settings.brandWebsiteUrl : "",
    brandProfileSource:
      settings?.brandProfileSource === "url" ||
      settings?.brandProfileSource === "instagram" ||
      settings?.brandProfileSource === "manual" ||
      settings?.brandProfileSource === "skip"
        ? settings.brandProfileSource
        : ("manual" as const),
    brandLockLevel:
      settings?.brandLockLevel === "balanced" || settings?.brandLockLevel === "loose"
        ? settings.brandLockLevel
        : ("strict" as const),
    brandTone: typeof settings?.brandTone === "string" ? settings.brandTone : "",
    brandColors: typeof settings?.brandColors === "string" ? settings.brandColors : "",
    brandDos: typeof settings?.brandDos === "string" ? settings.brandDos : "",
    brandDonts: typeof settings?.brandDonts === "string" ? settings.brandDonts : "",
    brandReferenceImageUrls: repairedRefs.urls,
    brandLabelReferenceUrl:
      typeof settings?.brandLabelReferenceUrl === "string" ? settings.brandLabelReferenceUrl : "",
    brandAnalyzedAt: typeof settings?.brandAnalyzedAt === "string" ? settings.brandAnalyzedAt : undefined,
  };

  // Wichtig: KEIN Schreib-Side-Effect mehr im GET — der Repair-Status wird nur
  // als `brandReferenceImagesStale` ans UI gegeben. Persistente Reparatur
  // passiert beim naechsten regulaeren PUT (in PUT() wird `repairedRefs.urls`
  // gespeichert).
  return NextResponse.json({
    settings: {
      ...responseSettings,
      brandReferenceImagesStale: rawReferenceUrls.length > 0 && repairedRefs.urls.length === 0,
    },
  });
}

export async function PUT(req: Request) {
  const rateError = await enforceRateLimitPersistent(req, {
    keyPrefix: "dashboard-settings",
    limit: 25,
    windowMs: 60_000,
  });
  if (rateError) return rateError;
  const originError = enforceSameOrigin(req);
  if (originError) return originError;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase ist nicht konfiguriert." }, { status: 500 });
  }

  const authProbe = await createClient();
  const {
    data: { user: probeUser },
  } = await authProbe.auth.getUser();
  if (!probeUser) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const existingSettings = sanitizeDashboardSettings(getDashboardMetadata(probeUser.user_metadata).settings);
  const mergedInput = clampBrandSettingsFields({
    ...existingSettings,
    ...(typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {}),
  });

  const parsed = settingsSchema.safeParse(mergedInput);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const detail = firstIssue ? `${firstIssue.path.join(".")}: ${firstIssue.message}` : "Validierung fehlgeschlagen";
    return NextResponse.json({ error: `Ungültige Einstellungen (${detail}).` }, { status: 400 });
  }

  const payload = parsed.data;
  const origin = new URL(req.url).origin;

  // Nach Website-Scan kann analyze-url Metadata bereits aktualisiert haben — JWT ist oft noch stale.
  let latestMetadata: unknown = probeUser.user_metadata;
  try {
    const admin = createAdminClient();
    const { data: adminUser } = await admin.auth.admin.getUserById(probeUser.id);
    if (adminUser?.user?.user_metadata) latestMetadata = adminUser.user.user_metadata;
  } catch {
    /* Fallback: Session-Metadata */
  }

  const repairedRefs = repairBrandReferenceImageUrls(latestMetadata, origin, payload.brandReferenceImageUrls);
  const normalizedPayload = { ...payload, brandReferenceImageUrls: repairedRefs.urls };
  const merged = mergeDashboardMetadata(latestMetadata, { settings: normalizedPayload });

  const dashboard = (merged as { dashboard?: Record<string, unknown> }).dashboard;
  const keepsInternalReferenceStore = normalizedPayload.brandReferenceImageUrls.some(
    (url) => parseBrandReferenceIdFromUrl(url) !== null,
  );
  // Referenz-Store nur entfernen, wenn keine internen /api/brand/reference-image/-URLs mehr genutzt werden.
  if (dashboard && typeof dashboard === "object" && !keepsInternalReferenceStore && "brandReferenceImages" in dashboard) {
    delete dashboard.brandReferenceImages;
  }

  const userMetadata = {
    ...merged,
    full_name: payload.profileName || null,
    brewery: payload.breweryName || null,
    phone: payload.profilePhone || null,
  };

  try {
    const admin = createAdminClient();
    const { error: adminError } = await admin.auth.admin.updateUserById(probeUser.id, {
      user_metadata: userMetadata,
    });
    if (adminError) {
      console.error("[dashboard/settings] admin updateUserById failed:", adminError.message);
      return NextResponse.json(
        { error: "Einstellungen konnten nicht gespeichert werden. Bitte erneut versuchen." },
        { status: 500 },
      );
    }
  } catch (adminWriteError) {
    console.error("[dashboard/settings] admin write failed:", adminWriteError);
    return NextResponse.json(
      { error: "Einstellungen konnten nicht gespeichert werden. Bitte erneut versuchen." },
      { status: 500 },
    );
  }

  const response = NextResponse.json({ ok: true, settings: normalizedPayload });
  try {
    const supabase = createRouteHandlerClient(req, response);
    await Promise.race([
      supabase.auth.refreshSession(),
      new Promise<void>((resolve) => {
        setTimeout(resolve, 8_000);
      }),
    ]);
  } catch (refreshError) {
    console.warn("[dashboard/settings] refreshSession failed:", refreshError);
  }
  return response;
}
