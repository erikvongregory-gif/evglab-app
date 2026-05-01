import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: {
    absolute: "EvGlab - Sicherheitscode",
  },
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readValue(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function DashboardEmail2FAPage({ searchParams }: Props) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role =
    typeof user?.user_metadata?.role === "string"
      ? String(user.user_metadata.role).toLowerCase()
      : "";
  if (!user || role !== "admin") redirect("/dashboard");

  const params = (await searchParams) ?? {};
  const error = readValue(params.error);
  const notice = readValue(params.notice);

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 dark:bg-gray-950 sm:px-6">
      <section className="mx-auto mt-16 w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Sicherheitscode fürs Dashboard</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Wir haben dir einen 6-stelligen Code per E-Mail gesendet. Bitte bestätige ihn, um den Admin-Bereich im Dashboard freizuschalten.
        </p>

        {notice === "resent" ? (
          <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-300">
            Neuer Code wurde gesendet.
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
            {error === "missing_code"
              ? "Bitte gib den Code ein."
              : error === "email_failed"
                ? "Code konnte nicht erneut gesendet werden."
                : "Code ungültig oder abgelaufen. Bitte erneut versuchen."}
          </p>
        ) : null}

        <form action="/auth/admin-2fa/verify" method="post" className="mt-5 space-y-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            E-Mail-Code
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              className="mt-2 h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              required
            />
          </label>
          <button
            type="submit"
            className="inline-flex h-11 w-full items-center justify-center rounded-md bg-[#c65a20] px-4 text-sm font-medium text-white transition hover:bg-[#b14f1c]"
          >
            Dashboard freigeben
          </button>
        </form>

        <form action="/auth/admin-2fa/verify" method="post" className="mt-3">
          <input type="hidden" name="action" value="resend" />
          <button
            type="submit"
            className="inline-flex h-10 w-full items-center justify-center rounded-md border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Neuen Code senden
          </button>
        </form>
      </section>
    </main>
  );
}
