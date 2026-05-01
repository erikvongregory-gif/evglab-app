import type { EmailOtpType } from "@supabase/supabase-js";
import { isInviteOnlyEnabled, isSupabaseConfigured } from "@/lib/supabase/env";
import { createRouteHandlerClient } from "@/lib/supabase/server";
import { createNoStoreRedirect, normalizeNextPath } from "@/lib/security/authResponses";
import { getOrCreateRequestId, logAuthEvent, withTimeout } from "@/lib/security/authObservability";

export async function GET(request: Request) {
  const startedAt = Date.now();
  const requestId = getOrCreateRequestId(request);
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const safeNext = normalizeNextPath(searchParams.get("next"));

  if (!isSupabaseConfigured()) {
    return createNoStoreRedirect(`${origin}/?auth=signin&error=config`, requestId);
  }
  if (isInviteOnlyEnabled() && type === "signup") {
    return createNoStoreRedirect(`${origin}/?auth=signin&error=invite_required`, requestId);
  }

  if (tokenHash && type) {
    const redirectResponse = createNoStoreRedirect(`${origin}${safeNext}`, requestId);
    const supabase = createRouteHandlerClient(request, redirectResponse);
    const { error } = await withTimeout(
      supabase.auth.verifyOtp({ type, token_hash: tokenHash }),
      6_000,
      "auth_callback_verify_timeout",
    );
    if (!error) return redirectResponse;
  }

  if (code) {
    const redirectResponse = createNoStoreRedirect(`${origin}${safeNext}`, requestId);
    const supabase = createRouteHandlerClient(request, redirectResponse);
    try {
      const { error } = await withTimeout(
        supabase.auth.exchangeCodeForSession(code),
        6_000,
        "auth_callback_exchange_timeout",
      );
      if (!error) return redirectResponse;
    } catch {
      logAuthEvent({
        event: "callback_timeout",
        level: "warn",
        requestId,
        status: 303,
        durationMs: Date.now() - startedAt,
      });
    }
  }

  return createNoStoreRedirect(`${origin}/?auth=signin&error=auth`, requestId);
}
