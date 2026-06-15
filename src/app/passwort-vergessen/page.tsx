import type { Metadata } from "next";
import { ForgotPasswordPage } from "@/components/ui/password-reset-pages";
import { messageForForgotPassword } from "@/lib/auth/passwordResetMessages";
import { SITE } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: { absolute: "EvGlab · Passwort vergessen" },
  alternates: { canonical: `${SITE.baseUrl}/passwort-vergessen` },
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default async function PasswortVergessenPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const noticeRaw = params.notice;
  const errorRaw = params.error;
  const detailRaw = params.detail;
  const noticeCode = Array.isArray(noticeRaw) ? noticeRaw[0] : noticeRaw;
  const errorCode = Array.isArray(errorRaw) ? errorRaw[0] : errorRaw;
  const detail = Array.isArray(detailRaw) ? detailRaw[0] : detailRaw;
  const { notice } = noticeCode ? messageForForgotPassword(noticeCode) : {};
  const { error } = errorCode ? messageForForgotPassword(errorCode, detail) : {};

  return <ForgotPasswordPage notice={notice} error={error} />;
}
