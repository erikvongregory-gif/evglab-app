import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { MARKETING_SITE_URL } from "@/lib/siteConfig";
import { getDashboardMetadata } from "@/lib/dashboard/metadata";
import { DashboardRedesignShell } from "@/components/ui/dashboard-redesign";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: {
    absolute: "BrewAI - Dashboard",
  },
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};

  if (!isSupabaseConfigured()) {
    return (
      <main className="relative z-10 mx-auto max-w-lg px-4 py-16">
        <h1 className="font-display text-2xl font-semibold text-zinc-900">Dashboard</h1>
        <p className="mt-4 text-zinc-600">
          Supabase ist noch nicht konfiguriert. Lege in Vercel (und lokal in{" "}
          <code className="rounded bg-zinc-100 px-1">.env.local</code>){" "}
          <code className="rounded bg-zinc-100 px-1">NEXT_PUBLIC_SUPABASE_URL</code> und{" "}
          <code className="rounded bg-zinc-100 px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> an.
        </p>
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
    const loginQuery = new URLSearchParams();
    for (const [key, raw] of Object.entries(params)) {
      if (raw === undefined) continue;
      const values = Array.isArray(raw) ? raw : [raw];
      for (const value of values) loginQuery.append(key, value);
    }
    const qs = loginQuery.toString();
    redirect(qs ? `/anmelden?${qs}` : "/anmelden");
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
    typeof user.user_metadata?.role === "string"
      ? String(user.user_metadata.role).toLowerCase()
      : "user";
  const isAdmin = userRole === "admin";

  return (
    <DashboardRedesignShell
      userEmail={user.email}
      initialProfileName={profileName}
      initialBreweryName={breweryName}
      isAdmin={isAdmin}
    />
  );
}
