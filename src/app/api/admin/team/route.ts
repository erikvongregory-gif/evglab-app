import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/security/requestGuards";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/admin/auth";
import { getDashboardMetadata } from "@/lib/dashboard/metadata";

export async function GET(req: Request) {
  const rateError = enforceRateLimit(req, { keyPrefix: "admin-team-get", limit: 60, windowMs: 60_000 });
  if (rateError) return rateError;
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Kein Admin-Zugriff." }, { status: 403 });

  const client = createAdminClient();
  const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data.users ?? []).flatMap((user) => {
    const dashboard = getDashboardMetadata(user.user_metadata);
    const team = dashboard.teamMembers ?? [];
    return team.map((member) => ({
      ownerUserId: user.id,
      ownerEmail: user.email ?? "",
      memberId: member.id,
      memberEmail: member.email,
      memberName: member.name,
      role: member.role,
      status: member.status,
      invitedAt: member.invitedAt,
    }));
  });

  return NextResponse.json({
    summary: {
      totalRows: rows.length,
      openInvites: rows.filter((row) => row.status === "invited").length,
      activeMembers: rows.filter((row) => row.status === "active").length,
    },
    rows: rows.sort((a, b) => +new Date(b.invitedAt) - +new Date(a.invitedAt)),
  });
}
