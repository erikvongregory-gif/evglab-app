import type { Metadata } from "next";
import { SITE } from "@/lib/siteConfig";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: {
    absolute: "EvGlab - Anmeldung",
  },
  alternates: {
    canonical: `${SITE.baseUrl}/anmelden`,
  },
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default async function AnmeldenPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const raw = params.error ?? params.notice;
  const urlError = Array.isArray(raw) ? raw[0] : raw;

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-gray-50 px-4 py-12 dark:bg-gray-950">
      <LoginForm urlError={typeof urlError === "string" ? urlError : undefined} />
    </main>
  );
}
