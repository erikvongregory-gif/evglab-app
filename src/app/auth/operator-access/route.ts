import { NextResponse } from "next/server";
import {
  isWaitlistBypassConfigured,
  isWaitlistBypassTokenValid,
  setWaitlistBypassCookie,
} from "@/lib/auth/waitlistBypass";
import { getAppBaseUrlOrigin } from "@/lib/supabase/env";

export async function GET(request: Request) {
  const origin = getAppBaseUrlOrigin(new URL(request.url).origin);
  const token = new URL(request.url).searchParams.get("token");

  if (!isWaitlistBypassConfigured() || !isWaitlistBypassTokenValid(token)) {
    const denied = NextResponse.redirect(`${origin}/anmelden?waitlist=1`, 307);
    denied.headers.set("Cache-Control", "no-store, max-age=0");
    return denied;
  }

  const response = NextResponse.redirect(`${origin}/anmelden`, 307);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return setWaitlistBypassCookie(response);
}
