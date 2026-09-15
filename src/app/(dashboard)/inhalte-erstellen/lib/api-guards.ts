import { workspaceResourceUser } from "@/lib/dashboard/workspace";
import { hasPassedTwoFactor } from "@/lib/auth/twoFactorSession";
import { NextResponse } from "next/server";
import { requireActiveSubscription } from "@/lib/billing/access";
import { enforceRateLimitPersistent, enforceSameOrigin } from "@/lib/security/requestGuards";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type ApiGuardResult =
  | {
      ok: true;
      userId: string;
      userMetadata: unknown;
    }
  | {
      ok: false;
      response: NextResponse;
    };

export async function requireImageGenerationUser(req: Request, keyPrefix: string): Promise<ApiGuardResult> {
  const originError = enforceSameOrigin(req);
  if (originError) return { ok: false, response: originError };

  if (!isSupabaseConfigured()) {
    return { ok: false, response: NextResponse.json({ error: "Supabase ist nicht konfiguriert." }, { status: 500 }) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Nicht angemeldet.", code: "auth_required" }, { status: 401 }) };
  }

  if (!(await hasPassedTwoFactor(user.id))) return { ok: false, response: NextResponse.json({ error: "Zwei-Faktor-Prüfung erforderlich.", code: "two_factor_required" }, { status: 403 }) };

  const hourly = await enforceRateLimitPersistent(
    req,
    { keyPrefix: `${keyPrefix}:hour`, limit: 30, windowMs: 60 * 60 * 1000 },
    { identifierParts: [user.id] },
  );
  if (hourly) return { ok: false, response: hourly };

  const daily = await enforceRateLimitPersistent(
    req,
    { keyPrefix: `${keyPrefix}:day`, limit: 100, windowMs: 24 * 60 * 60 * 1000 },
    { identifierParts: [user.id] },
  );
  if (daily) return { ok: false, response: daily };

  try {
    const resource = await workspaceResourceUser(user, !["GET", "HEAD"].includes(req.method));
    return { ok: true, userId: resource.id, userMetadata: resource.user_metadata };
  } catch { return { ok: false, response: NextResponse.json({error:"Teamzugriff nicht erlaubt."},{status:403}) }; }
}

export async function requireAuthenticatedUser(req: Request, keyPrefix: string): Promise<ApiGuardResult> {
  const originError = enforceSameOrigin(req);
  if (originError) return { ok: false, response: originError };

  if (!isSupabaseConfigured()) {
    return { ok: false, response: NextResponse.json({ error: "Supabase ist nicht konfiguriert." }, { status: 500 }) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Nicht angemeldet.", code: "auth_required" }, { status: 401 }) };
  }

  if (!(await hasPassedTwoFactor(user.id))) return { ok: false, response: NextResponse.json({ error: "Zwei-Faktor-Prüfung erforderlich.", code: "two_factor_required" }, { status: 403 }) };

  const rateError = await enforceRateLimitPersistent(
    req,
    { keyPrefix, limit: 60, windowMs: 60_000 },
    { identifierParts: [user.id] },
  );
  if (rateError) return { ok: false, response: rateError };

  try {
    const resource = await workspaceResourceUser(user, !["GET", "HEAD"].includes(req.method));
    return { ok: true, userId: resource.id, userMetadata: resource.user_metadata };
  } catch { return { ok: false, response: NextResponse.json({error:"Teamzugriff nicht erlaubt."},{status:403}) }; }
}

/** Bildgenerierung: Auth + Rate-Limit + aktives Abo. */
export async function requireBillableImageGenerationUser(req: Request, keyPrefix: string): Promise<ApiGuardResult> {
  const guard = await requireImageGenerationUser(req, keyPrefix);
  if (!guard.ok) return guard;

  const subscriptionError = await requireActiveSubscription(guard.userId);
  if (subscriptionError) {
    return { ok: false, response: subscriptionError };
  }

  return guard;
}

export function buildValidationError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
