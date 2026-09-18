import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { hasPassedTwoFactor } from "@/lib/auth/twoFactorSession";
import { getWorkspaceInvitePreview } from "@/lib/dashboard/teamInvitePreview";
import { TeamInviteAccept } from "@/components/ui/team-invite-accept";
import { SITE } from "@/lib/siteConfig";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    absolute: "BrewAI · Team-Einladung",
  },
  alternates: {
    canonical: `${SITE.baseUrl}/invite/team`,
  },
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

type Props = {
  params: Promise<{ token: string }>;
};

export default async function AcceptTeamInvitationPage({ params }: Props) {
  const { token: raw } = await params;
  const token = Array.isArray(raw) ? raw[0] : raw;
  const invite = await getWorkspaceInvitePreview(token);

  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  const sessionEmail = user?.email ?? null;
  const needsTwoFactor = Boolean(user && !(await hasPassedTwoFactor(user)));

  return (
    <TeamInviteAccept
      token={token}
      invite={invite}
      sessionEmail={sessionEmail}
      needsTwoFactor={needsTwoFactor}
    />
  );
}
