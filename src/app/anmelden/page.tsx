import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthLinkBootstrap } from "@/components/auth/auth-link-bootstrap";
import { isWaitlistBypassCookieValid } from "@/lib/auth/waitlistBypass";
import { SITE } from "@/lib/siteConfig";
import { normalizeNextPath } from "@/lib/security/authResponses";
import { resolveAuthCallbackRedirect } from "@/lib/supabase/authEntryRedirect";
import { isInviteOnlyEnabled } from "@/lib/supabase/env";
import { LOGIN_WAITLIST_ENABLED } from "@/lib/featureFlags";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: {
    absolute: "BrewAI · Anmelden",
  },
  description: SITE.defaultDescription,
  alternates: {
    canonical: `${SITE.baseUrl}/anmelden`,
  },
  openGraph: {
    title: "BrewAI · Anmelden",
    description: SITE.defaultDescription,
    url: `${SITE.baseUrl}/anmelden`,
    images: [
      {
        url: SITE.ogImage,
        width: 1200,
        height: 630,
        alt: SITE.ogImageAlt,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BrewAI · Anmelden",
    description: SITE.defaultDescription,
    images: [SITE.ogImage],
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
  const nextRaw = params.next;
  const nextFromQuery = Array.isArray(nextRaw) ? nextRaw[0] : nextRaw;
  const allowedPlan = plan === "start" || plan === "growth" || plan === "pro" || plan === "enterprise" ? plan : null;
  const shouldAutoCheckout = allowedPlan && checkout === "1" && source === "homepage_pricing";
  const nextPath = shouldAutoCheckout
    ? `/dashboard?plan=${allowedPlan}&checkout=1&source=homepage_pricing&tab=pricing`
    : normalizeNextPath(nextFromQuery);
  const emailRaw = params.email;
  const emailFromQuery = Array.isArray(emailRaw) ? emailRaw[0] : emailRaw;
  const registerErrors = new Set([
    "invite_required",
    "invite_expired",
    "invite_used",
    "invite_invalid",
    "invite_email_mismatch",
  ]);
  const forceRegisterForTeamInvite =
    nextPath.startsWith("/invite/team/") &&
    urlNotice !== "account_ready" &&
    urlNotice !== "invite_ready";
  const initialMode =
    mode === "register" ||
    mode === "signup" ||
    (urlError && registerErrors.has(urlError)) ||
    forceRegisterForTeamInvite
      ? "register"
      : "signin";

  const cookieStore = await cookies();
  const waitlistBypassActive = isWaitlistBypassCookieValid(cookieStore.get("brewai_waitlist_bypass")?.value);

  return (
    <Suspense fallback={null}>
      <AuthLinkBootstrap searchParams={params} />
      <LoginForm
        nextPath={nextPath}
        initialMode={initialMode}
        inviteToken={typeof invite === "string" ? invite : undefined}
        inviteOnly={isInviteOnlyEnabled()}
        waitlistMode={LOGIN_WAITLIST_ENABLED && !waitlistBypassActive}
        defaultEmail={typeof emailFromQuery === "string" ? emailFromQuery : undefined}
        teamInviteMode={nextPath.startsWith("/invite/team/")}
        urlError={typeof urlError === "string" ? urlError : undefined}
        urlNotice={typeof urlNotice === "string" ? urlNotice : undefined}
      />
    </Suspense>
  );
}
