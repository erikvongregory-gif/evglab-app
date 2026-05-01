import { NextResponse } from "next/server";
import { z } from "zod";
import { evaluateInvite, getInviteByToken } from "@/lib/invite/server";
import { isInviteOnlyEnabled, isSupabaseConfigured } from "@/lib/supabase/env";
import { enforceRateLimit } from "@/lib/security/requestGuards";

const verifySchema = z.object({
  token: z.string().trim().min(8).max(400),
  email: z.string().email().max(240).optional(),
});

export async function POST(req: Request) {
  const rateError = enforceRateLimit(req, { keyPrefix: "invite-verify", limit: 30, windowMs: 60_000 });
  if (rateError) return rateError;
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase ist nicht konfiguriert." }, { status: 500 });
  }
  if (!isInviteOnlyEnabled()) {
    return NextResponse.json({ ok: true, inviteOnly: false, status: "valid" });
  }

  const parsed = verifySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, status: "invalid" }, { status: 400 });
  }

  try {
    const invite = await getInviteByToken(parsed.data.token);
    const status = evaluateInvite(invite, parsed.data.email);
    return NextResponse.json({
      ok: status === "valid",
      inviteOnly: true,
      status,
      inviteEmail: invite?.email ?? null,
      role: invite?.role ?? null,
      expiresAt: invite?.expires_at ?? null,
    });
  } catch {
    return NextResponse.json({ ok: false, status: "invalid" }, { status: 500 });
  }
}
