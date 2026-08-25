import { redirect } from "next/navigation";
import { Suspense } from "react";
import { StudioLayoutFallback, StudioWorkspaceShell } from "@/components/studio/studio-workspace-shell";
import { hasAdminAccess, isOwnerUser } from "@/lib/auth/owner";
import { TWO_FACTOR_PAGE, hasPassedTwoFactor } from "@/lib/auth/twoFactorSession";
import { getDashboardMetadata } from "@/lib/dashboard/metadata";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export default async function StudioDashboardLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) {
    return children;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return children;
  }

  // 2FA ist fuer jedes Konto Pflicht — hier greift sie fuer alle Studio-Bereiche.
  if (!(await hasPassedTwoFactor(user.id))) {
    redirect(TWO_FACTOR_PAGE);
  }

  const dashboard = getDashboardMetadata(user.user_metadata);
  const settings = dashboard.settings as Record<string, unknown> | undefined;
  const profileName =
    typeof settings?.profileName === "string"
      ? settings.profileName
      : typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : undefined;
  const breweryName =
    typeof settings?.breweryName === "string"
      ? settings.breweryName
      : typeof user.user_metadata?.brewery === "string"
        ? user.user_metadata.brewery
        : undefined;
  const isAdmin = hasAdminAccess(user);
  const isOwner = isOwnerUser(user);

  return (
    <Suspense fallback={<StudioLayoutFallback />}>
      <StudioWorkspaceShell
        userEmail={user.email}
        initialProfileName={profileName}
        initialBreweryName={breweryName}
        isAdmin={isAdmin}
        initialHasActivePlan={isOwner}
      >
        {children}
      </StudioWorkspaceShell>
    </Suspense>
  );
}
