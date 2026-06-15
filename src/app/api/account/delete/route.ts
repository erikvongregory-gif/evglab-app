import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { getBillingRow } from "@/lib/billing/store";
import { getStripeClient } from "@/lib/billing/stripeServer";
import { enforceRateLimitPersistent, enforceSameOrigin } from "@/lib/security/requestGuards";

const deleteSchema = z.object({
  confirmation: z.string().trim(),
});

function getOptionalStripeClient() {
  try {
    return getStripeClient();
  } catch {
    return null;
  }
}

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
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const admin = createAdminClient();
  const billing = await getBillingRow(user.id).catch(() => null);
  const subscriptionId = billing?.stripe_subscription_id ?? null;

  if (subscriptionId) {
    const stripe = getOptionalStripeClient();
    if (stripe) {
      try {
        await stripe.subscriptions.cancel(subscriptionId);
      } catch {
        return NextResponse.json(
          { error: "Abo konnte nicht beendet werden. Bitte versuche es erneut oder kontaktiere den Support." },
          { status: 502 },
        );
      }
    }
  }

  await admin.from("billing_subscriptions").delete().eq("user_id", user.id);

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    return NextResponse.json({ error: "Konto konnte nicht gelöscht werden." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
