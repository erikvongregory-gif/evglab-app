import { redirect } from "next/navigation";
import { Suspense } from "react";
import type { Viewport } from "next";
import { StudioLayoutFallback, StudioWorkspaceShell } from "@/components/studio/studio-workspace-shell";
import { hasAdminAccess, isOwnerUser } from "@/lib/auth/owner";
import { TWO_FACTOR_PAGE, hasPassedTwoFactor } from "@/lib/auth/twoFactorSession";
import { getFreshUserDashboardMetadata } from "@/lib/dashboard/freshMetadata";
import { needsFullOnboardingFlow, sanitizeStudioOnboardingState } from "@/lib/dashboard/onboarding";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const viewport: Viewport = {
  themeColor: "#F6F6F4",
};

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
  if (!(await hasPassedTwoFactor(user))) {
    redirect(TWO_FACTOR_PAGE);
  }

  const dashboard = await getFreshUserDashboardMetadata(user.id, user.user_metadata);
  // Vor der Shell umleiten — sonst kurz Dashboard, dann Redirect/Popup.
  if (needsFullOnboardingFlow(sanitizeStudioOnboardingState(dashboard.onboarding))) {
    redirect("/onboarding");
  }
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
