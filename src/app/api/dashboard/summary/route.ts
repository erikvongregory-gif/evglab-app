import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { ensureBillingRow, getBillingRow } from "@/lib/billing/store";
import { getDashboardMetadata } from "@/lib/dashboard/metadata";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase ist nicht konfiguriert." }, { status: 500 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  let billing = null as Awaited<ReturnType<typeof getBillingRow>>;
  let degradedBilling = false;
  try {
    await ensureBillingRow(user.id);
    billing = await getBillingRow(user.id);
  } catch (error) {
    degradedBilling = true;
    console.error("dashboard.summary: billing fallback aktiv", error);
  }
  const dashboard = getDashboardMetadata(user.user_metadata);
  const media = dashboard.mediaLibrary ?? [];
  const team = dashboard.teamMembers ?? [];
  const activeCampaigns = media.length === 0 ? 0 : Math.min(6, Math.ceil(media.length / 5));

  const sortedMedia = media.slice().sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  const mediaActivities = sortedMedia.slice(0, 6).map((item) => ({
    id: item.id,
    type: "media" as const,
    title: "Bild generiert",
    desc: item.prompt.slice(0, 80),
    time: item.createdAt,
    color: "blue" as const,
  }));
  const invitedCount = team.filter((member) => member.status === "invited").length;

  const activities = [
    ...mediaActivities,
    ...(invitedCount > 0
      ? [
          {
            id: "team-invite",
            type: "team" as const,
            title: "Teameinladungen offen",
            desc: `${invitedCount} Einladung(en) warten auf Annahme`,
            time: new Date().toISOString(),
            color: "purple" as const,
          },
        ]
      : []),
  ]
    .sort((a, b) => +new Date(b.time) - +new Date(a.time))
    .slice(0, 8);

  return NextResponse.json({
    summary: {
      tokens: {
        monthly: billing?.monthly_tokens ?? 0,
        used: billing?.used_tokens ?? 0,
        remaining: Math.max((billing?.monthly_tokens ?? 0) - (billing?.used_tokens ?? 0), 0),
      },
      postsThisMonth: media.filter((item) => {
        const d = new Date(item.createdAt);
        const now = new Date();
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length,
      activeCampaigns,
      teamMembers: team.length,
      openInvites: invitedCount,
      billingStatus: billing?.subscription_status ?? "none",
      plan: billing?.plan ?? null,
      degradedBilling,
    },
    activities,
  });
}
