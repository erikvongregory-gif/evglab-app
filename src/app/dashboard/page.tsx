import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import nextDynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const DashboardWithSidebar = nextDynamic(
  () => import("@/components/ui/dashboard-with-collapsible-sidebar").then((mod) => mod.Example),
  {
    loading: () => (
      <main className="relative z-10 mx-auto max-w-6xl px-4 py-16">
        <div className="h-8 w-48 animate-pulse rounded bg-zinc-200" />
        <div className="mt-6 h-48 w-full animate-pulse rounded-2xl bg-zinc-100" />
      </main>
    ),
  },
);

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: {
    absolute: "EvGlab - Dashboard",
  },
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default async function DashboardPage() {
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
        <Link href="/" className="mt-6 inline-block text-sm font-medium text-[#c65a20] hover:underline">
          Zur Startseite
        </Link>
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/?auth=signin");
  }

  const userName =
    typeof user.user_metadata?.brewery === "string"
      ? user.user_metadata.brewery
      : typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : undefined;
  const userRole =
    typeof user.user_metadata?.role === "string"
      ? String(user.user_metadata.role).toLowerCase()
      : "user";
  const isAdmin = userRole === "admin";

  return <DashboardWithSidebar userEmail={user.email} userName={userName} isAdmin={isAdmin} />;
}
