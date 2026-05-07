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
  const planRaw = params.plan;
  const checkoutRaw = params.checkout;
  const sourceRaw = params.source;
  const urlError = Array.isArray(err) ? err[0] : err;
  const urlNotice = Array.isArray(ntc) ? ntc[0] : ntc;
  const plan = Array.isArray(planRaw) ? planRaw[0] : planRaw;
  const checkout = Array.isArray(checkoutRaw) ? checkoutRaw[0] : checkoutRaw;
  const source = Array.isArray(sourceRaw) ? sourceRaw[0] : sourceRaw;
  const allowedPlan = plan === "start" || plan === "growth" || plan === "pro" ? plan : null;
  const shouldAutoCheckout = allowedPlan && checkout === "1" && source === "homepage_pricing";
  const nextPath = shouldAutoCheckout
    ? `/dashboard?plan=${allowedPlan}&checkout=1&source=homepage_pricing`
    : "/dashboard";

  return (
    <div className="min-h-[100dvh] bg-background text-foreground antialiased">
      <LoginForm
        nextPath={nextPath}
        urlError={typeof urlError === "string" ? urlError : undefined}
        urlNotice={typeof urlNotice === "string" ? urlNotice : undefined}
      />
    </div>
  );
}
