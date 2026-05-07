import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimitPersistent, enforceSameOrigin } from "@/lib/security/requestGuards";

const waitlistSchema = z.object({
  email: z.string().trim().email().max(320),
  source: z.string().trim().max(80).optional(),
});

export async function POST(req: Request) {
  try {
    const rateError = await enforceRateLimitPersistent(req, {
      keyPrefix: "waitlist-signup",
      limit: 8,
      windowMs: 60_000,
    });
    if (rateError) return rateError;

    const originError = enforceSameOrigin(req);
    if (originError) return originError;

    const parsed = waitlistSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Bitte gib eine gültige E-Mail ein." }, { status: 400 });
    }

    let supabase: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>;
    try {
      supabase = createAdminClient();
    } catch {
      supabase = await createClient();
    }
    const email = parsed.data.email.toLowerCase();
    const source = parsed.data.source || "login_waitlist";
    let { error } = await supabase.from("waitlist_signups").insert({ email, source });
    if (error?.code === "42703") {
      // Backward compatibility when "source" column is missing.
      const retry = await supabase.from("waitlist_signups").insert({ email });
      error = retry.error;
    }
    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ ok: true, duplicate: true });
      }
      if (error.code === "42P01") {
        return NextResponse.json({ error: "DB-Tabelle waitlist_signups fehlt noch." }, { status: 500 });
      }
      if (error.code === "42501") {
        return NextResponse.json({ error: "DB-Zugriff blockiert (RLS/Policy)." }, { status: 500 });
      }
      if (error.code === "PGRST205") {
        return NextResponse.json({ error: "DB-Tabelle waitlist_signups wurde nicht gefunden." }, { status: 500 });
      }
      return NextResponse.json({ error: "Eintrag fehlgeschlagen. Bitte versuch es erneut." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Eintrag fehlgeschlagen. Bitte versuch es erneut." }, { status: 500 });
  }
}
