import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { MARKETING_SITE_URL } from "@/lib/siteConfig";
import { getDashboardMetadata } from "@/lib/dashboard/metadata";
import { needsFullOnboardingFlow, sanitizeStudioOnboardingState } from "@/lib/dashboard/onboarding";
import { getBrandProfileFromMetadata, isBrandProfileActive, isBrandProfileComplete } from "@/lib/dashboard/brandProfile";
import { isOwnerUser } from "@/lib/auth/owner";
import { ensureBillingRow, getBillingRow } from "@/lib/billing/store";
import { hasActiveSubscription } from "@/lib/billing/access";
import { syncBillingFromStripe } from "@/lib/billing/stripeSync";
import { CreateContentLockedView } from "@/components/studio/create-content-locked-view";
import { InhalteErstellenRedesign } from "@/components/ui/inhalte-erstellen-redesign";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: {
    absolute: "BrewAI - Bilder Erstellen",
  },
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default async function InhalteErstellenPage() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="relative z-10 mx-auto max-w-lg px-4 py-16">
        <h1 className="font-display text-2xl font-semibold text-zinc-900">Bilder Erstellen</h1>
        <p className="mt-4 text-zinc-600">Supabase ist noch nicht konfiguriert.</p>
        <a href={MARKETING_SITE_URL} className="mt-6 inline-block text-sm font-medium text-[#c65a20] hover:underline">
          Zur Startseite
        </a>
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/anmelden");
  }

  if (
    needsFullOnboardingFlow(
      sanitizeStudioOnboardingState(getDashboardMetadata(user.user_metadata).onboarding),
    )
  ) {
    redirect("/onboarding");
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

  const brandProfile = getBrandProfileFromMetadata(user.user_metadata);

  // Owner brauchen kein Stripe-Abo — Tokens und API-Guards sind separat freigeschaltet.
  if (!isOwnerUser(user)) {
    await ensureBillingRow(user.id);
    let billing = await getBillingRow(user.id);
    if (!hasActiveSubscription(billing)) {
      try {
        const syncResult = await syncBillingFromStripe({
          userId: user.id,
          userEmail: user.email,
          currentRow: billing,
        });
        if (syncResult.synced) {
          billing = await getBillingRow(user.id);
        }
      } catch {
        /* Stripe optional */
      }
    }

    if (!hasActiveSubscription(billing)) {
      return <CreateContentLockedView />;
    }
  }

  return (
    <InhalteErstellenRedesign
      userEmail={user.email}
      initialProfileName={profileName}
      initialBreweryName={breweryName}
      brandProfileComplete={isBrandProfileComplete(brandProfile)}
      brandProfileActive={isBrandProfileActive(brandProfile)}
      brandProfileMode={brandProfile.brandProfileMode}
    />
  );
}
