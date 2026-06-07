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
    return createNoStoreRedirect(`${origin}/passwort-zuruecksetzen?error=config`, requestId);
  }

  const formData = await request.formData();
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");
  const identifier = buildCompositeIdentifier(request, ["update"]);
  const rateError = await enforceRateLimitPersistent(
    request,
    {
      keyPrefix: "auth-reset-update",
      limit: 8,
      windowMs: 60_000,
    },
    { identifier },
  );
  if (rateError) return rateError;

  if (!password || password.length < 8) {
    return createNoStoreRedirect(`${origin}/passwort-zuruecksetzen?error=weak`, requestId);
  }
  if (password !== passwordConfirm) {
    return createNoStoreRedirect(`${origin}/passwort-zuruecksetzen?error=mismatch`, requestId);
  }

  const redirectResponse = createNoStoreRedirect(`${origin}/anmelden?notice=password_updated`, requestId);
  const supabase = createRouteHandlerClient(request, redirectResponse);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return createNoStoreRedirect(`${origin}/passwort-vergessen?error=session`, requestId);
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    logAuthEvent({
      event: "reset_password_update_failed",
      level: "warn",
      requestId,
      userId: user.id,
      email: user.email,
      status: 303,
      durationMs: Date.now() - startedAt,
      meta: { reason: error.message },
    });
    return createNoStoreRedirect(`${origin}/passwort-zuruecksetzen?error=auth`, requestId);
  }

  await supabase.auth.signOut();

  logAuthEvent({
    event: "reset_password_update_success",
    requestId,
    userId: user.id,
    email: user.email,
    status: 303,
    durationMs: Date.now() - startedAt,
  });

  return redirectResponse;
}
