import Link from "next/link";
import type { Metadata } from "next";
import { requireAdminPageAccess } from "@/lib/admin/auth";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: {
    absolute: "EvGlab - Admin-Bereich",
  },
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default async function AdminPage() {
  const admin = await requireAdminPageAccess();
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 dark:bg-gray-950 sm:px-6">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Admin-Bereich</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Monitoring & Management für Nutzer, Billing, Team und Inhalte.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-medium text-[#c65a20] dark:bg-orange-900/30 dark:text-orange-300">
              {admin.email ?? "admin"}
            </span>
            <Link
              href="/dashboard"
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Zum Dashboard
            </Link>
          </div>
        </div>
        <AdminDashboard />
      </div>
    </main>
  );
}
