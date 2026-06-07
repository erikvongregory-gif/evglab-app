import { NextResponse } from "next/server";
import { repairOversizedMetadataForUser } from "@/lib/auth/repairOversizedMetadata";
import { authMetadataLikelyOversized } from "@/lib/auth/pruneAuthMetadata";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getOrCreateRequestId } from "@/lib/security/authObservability";
import { withRequestIdJson } from "@/lib/security/authResponses";

export async function POST(request: Request) {
  const requestId = getOrCreateRequestId(request);
  if (!isSupabaseConfigured()) {
    return withRequestIdJson({ ok: false, reason: "config" }, requestId, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return withRequestIdJson({ ok: false, reason: "unauthenticated" }, requestId, { status: 401 });
  }

  if (!authMetadataLikelyOversized(user.user_metadata)) {
    await supabase.auth.refreshSession().catch(() => undefined);
    return withRequestIdJson({ ok: true, repaired: false }, requestId);
  }

  const repaired = await repairOversizedMetadataForUser(supabase, user.id, user.user_metadata);
  return withRequestIdJson({ ok: repaired, repaired }, requestId);
}
