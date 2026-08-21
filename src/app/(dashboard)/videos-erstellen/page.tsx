import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { MARKETING_SITE_URL } from "@/lib/siteConfig";
import { ensureBillingRow, getBillingRow } from "@/lib/billing/store";
import { hasActiveSubscription } from "@/lib/billing/access";
import { syncBillingFromStripe } from "@/lib/billing/stripeSync";
import { isVideosCreateEnabled } from "@/lib/featureFlags";
import { CreateContentLockedView } from "@/components/studio/create-content-locked-view";
import { CreateVideosComingSoonView } from "@/components/studio/create-videos-coming-soon-view";
import { CreateVideosView } from "@/components/studio/create-videos-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: {
    absolute: "BrewAI - Videos Erstellen",
  },
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default async function VideosErstellenPage() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="relative z-10 mx-auto max-w-lg px-4 py-16">
        <h1 className="font-display text-2xl font-semibold text-zinc-900">Videos Erstellen</h1>
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

  if (!isVideosCreateEnabled()) {
    return <CreateVideosComingSoonView />;
  }

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
    return <CreateContentLockedView feature="videos" />;
  }

  const dashboard = (user.user_metadata?.dashboard ?? {}) as Record<string, unknown>;
  const settings = dashboard.settings as Record<string, unknown> | undefined;
  const breweryName =
    typeof settings?.breweryName === "string"
      ? settings.breweryName
      : typeof user.user_metadata?.brewery === "string"
        ? user.user_metadata.brewery
        : undefined;

  return <CreateVideosView breweryName={breweryName} />;
}
