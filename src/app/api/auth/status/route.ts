import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  getPendingCookieName,
  getTrustedDeviceCookieName,
  getVerifiedCookieName,
  hasValidPending2FAForUser,
  isTrustedDeviceForUser,
  isVerified2FAForUser,
} from "@/lib/admin/emailTwoFactor";
import { hasAdminAccess } from "@/lib/auth/owner";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getOrCreateRequestId } from "@/lib/security/authObservability";
import { withRequestIdJson } from "@/lib/security/authResponses";

export async function GET(request: Request) {
  const requestId = getOrCreateRequestId(request);
  if (!isSupabaseConfigured()) {
    return withRequestIdJson({ authenticated: false, admin: false }, requestId, { status: 200 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return withRequestIdJson(
      { authenticated: false, admin: false, admin2faRequired: false, twoFactorRequired: false },
      requestId,
      { status: 200 },
    );
  }

  const cookieStore = await cookies();
  const verified = isVerified2FAForUser(cookieStore.get(getVerifiedCookieName())?.value ?? null, user.id);
  const trustedDevice = isTrustedDeviceForUser(
    cookieStore.get(getTrustedDeviceCookieName())?.value ?? null,
    user.id,
  );
  const hasPending = hasValidPending2FAForUser(cookieStore.get(getPendingCookieName())?.value ?? null, user.id);
  const twoFactorRequired = !verified && !trustedDevice && hasPending;

  return withRequestIdJson(
    {
      authenticated: true,
      admin: hasAdminAccess(user),
      // Legacy-Feldname: der inline Session-Poller liest weiterhin `admin2faRequired`.
      admin2faRequired: twoFactorRequired,
      twoFactorRequired,
    },
    requestId,
  );
}
