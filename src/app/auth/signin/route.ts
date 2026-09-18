import { redirectWithEmail2FAIfNeeded } from "@/lib/admin/postSignInAdmin2FA";
import { getAppBaseUrlOrigin, isSupabaseConfigured } from "@/lib/supabase/env";
import { mapSignInErrorCode, signInErrorDetail } from "@/lib/auth/signInErrors";
import { repairOversizedMetadataForUser } from "@/lib/auth/repairOversizedMetadata";
import { purgeStaleAuthSession } from "@/lib/supabase/clearAuthCookies";
import { createAuthRouteHandlerClient } from "@/lib/supabase/server";
import { logAuthEvent, getOrCreateRequestId } from "@/lib/security/authObservability";
import {
  createNoStoreRedirect,
  normalizeNextPath,
} from "@/lib/security/authResponses";
import { withNextParam } from "@/lib/auth/teamInviteAuth";
import { buildCompositeIdentifier, enforceRateLimitPersistent, enforceSameOrigin } from "@/lib/security/requestGuards";

export async function POST(request: Request) {
  const startedAt = Date.now();
  const requestId = getOrCreateRequestId(request);
  const origin = getAppBaseUrlOrigin(new URL(request.url).origin);
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  if (!isSupabaseConfigured()) {
    return createNoStoreRedirect(withNextParam(`${origin}/anmelden?error=config`, "/dashboard"), requestId);
  }

  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = normalizeNextPath(String(formData.get("next") ?? "/dashboard"));
  const fail = (errorCode: string, extra?: Record<string, string>) => {
    const params = new URLSearchParams({ error: errorCode, ...extra });
    if (email) params.set("email", email);
    return createNoStoreRedirect(withNextParam(`${origin}/anmelden?${params.toString()}`, next), requestId);
  };
  const identifier = buildCompositeIdentifier(request, [email]);
  const rateError = await enforceRateLimitPersistent(
    request,
    {
      keyPrefix: "auth-signin",
      limit: 8,
      windowMs: 60_000,
    },
    { identifier },
  );
  if (rateError) return rateError;

  if (!email || !password) {
    return fail("missing");
  }

  const finishTarget = `${origin}/auth/finish?next=${encodeURIComponent(next)}`;
  const redirectResponse = createNoStoreRedirect(finishTarget, requestId);

  const supabase = await createAuthRouteHandlerClient(redirectResponse);
  await purgeStaleAuthSession(request, redirectResponse, supabase);
  const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const errorCode = mapSignInErrorCode(error);
    logAuthEvent({
      event: "signin_failed",
      level: "warn",
      requestId,
      email,
      status: 303,
      durationMs: Date.now() - startedAt,
      meta: {
        reason: errorCode,
        supabaseCode: error.code,
        supabaseMessage: signInErrorDetail(error),
      },
    });
    const detail = signInErrorDetail(error);
    return fail(
      errorCode,
      process.env.NODE_ENV === "development" && detail ? { detail } : undefined,
    );
  }

  const user = signInData.user;
  if (user) {
    await repairOversizedMetadataForUser(supabase, user.id, user.user_metadata);
  }

  const twoFactor = await redirectWithEmail2FAIfNeeded(request, {
    user,
    requestId,
    origin,
    cookieSource: redirectResponse,
    startedAt,
    next,
  });
  if (twoFactor) return twoFactor;

  logAuthEvent({
    event: "signin_success",
    requestId,
    userId: user?.id,
    email: user?.email,
    status: 303,
    durationMs: Date.now() - startedAt,
  });
  // Cookies are applied before the browser follows the server-side entry check.
  return redirectResponse;
}
