import { NextResponse } from "next/server";
import { getAppBaseUrlOrigin, isInviteOnlyEnabled, isSupabaseConfigured } from "@/lib/supabase/env";
import { createRouteHandlerClient } from "@/lib/supabase/server";
import { createNoStoreRedirect, normalizeNextPath } from "@/lib/security/authResponses";
import { getOrCreateRequestId } from "@/lib/security/authObservability";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const { origin, searchParams } = new URL(request.url);
  const appOrigin = getAppBaseUrlOrigin(origin);
  const safeNext = normalizeNextPath(searchParams.get("next"));
  const redirectTo = `${appOrigin}/auth/callback?next=${encodeURIComponent(safeNext)}`;

  if (!isSupabaseConfigured()) {
    return createNoStoreRedirect(`${appOrigin}/anmelden?error=config`, requestId);
  }
  if (isInviteOnlyEnabled()) {
    return createNoStoreRedirect(`${appOrigin}/anmelden?error=invite_only`, requestId);
  }

  const supabaseResponse = NextResponse.redirect(new URL(redirectTo));
  supabaseResponse.headers.set("Cache-Control", "no-store, max-age=0");
  supabaseResponse.headers.set("x-request-id", requestId);

  const supabase = createRouteHandlerClient(request, supabaseResponse);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: {
        access_type: "offline",
        prompt: "select_account",
      },
    },
  });

  if (error || !data.url) {
    return createNoStoreRedirect(`${appOrigin}/anmelden?error=google`, requestId);
  }

  const redirect = NextResponse.redirect(data.url);
  redirect.headers.set("Cache-Control", "no-store, max-age=0");
  redirect.headers.set("x-request-id", requestId);
  for (const cookie of supabaseResponse.cookies.getAll()) {
    redirect.cookies.set(cookie.name, cookie.value, cookie);
  }
  return redirect;
}
