import { handleAuthCallbackGet } from "@/lib/supabase/oauthCallback";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return handleAuthCallbackGet(request);
}
