import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimit, enforceSameOrigin } from "@/lib/security/requestGuards";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/admin/auth";
import { getDashboardMetadata, mergeDashboardMetadata } from "@/lib/dashboard/metadata";

const deleteSchema = z.object({
  ownerUserId: z.string().min(1),
  mediaId: z.string().min(1),
});

export async function GET(req: Request) {
  const rateError = enforceRateLimit(req, { keyPrefix: "admin-content-get", limit: 60, windowMs: 60_000 });
  if (rateError) return rateError;
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Kein Admin-Zugriff." }, { status: 403 });

  const client = createAdminClient();
  const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data.users ?? []).flatMap((user) => {
    const media = getDashboardMetadata(user.user_metadata).mediaLibrary ?? [];
    return media.map((item) => ({
      ownerUserId: user.id,
      ownerEmail: user.email ?? "",
      id: item.id,
      imageUrl: item.imageUrl,
      prompt: item.prompt,
      createdAt: item.createdAt,
      aspectRatio: item.aspectRatio,
      resolution: item.resolution,
      outputFormat: item.outputFormat,
    }));
  });

  return NextResponse.json({
    summary: {
      totalMedia: rows.length,
      owners: new Set(rows.map((row) => row.ownerUserId)).size,
    },
    rows: rows.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
  });
}

export async function DELETE(req: Request) {
  const rateError = enforceRateLimit(req, { keyPrefix: "admin-content-delete", limit: 30, windowMs: 60_000 });
  if (rateError) return rateError;
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Kein Admin-Zugriff." }, { status: 403 });

  const parsed = deleteSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });

  const client = createAdminClient();
  const { data, error } = await client.auth.admin.getUserById(parsed.data.ownerUserId);
  if (error || !data.user) {
    return NextResponse.json({ error: "Owner-User nicht gefunden." }, { status: 404 });
  }

  const metadata = getDashboardMetadata(data.user.user_metadata);
  const nextMedia = (metadata.mediaLibrary ?? []).filter((item) => item.id !== parsed.data.mediaId);
  const merged = mergeDashboardMetadata(data.user.user_metadata, { mediaLibrary: nextMedia });
  const { error: updateError } = await client.auth.admin.updateUserById(parsed.data.ownerUserId, {
    user_metadata: merged,
  });
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
