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
  const err = params.error;
  const ntc = params.notice;
  const urlError = Array.isArray(err) ? err[0] : err;
  const urlNotice = Array.isArray(ntc) ? ntc[0] : ntc;

  return (
    <div className="min-h-[100dvh] bg-background text-foreground antialiased">
      <LoginForm
        urlError={typeof urlError === "string" ? urlError : undefined}
        urlNotice={typeof urlNotice === "string" ? urlNotice : undefined}
      />
    </div>
  );
}
