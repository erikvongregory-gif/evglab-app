import type { Metadata } from "next";
import { Suspense } from "react";
import { SITE } from "@/lib/siteConfig";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: {
    absolute: "EvGlab - Registrierung",
  },
  alternates: {
    canonical: `${SITE.baseUrl}/registrieren`,
  },
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default function RegistrierenPage() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-gray-50 px-4 py-12 dark:bg-gray-950">
      <Suspense
        fallback={
          <div className="mx-auto w-full max-w-sm rounded-xl border bg-white p-6 text-center text-sm text-zinc-600 dark:border-gray-800 dark:bg-gray-900 dark:text-zinc-400">
            Wird geladen …
          </div>
        }
      >
        <RegisterForm />
      </Suspense>
    </main>
  );
}
