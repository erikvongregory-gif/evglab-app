import { redirect } from "next/navigation";
import { hasAdminAccess } from "@/lib/auth/owner";
import { TWO_FACTOR_PAGE, hasPassedTwoFactor } from "@/lib/auth/twoFactorSession";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type AdminSession = {
  userId: string;
  email: string | null;
  role: string | null;
};

function readRole(role: unknown): string | null {
  return typeof role === "string" ? role.trim().toLowerCase() : null;
}

export async function getAdminSession(): Promise<AdminSession | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  if (!hasAdminAccess(user)) return null;
  if (!(await hasPassedTwoFactor(user.id))) return null;
  return { userId: user.id, email: user.email ?? null, role: readRole(user.user_metadata?.role) };
}

export async function requireAdminPageAccess(options?: { allowWithout2FA?: boolean }) {
  if (!isSupabaseConfigured()) redirect("/anmelden?error=config");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/anmelden");
  if (!hasAdminAccess(user)) redirect("/dashboard");
  if (!options?.allowWithout2FA && !(await hasPassedTwoFactor(user.id))) {
    redirect(TWO_FACTOR_PAGE);
  }
  return {
    userId: user.id,
    email: user.email ?? null,
    role: readRole(user.user_metadata?.role),
  };
}
