import { getAppBaseUrlOrigin, isSupabaseConfigured } from "@/lib/supabase/env";
import { purgeStaleAuthSession } from "@/lib/supabase/clearAuthCookies";
import { createRouteHandlerClient } from "@/lib/supabase/server";
import { createNoStoreRedirect, withRequestIdJson } from "@/lib/security/authResponses";
import { getOrCreateRequestId } from "@/lib/security/authObservability";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Notfall-Route: veraltete Supabase-Auth-Cookies löschen und zur Anmeldung leiten. */
export async function GET(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const origin = getAppBaseUrlOrigin(new URL(request.url).origin);
  const jsonMode = new URL(request.url).searchParams.get("json") === "1";

  const response = jsonMode
    ? withRequestIdJson({ ok: true }, requestId)
    : createNoStoreRedirect(`${origin}/anmelden?notice=signed_out`, requestId);

  if (!isSupabaseConfigured()) {
    return response;
  }

  const supabase = createRouteHandlerClient(request, response);
  await purgeStaleAuthSession(request, response, supabase, { allSupabase: true });
  return response;
}
