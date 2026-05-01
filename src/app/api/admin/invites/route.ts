import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createInviteToken, hashInviteToken } from "@/lib/invite/server";
import { enforceRateLimit, enforceSameOrigin } from "@/lib/security/requestGuards";

const createInviteSchema = z.object({
  email: z.string().email().max(240),
  role: z.enum(["viewer", "editor", "admin"]).default("viewer"),
  expiresInDays: z.number().int().min(1).max(30).default(7),
});

export async function GET(req: Request) {
  const rateError = enforceRateLimit(req, { keyPrefix: "admin-invites-get", limit: 60, windowMs: 60_000 });
  if (rateError) return rateError;
  const adminSession = await getAdminSession();
  if (!adminSession) return NextResponse.json({ error: "Kein Admin-Zugriff." }, { status: 403 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("invites")
    .select("id,email,role,expires_at,consumed_at,created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invites: data ?? [] });
}

export async function POST(req: Request) {
  const rateError = enforceRateLimit(req, { keyPrefix: "admin-invites-post", limit: 20, windowMs: 60_000 });
  if (rateError) return rateError;
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const adminSession = await getAdminSession();
  if (!adminSession) return NextResponse.json({ error: "Kein Admin-Zugriff." }, { status: 403 });

  const parsed = createInviteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });

  const token = createInviteToken();
  const expiresAt = new Date(Date.now() + parsed.data.expiresInDays * 24 * 60 * 60 * 1000).toISOString();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("invites")
    .insert({
      email: parsed.data.email.trim().toLowerCase(),
      role: parsed.data.role,
      token_hash: hashInviteToken(token),
      expires_at: expiresAt,
      created_by: adminSession.userId,
    })
    .select("id,email,role,expires_at,created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const origin = new URL(req.url).origin;
  return NextResponse.json({
    invite: data,
    inviteUrl: `${origin}/invite/${token}`,
  });
}
