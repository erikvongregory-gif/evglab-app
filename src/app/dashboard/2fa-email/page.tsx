import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getPendingCookieName, hasValidPending2FAForUser } from "@/lib/admin/emailTwoFactor";
import { isOwnerUser } from "@/lib/auth/owner";
import { normalizeNextPath } from "@/lib/security/authResponses";
import { createClient } from "@/lib/supabase/server";
import { SecurityCodeCard } from "@/components/ui/security-code-card";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: {
    absolute: "BrewAI · Sicherheitscode",
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
  if (!user) redirect("/anmelden");

  const params = (await searchParams) ?? {};
  const error = readValue(params.error);
  const notice = readValue(params.notice);
  const next = normalizeNextPath(readValue(params.next));

  const cookieStore = await cookies();
  const pendingToken = cookieStore.get(getPendingCookieName())?.value ?? null;
  const hasPendingCode = hasValidPending2FAForUser(pendingToken, user.id);
  const ownerHasBackupCode = isOwnerUser(user) && Boolean(process.env.OWNER_2FA_BACKUP_CODE);
  const devMailForward =
    process.env.NODE_ENV === "development" ? process.env.RESEND_DEV_FORWARD_TO?.trim() : undefined;
  const showDevForward =
    Boolean(devMailForward) &&
    Boolean(user.email) &&
    devMailForward!.toLowerCase() !== user.email!.trim().toLowerCase();

  return (
    <SecurityCodeCard
      email={user.email ?? ""}
      nextPath={next}
      hasPendingCode={hasPendingCode}
      ownerHasBackupCode={ownerHasBackupCode}
      showDevForward={showDevForward}
      devForwardTo={devMailForward}
      notice={notice}
      error={error}
    />
  );
}
