import { createAdminClient } from "@/lib/supabase/admin";
import { workspaceResourceUser } from "@/lib/dashboard/workspace";
import { hasPassedTwoFactor } from "@/lib/auth/twoFactorSession";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isOwnerUser } from "@/lib/auth/owner";
import { buildOwnerBillingRow, ensureBillingRow, getBillingRow } from "@/lib/billing/store";
import { syncBillingFromStripe } from "@/lib/billing/stripeSync";
import { getDashboardMetadata } from "@/lib/dashboard/metadata";
import { readDashboardMedia } from "@/lib/dashboard/media-store";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase ist nicht konfiguriert." }, { status: 500 });
  }
  const supabase = await createClient();
  let {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && !(await hasPassedTwoFactor(user.id))) return NextResponse.json({ error: "Zwei-Faktor-Prüfung erforderlich.", code: "two_factor_required" }, { status: 403 });
  if (user) { try { user = await workspaceResourceUser(user, false); } catch { return NextResponse.json({error:"Teamzugriff nicht erlaubt."},{status:403}); } }
  if (!user) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  let billing = null as Awaited<ReturnType<typeof getBillingRow>>;
  let degradedBilling = false;
  const isOwner = isOwnerUser(user);
  try {
    if (isOwner) {
      billing = buildOwnerBillingRow(user.id);
    } else {
      await ensureBillingRow(user.id);
      billing = await getBillingRow(user.id);
    }
    if (!isOwner && (!billing?.plan || billing.subscription_status === "none" || billing.subscription_status === "canceled")) {
      try {
        const syncResult = await syncBillingFromStripe({
          userId: user.id,
          userEmail: user.email,
          currentRow: billing,
        });
        if (syncResult.synced) {
          billing = await getBillingRow(user.id);
        }
      } catch {
        /* Stripe-Sync optional; Summary liefert trotzdem */
      }
    }
  } catch (error) {
    degradedBilling = true;
    console.error("dashboard.summary: billing fallback aktiv", error);
  }
  const dashboard = getDashboardMetadata(user.user_metadata);
  const media = await readDashboardMedia(user.id).catch(() => dashboard.mediaLibrary ?? []);
  const client = createAdminClient();
  const activeMembers = await client.from("workspace_members").select("user_id").eq("owner_id",user.id);
  const pendingInvites = await client.from("workspace_invites").select("id").eq("owner_id",user.id).gt("expires_at",new Date().toISOString());
  if(activeMembers.error || pendingInvites.error)return NextResponse.json({error:"Teamdaten konnten nicht geladen werden."},{status:503});
  const team = [{status:"active"}, ...(activeMembers.data??[]).map(()=>({status:"active"})), ...(pendingInvites.data??[]).map(()=>({status:"invited"}))];
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
