import { getAppBaseUrlOrigin, isSupabaseConfigured } from "@/lib/supabase/env";
import { createRouteHandlerClient } from "@/lib/supabase/server";
import { getOrCreateRequestId, logAuthEvent } from "@/lib/security/authObservability";
import { createNoStoreRedirect } from "@/lib/security/authResponses";
import { buildCompositeIdentifier, enforceRateLimitPersistent, enforceSameOrigin } from "@/lib/security/requestGuards";

export async function POST(request: Request) {
  const startedAt = Date.now();
  const requestId = getOrCreateRequestId(request);
  const origin = getAppBaseUrlOrigin(new URL(request.url).origin);
  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  if (!isSupabaseConfigured()) {
    return createNoStoreRedirect(`${origin}/passwort-vergessen?error=config`, requestId);
  }

  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();
  const identifier = buildCompositeIdentifier(request, [email]);
  const rateError = await enforceRateLimitPersistent(
    request,
    {
      keyPrefix: "auth-reset-request",
      limit: 5,
      windowMs: 60_000,
    },
    { identifier },
  );
  if (rateError) return rateError;

  if (!email) {
    return createNoStoreRedirect(`${origin}/passwort-vergessen?error=missing`, requestId);
  }

  const redirectResponse = createNoStoreRedirect(`${origin}/passwort-vergessen?notice=sent`, requestId);
  const supabase = createRouteHandlerClient(request, redirectResponse);
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent("/passwort-zuruecksetzen")}`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) {
    logAuthEvent({
      event: "reset_password_request_failed",
      level: "warn",
      requestId,
      email,
      status: 303,
      durationMs: Date.now() - startedAt,
      meta: { reason: error.message },
    });
  } else {
    logAuthEvent({
      event: "reset_password_request_sent",
      requestId,
      email,
      status: 303,
      durationMs: Date.now() - startedAt,
    });
  }

  return redirectResponse;
}
