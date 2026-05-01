import { NextResponse } from "next/server";
import { getPendingCookieName, getVerifiedCookieName } from "@/lib/admin/emailTwoFactor";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { enforceSameOrigin } from "@/lib/security/requestGuards";
import { createNoStoreRedirect, secureCookieOptions, withRequestIdJson } from "@/lib/security/authResponses";
import { getOrCreateRequestId } from "@/lib/security/authObservability";

async function handleSignOut(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const { origin } = new URL(request.url);
  const cookieOptions = secureCookieOptions(request);
  const clearAdmin2FACookies = (response: NextResponse) => {
    response.cookies.set(getPendingCookieName(), "", {
      httpOnly: true,
      ...cookieOptions,
      maxAge: 0,
    });
    response.cookies.set(getVerifiedCookieName(), "", {
      httpOnly: true,
      ...cookieOptions,
      maxAge: 0,
    });
    return response;
  };
  if (!isSupabaseConfigured()) {
    const response = createNoStoreRedirect(`${origin}/`, requestId);
    return clearAdmin2FACookies(response);
  }
  const supabase = await createClient();
  await supabase.auth.signOut();
  const response = createNoStoreRedirect(`${origin}/`, requestId);
  return clearAdmin2FACookies(response);
}

export async function GET(request: Request) {
  return withRequestIdJson({ error: "Methode nicht erlaubt." }, getOrCreateRequestId(request), {
    status: 405,
  });
}

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  return handleSignOut(request);
}
