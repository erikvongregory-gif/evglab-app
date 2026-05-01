import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getVerifiedCookieName, isVerified2FAForUser } from "@/lib/admin/emailTwoFactor";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type AdminSession = {
  userId: string;
  email: string | null;
  role: string | null;
};

export async function getAdminSession(): Promise<AdminSession | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const role =
    typeof user.user_metadata?.role === "string"
      ? String(user.user_metadata.role).toLowerCase()
      : null;
  if (role !== "admin") return null;
  const cookieStore = await cookies();
  const verifiedToken = cookieStore.get(getVerifiedCookieName())?.value ?? null;
  if (!isVerified2FAForUser(verifiedToken, user.id)) return null;
  return { userId: user.id, email: user.email ?? null, role };
}

export async function requireAdminPageAccess(options?: { allowWithout2FA?: boolean }) {
  if (!isSupabaseConfigured()) redirect("/?auth=signin&error=config");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/?auth=signin");
  const role =
    typeof user.user_metadata?.role === "string"
      ? String(user.user_metadata.role).toLowerCase()
      : null;
  if (role !== "admin") redirect("/dashboard");
  if (!options?.allowWithout2FA) {
    const cookieStore = await cookies();
    const verifiedToken = cookieStore.get(getVerifiedCookieName())?.value ?? null;
    if (!isVerified2FAForUser(verifiedToken, user.id)) redirect("/dashboard/2fa-email");
  }
  return {
    userId: user.id,
    email: user.email ?? null,
    role,
  };
}
