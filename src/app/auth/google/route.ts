import { getAppBaseUrlOrigin, isInviteOnlyEnabled, isSupabaseConfigured } from "@/lib/supabase/env";
import { createAuthRouteHandlerClient } from "@/lib/supabase/server";
import { createNoStoreRedirect, createRedirectWithCookies, normalizeNextPath } from "@/lib/security/authResponses";
import { getOrCreateRequestId } from "@/lib/security/authObservability";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const { origin, searchParams } = new URL(request.url);
  const appOrigin = getAppBaseUrlOrigin(origin);
  const safeNext = normalizeNextPath(searchParams.get("next"));
  const redirectTo =
    safeNext === "/dashboard"
      ? `${appOrigin}/auth/callback`
      : `${appOrigin}/auth/callback?next=${encodeURIComponent(safeNext)}`;

  if (!isSupabaseConfigured()) {
    return createNoStoreRedirect(`${appOrigin}/anmelden?error=config`, requestId);
  }
  if (isInviteOnlyEnabled()) {
    return createNoStoreRedirect(`${appOrigin}/anmelden?error=invite_only`, requestId);
  }

  const cookieJar = createNoStoreRedirect(`${appOrigin}/anmelden`, requestId);
  const supabase = await createAuthRouteHandlerClient(cookieJar);
  // Clear any prior session so Google account-switch cannot inherit the old identity.
  const {
    data: { user: existingUser },
  } = await supabase.auth.getUser();
  if (existingUser) {
    await supabase.auth.signOut();
  }
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true },
  });

  if (error || !data.url) {
    return createNoStoreRedirect(`${appOrigin}/anmelden?error=google`, requestId);
  }

  return createRedirectWithCookies(data.url, requestId, cookieJar);
}
