import { Suspense } from "react";
import { StudioLayoutFallback, StudioWorkspaceShell } from "@/components/studio/studio-workspace-shell";
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
  const userRole =
    typeof user.user_metadata?.role === "string" ? String(user.user_metadata.role).toLowerCase() : "user";
  const isAdmin = userRole === "admin";

  return (
    <Suspense fallback={<StudioLayoutFallback />}>
      <StudioWorkspaceShell
        userEmail={user.email}
        initialProfileName={profileName}
        initialBreweryName={breweryName}
        isAdmin={isAdmin}
      >
        {children}
      </StudioWorkspaceShell>
    </Suspense>
  );
}
