import { redirect } from "next/navigation";
import { Suspense } from "react";
import type { Viewport } from "next";
import { cookies } from "next/headers";
import {
  BrewAiAdminLayoutFallback,
  BrewAiAdminShell,
} from "@/components/dashboard-shell/brewai-admin-shell";
import { hasAdminAccess, isOwnerUser } from "@/lib/auth/owner";
import { TWO_FACTOR_PAGE, hasPassedTwoFactor } from "@/lib/auth/twoFactorSession";
import { getFreshUserDashboardMetadata } from "@/lib/dashboard/freshMetadata";
import { needsFullOnboardingFlow, sanitizeStudioOnboardingState } from "@/lib/dashboard/onboarding";
import { PREFERENCE_DEFAULTS } from "@/lib/preferences/preferences-config";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { getPreference } from "@/server/server-actions";
import { PreferencesStoreProvider } from "@/stores/preferences/preferences-provider";

export const viewport: Viewport = {
  themeColor: "#ffffff",
  viewportFit: "cover",
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

  if (!(await hasPassedTwoFactor(user))) {
    redirect(TWO_FACTOR_PAGE);
  }

  const dashboard = await getFreshUserDashboardMetadata(user.id, user.user_metadata);
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

  void hasAdminAccess(user);
  void isOwnerUser(user);

  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";
  const [variant, collapsible] = await Promise.all([
    getPreference("sidebar_variant"),
    getPreference("sidebar_collapsible"),
  ]);

  return (
    <PreferencesStoreProvider
      initialValues={{
        ...PREFERENCE_DEFAULTS,
        sidebar_variant: variant,
        sidebar_collapsible: collapsible,
      }}
    >
      <Suspense fallback={<BrewAiAdminLayoutFallback />}>
        <BrewAiAdminShell
          userEmail={user.email}
          initialProfileName={profileName}
          initialBreweryName={breweryName}
          defaultSidebarOpen={defaultOpen}
          sidebarVariant={variant}
          sidebarCollapsible={collapsible}
        >
          {children}
        </BrewAiAdminShell>
      </Suspense>
    </PreferencesStoreProvider>
  );
}
