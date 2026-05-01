import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { enforceRateLimitPersistent, enforceSameOrigin } from "@/lib/security/requestGuards";
import {
  type DashboardTeamMember,
  type DashboardTeamRole,
  getDashboardMetadata,
  mergeDashboardMetadata,
} from "@/lib/dashboard/metadata";

const inviteSchema = z.object({
  email: z.string().email().max(200),
  name: z.string().trim().max(120).optional(),
  role: z.enum(["admin", "editor", "viewer"]).default("editor"),
});

const updateRoleSchema = z.object({
  memberId: z.string().min(1).max(120),
  role: z.enum(["admin", "editor", "viewer"]),
});

function normalizeTeam(
  members: DashboardTeamMember[],
  ownerId: string,
  ownerEmail?: string,
): DashboardTeamMember[] {
  const base = members.slice(0, 50);
  const hasOwner = base.some((member) => member.role === "owner");
  if (hasOwner || !ownerEmail) return base;
  return [
    {
      id: ownerId,
      email: ownerEmail,
      name: "Du",
      role: "owner",
      status: "active",
      invitedAt: new Date().toISOString(),
    },
    ...base,
  ];
}

async function syncInvitationStatuses(members: DashboardTeamMember[]) {
  const admin = createAdminClient();
  const next = await Promise.all(
    members.map(async (member) => {
      if (member.role === "owner" || member.status !== "invited") return member;
      if (member.id.startsWith("invite-")) return member;
      try {
        const { data, error } = await admin.auth.admin.getUserById(member.id);
        if (error || !data?.user) return member;
        const isActive = Boolean(data.user.email_confirmed_at || data.user.last_sign_in_at);
        if (!isActive) return member;
        return { ...member, status: "active" as const };
      } catch {
        return member;
      }
    }),
  );
  return next;
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase ist nicht konfiguriert." }, { status: 500 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  const current = normalizeTeam(getDashboardMetadata(user.user_metadata).teamMembers ?? [], user.id, user.email);
  const team = await syncInvitationStatuses(current);
  if (JSON.stringify(team) !== JSON.stringify(current)) {
    await supabase.auth.updateUser({
      data: mergeDashboardMetadata(user.user_metadata, { teamMembers: team }),
    });
  }
  return NextResponse.json({ members: team });
}

export async function POST(req: Request) {
  const rateError = await enforceRateLimitPersistent(req, {
    keyPrefix: "dashboard-team-invite",
    limit: 20,
    windowMs: 60_000,
  });
  if (rateError) return rateError;
  const originError = enforceSameOrigin(req);
  if (originError) return originError;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase ist nicht konfiguriert." }, { status: 500 });
  }
  const parsed = inviteSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Einladung." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const current = normalizeTeam(getDashboardMetadata(user.user_metadata).teamMembers ?? [], user.id, user.email);
  const email = parsed.data.email.toLowerCase();
  if (current.some((member) => member.email.toLowerCase() === email)) {
    return NextResponse.json({ error: "E-Mail ist bereits im Team vorhanden." }, { status: 409 });
  }

  const admin = createAdminClient();
  const origin = new URL(req.url).origin;
  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    email,
    {
      redirectTo: `${origin}/auth/callback?next=/dashboard`,
      data: {
        invited_by_user_id: user.id,
        team_role: parsed.data.role,
      },
    },
  );
  if (inviteError) {
    return NextResponse.json(
      { error: `Einladungs-E-Mail konnte nicht gesendet werden: ${inviteError.message}` },
      { status: 500 },
    );
  }

  const now = new Date().toISOString();
  const next: DashboardTeamMember[] = [
    ...current,
    {
      id: inviteData.user?.id ?? `invite-${Date.now()}`,
      email,
      name: parsed.data.name?.trim() || email.split("@")[0] || "Neu",
      role: parsed.data.role,
      status: "invited" as const,
      invitedAt: now,
    },
  ].slice(0, 50);

  const merged = mergeDashboardMetadata(user.user_metadata, { teamMembers: next });
  const { error } = await supabase.auth.updateUser({ data: merged });
  if (error) {
    return NextResponse.json({ error: "Einladung konnte nicht gespeichert werden." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, members: next });
}

export async function PATCH(req: Request) {
  const rateError = await enforceRateLimitPersistent(req, {
    keyPrefix: "dashboard-team-update",
    limit: 30,
    windowMs: 60_000,
  });
  if (rateError) return rateError;
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase ist nicht konfiguriert." }, { status: 500 });
  }
  const parsed = updateRoleSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Team-Aktion." }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const current = normalizeTeam(getDashboardMetadata(user.user_metadata).teamMembers ?? [], user.id, user.email);
  const next = current.map((member) => {
    if (member.id !== parsed.data.memberId || member.role === "owner") return member;
    return { ...member, role: parsed.data.role as DashboardTeamRole };
  });
  const merged = mergeDashboardMetadata(user.user_metadata, { teamMembers: next });
  const { error } = await supabase.auth.updateUser({ data: merged });
  if (error) {
    return NextResponse.json({ error: "Team-Rolle konnte nicht aktualisiert werden." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, members: next });
}

export async function DELETE(req: Request) {
  const rateError = await enforceRateLimitPersistent(req, {
    keyPrefix: "dashboard-team-delete",
    limit: 30,
    windowMs: 60_000,
  });
  if (rateError) return rateError;
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase ist nicht konfiguriert." }, { status: 500 });
  }
  const url = new URL(req.url);
  const memberId = url.searchParams.get("memberId");
  if (!memberId) return NextResponse.json({ error: "memberId fehlt." }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const current = normalizeTeam(getDashboardMetadata(user.user_metadata).teamMembers ?? [], user.id, user.email);
  const next = current.filter((member) => member.id !== memberId && member.role !== "owner");
  const merged = mergeDashboardMetadata(user.user_metadata, { teamMembers: next });
  const { error } = await supabase.auth.updateUser({ data: merged });
  if (error) return NextResponse.json({ error: "Team-Mitglied konnte nicht entfernt werden." }, { status: 500 });
  return NextResponse.json({ ok: true, members: next });
}
