import { cookies } from "next/headers";
import {
  getTrustedDeviceCookieName,
  getVerifiedCookieName,
  isTrustedDeviceForUser,
  isVerified2FAForUser,
} from "@/lib/admin/emailTwoFactor";

export const TWO_FACTOR_PAGE = "/dashboard/2fa-email";

/**
 * 2FA gilt als bestanden, wenn die Session verifiziert ist oder das Gerät noch
 * innerhalb der Trusted-Device-Frist liegt.
 */
export async function hasPassedTwoFactor(userId: string): Promise<boolean> {
  const store = await cookies();
  const verified = store.get(getVerifiedCookieName())?.value ?? null;
  if (isVerified2FAForUser(verified, userId)) return true;
  const device = store.get(getTrustedDeviceCookieName())?.value ?? null;
  return isTrustedDeviceForUser(device, userId);
}

/** Zielpfad nach erfolgreicher Code-Eingabe an die 2FA-Seite weitergeben. */
export function twoFactorRedirectPath(next?: string | null): string {
  if (!next || next === "/dashboard") return TWO_FACTOR_PAGE;
  return `${TWO_FACTOR_PAGE}?next=${encodeURIComponent(next)}`;
}
