import type { DashboardTeamRole } from "@/lib/dashboard/metadata";

export const TEAM_ROLE_LABEL: Record<DashboardTeamRole, string> = {
  owner: "Inhaber",
  admin: "Administrator",
  editor: "Bearbeiten",
  viewer: "Nur Lesen",
};

/** Kurze Erklärung für Einladung, Select und E-Mail. */
export const TEAM_ROLE_DESCRIPTION: Record<DashboardTeamRole, string> = {
  owner: "Abo, Abrechnung und volle Kontrolle über das Team.",
  admin: "Team verwalten, Motive erstellen und Marke bearbeiten.",
  editor: "Motive erstellen und Marke bearbeiten — ohne Teamverwaltung.",
  viewer: "Mediathek und Marke ansehen — nichts ändern oder erzeugen.",
};

export const INVITE_TEAM_ROLES = ["editor", "admin", "viewer"] as const;
export type InviteTeamRole = (typeof INVITE_TEAM_ROLES)[number];

export function canWriteWithRole(role: DashboardTeamRole): boolean {
  return role !== "viewer";
}

export function canManageTeam(role: DashboardTeamRole): boolean {
  return role === "owner" || role === "admin";
}
