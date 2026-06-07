import type { Metadata } from "next";
import { Suspense } from "react";
import { SITE } from "@/lib/siteConfig";
import { AdminLoginForm } from "./admin-login-form";

export const metadata: Metadata = {
  title: {
    absolute: "EvGlab · Admin-Anmeldung",
  },
  alternates: {
    canonical: `${SITE.baseUrl}/admin/anmelden`,
  },
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default async function AdminAnmeldenPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const err = params.error;
  const ntc = params.notice;
  const urlError = Array.isArray(err) ? err[0] : err;
  const urlNotice = Array.isArray(ntc) ? ntc[0] : ntc;

  return (
    <Suspense fallback={null}>
      <AdminLoginForm
        urlError={typeof urlError === "string" ? urlError : undefined}
        urlNotice={typeof urlNotice === "string" ? urlNotice : undefined}
      />
    </Suspense>
  );
}
