import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthLinkBootstrap } from "@/components/auth/auth-link-bootstrap";
import { SITE } from "@/lib/siteConfig";
import { resolveAuthCallbackRedirect } from "@/lib/supabase/authEntryRedirect";
import { isInviteOnlyEnabled } from "@/lib/supabase/env";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: {
    absolute: "EvGlab · Anmelden",
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
  const authCallback = resolveAuthCallbackRedirect(params);
  if (authCallback) {
    redirect(authCallback);
  }

  const err = params.error;
  const ntc = params.notice;
  const modeRaw = params.mode;
  const inviteRaw = params.invite;
  const planRaw = params.plan;
  const checkoutRaw = params.checkout;
  const sourceRaw = params.source;
  const urlError = Array.isArray(err) ? err[0] : err;
  const urlNotice = Array.isArray(ntc) ? ntc[0] : ntc;
  const mode = Array.isArray(modeRaw) ? modeRaw[0] : modeRaw;
  const invite = Array.isArray(inviteRaw) ? inviteRaw[0] : inviteRaw;
  const plan = Array.isArray(planRaw) ? planRaw[0] : planRaw;
  const checkout = Array.isArray(checkoutRaw) ? checkoutRaw[0] : checkoutRaw;
  const source = Array.isArray(sourceRaw) ? sourceRaw[0] : sourceRaw;
  const allowedPlan = plan === "start" || plan === "growth" || plan === "pro" ? plan : null;
  const shouldAutoCheckout = allowedPlan && checkout === "1" && source === "homepage_pricing";
  const nextPath = shouldAutoCheckout
    ? `/dashboard?plan=${allowedPlan}&checkout=1&source=homepage_pricing&tab=pricing`
    : "/dashboard";
  const registerErrors = new Set([
    "invite_required",
    "invite_expired",
    "invite_used",
    "invite_invalid",
    "invite_email_mismatch",
  ]);
  const initialMode =
    mode === "register" || (urlError && registerErrors.has(urlError)) ? "register" : "signin";

  return (
    <Suspense fallback={null}>
      <AuthLinkBootstrap searchParams={params} />
      <LoginForm
        nextPath={nextPath}
        initialMode={initialMode}
        inviteToken={typeof invite === "string" ? invite : undefined}
        inviteOnly={isInviteOnlyEnabled()}
        urlError={typeof urlError === "string" ? urlError : undefined}
        urlNotice={typeof urlNotice === "string" ? urlNotice : undefined}
      />
    </Suspense>
  );
}
