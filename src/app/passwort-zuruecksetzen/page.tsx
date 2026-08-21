import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResetPasswordSessionGate } from "@/components/auth/reset-password-session-gate";
import { messageForResetPassword } from "@/lib/auth/passwordResetMessages";
import { SITE } from "@/lib/siteConfig";
import { resolveAuthCallbackRedirect } from "@/lib/supabase/authEntryRedirect";

export const metadata: Metadata = {
  title: { absolute: "BrewAI · Passwort zurücksetzen" },
  alternates: { canonical: `${SITE.baseUrl}/passwort-zuruecksetzen` },
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default async function PasswortZuruecksetzenPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const authCallback = resolveAuthCallbackRedirect(params);
  if (authCallback) {
    redirect(authCallback);
  }

  const errorRaw = params.error;
  const errorCode = Array.isArray(errorRaw) ? errorRaw[0] : errorRaw;
  const messages = messageForResetPassword(errorCode);

  return <ResetPasswordSessionGate notice={messages.notice} error={messages.error} />;
}
