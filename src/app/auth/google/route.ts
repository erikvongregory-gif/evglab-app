import { NextResponse } from "next/server";
import { isInviteOnlyEnabled, isSupabaseConfigured } from "@/lib/supabase/env";
import { createRouteHandlerClient } from "@/lib/supabase/server";
import { createNoStoreRedirect, normalizeNextPath } from "@/lib/security/authResponses";
import { getOrCreateRequestId } from "@/lib/security/authObservability";

export async function GET(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const { origin, searchParams } = new URL(request.url);
  const safeNext = normalizeNextPath(searchParams.get("next"));

  if (!isSupabaseConfigured()) {
    return createNoStoreRedirect(`${origin}/?auth=signin&error=config`, requestId);
  }
  if (isInviteOnlyEnabled()) {
    return createNoStoreRedirect(`${origin}/?auth=signin&error=invite_only`, requestId);
  }

  const cookieCarrier = NextResponse.next();
  const supabase = createRouteHandlerClient(request, cookieCarrier);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}`,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error || !data.url) {
    return createNoStoreRedirect(`${origin}/?auth=signin&error=google`, requestId);
  }

  const redirect = createNoStoreRedirect(data.url, requestId);
  for (const line of cookieCarrier.headers.getSetCookie()) {
    redirect.headers.append("Set-Cookie", line);
  }
  return redirect;
}
