import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRouteHandlerClient } from "@/lib/supabase/server";
import { consumeInviteByToken } from "@/lib/invite/server";
import { isInviteOnlyEnabled, isSupabaseConfigured } from "@/lib/supabase/env";
import { enforceRateLimit, enforceSameOrigin } from "@/lib/security/requestGuards";

const acceptSchema = z.object({
  token: z.string().trim().min(8).max(400),
  email: z.string().email().max(240),
  password: z.string().min(6).max(200),
  brewery: z.string().trim().max(200).optional(),
});

export async function POST(req: Request) {
  const rateError = enforceRateLimit(req, { keyPrefix: "invite-accept", limit: 10, windowMs: 60_000 });
  if (rateError) return rateError;
  const originError = enforceSameOrigin(req);
  if (originError) return originError;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase ist nicht konfiguriert." }, { status: 500 });
  }
  if (!isInviteOnlyEnabled()) {
    return NextResponse.json({ error: "Invite-Only ist deaktiviert." }, { status: 400 });
  }

  const parsed = acceptSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Daten." }, { status: 400 });
  }

  const consumed = await consumeInviteByToken(parsed.data.token, parsed.data.email);
  if (!consumed.ok) {
    return NextResponse.json({ error: consumed.status }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error, data } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      brewery_name: parsed.data.brewery?.trim() || null,
      invite_role: consumed.invite.role ?? null,
      invited_account: true,
    },
  });
  if (error || !data.user) {
    return NextResponse.json({ error: "auth" }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });
  const supabase = createRouteHandlerClient(req, response);
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (signInError) {
    return NextResponse.json({ error: "auth" }, { status: 400 });
  }
  return response;
}
