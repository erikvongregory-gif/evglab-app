import { deleteAccount } from "@/lib/dashboard/deleteAccount";
import { hasPassedTwoFactor } from "@/lib/auth/twoFactorSession";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimitPersistent, enforceSameOrigin } from "@/lib/security/requestGuards";

const deleteSchema = z.object({
  confirmation: z.string().trim(),
});


export async function POST(req: Request) {
  const rateError = await enforceRateLimitPersistent(req, {
    keyPrefix: "account-delete",
    limit: 5,
    windowMs: 60_000,
  });
  if (rateError) return rateError;
  const originError = enforceSameOrigin(req);
  if (originError) return originError;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase ist nicht konfiguriert." }, { status: 500 });
  }

  const parsed = deleteSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }
  if (parsed.data.confirmation !== "KONTO LÖSCHEN") {
    return NextResponse.json({ error: "Bitte gib exakt „KONTO LÖSCHEN“ ein." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && !(await hasPassedTwoFactor(user))) return NextResponse.json({ error: "Zwei-Faktor-Prüfung erforderlich.", code: "two_factor_required" }, { status: 403 });
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  try { await deleteAccount(user.id); }
  catch(error) { return NextResponse.json({error:error instanceof Error?error.message:"Löschung ausstehend."},{status:409}); }
  return NextResponse.json({ ok: true });
}
