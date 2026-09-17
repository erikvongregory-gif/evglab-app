"use client";

import { useState } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getInitials } from "@/lib/utils";

export type AdminTeamMember = {
  id: string;
  email: string;
  name: string;
  role: "owner" | "admin" | "editor" | "viewer";
  status: "active" | "invited";
};

const ROLE_LABEL: Record<AdminTeamMember["role"], string> = {
  owner: "Inhaber",
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
};

const ROLE_VARIANT: Record<
  AdminTeamMember["role"],
  "default" | "info" | "warning" | "outline"
> = {
  owner: "default",
  admin: "info",
  editor: "warning",
  viewer: "outline",
};

export function AdminTeamView({
  members,
  loaded = true,
  loadError = null,
  onMembersChange,
}: {
  members: AdminTeamMember[];
  loaded?: boolean;
  loadError?: string | null;
  onMembersChange: (next: AdminTeamMember[]) => void;
}) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "editor" | "viewer">("editor");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function sendInvite() {
    setError(null);
    setNotice(null);
    const email = inviteEmail.trim();
    if (!email) {
      setError("Bitte eine E-Mail eingeben.");
      return;
    }
    setInviting(true);
    try {
      const res = await fetch("/api/dashboard/team", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: inviteName.trim() || undefined, role: inviteRole }),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; members?: AdminTeamMember[] }
        | null;
      if (!res.ok) {
        setError(json?.error || "Einladung fehlgeschlagen.");
        return;
      }
      if (Array.isArray(json?.members)) onMembersChange(json.members);
      setNotice(`Einladung an ${email} verschickt.`);
      setInviteEmail("");
      setInviteName("");
      setInviteRole("editor");
    } catch {
      setError("Einladung konnte nicht gesendet werden.");
    } finally {
      setInviting(false);
    }
  }

  async function removeMember(memberId: string) {
    setError(null);
    setNotice(null);
    setRemovingId(memberId);
    try {
      const res = await fetch(`/api/dashboard/team?memberId=${encodeURIComponent(memberId)}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; members?: AdminTeamMember[] }
        | null;
      if (!res.ok) {
        setError(json?.error || "Mitglied konnte nicht entfernt werden.");
        return;
      }
      if (Array.isArray(json?.members)) onMembersChange(json.members);
      setNotice("Mitglied entfernt.");
    } catch {
      setError("Mitglied konnte nicht entfernt werden.");
    } finally {
      setRemovingId(null);
    }
  }

  const activeCount = members.filter((m) => m.status === "active").length;
  const invitedCount = members.filter((m) => m.status === "invited").length;

  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl leading-none tracking-tight">Team</h1>
          <p className="text-muted-foreground text-sm">
            Lade Kolleginnen und Kollegen ein, um gemeinsam Motive zu erstellen.
          </p>
        </div>
        <Badge variant="secondary">{loaded ? `${members.length} Mitglieder` : "…"}</Badge>
      </div>

      {loadError ? (
        <Card>
          <CardContent className="pt-6 text-sm text-destructive" role="alert">
            {loadError}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Mitglied einladen</CardTitle>
          <CardDescription>Einladung mit Login-Link per E-Mail</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-2">
            <Label htmlFor="team-invite-email">E-Mail</Label>
            <Input
              id="team-invite-email"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="kollege@beispiel.de"
              disabled={inviting}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="team-invite-name">Name</Label>
            <Input
              id="team-invite-name"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              placeholder="Optional"
              disabled={inviting}
            />
          </div>
          <div className="grid gap-2">
            <Label>Rolle</Label>
            <Select
              value={inviteRole}
              onValueChange={(v) => setInviteRole(v as "admin" | "editor" | "viewer")}
              disabled={inviting}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button className="w-full" disabled={inviting} onClick={() => void sendInvite()}>
              {inviting ? "Sende …" : "Einladen"}
            </Button>
          </div>
          {error ? <p className="text-sm text-destructive sm:col-span-2 lg:col-span-4">{error}</p> : null}
          {notice ? <p className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-4">{notice}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle>Teammitglieder</CardTitle>
            <CardDescription>
              {activeCount} aktiv
              {invitedCount ? ` · ${invitedCount} Einladung offen` : ""}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="rounded-lg bg-muted/40 p-8 text-center text-muted-foreground text-sm">
              Noch keine Teammitglieder.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mitglied</TableHead>
                    <TableHead>Rolle</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m) => {
                    const label = m.name || m.email;
                    return (
                      <TableRow key={m.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar size="sm">
                              <AvatarFallback>{getInitials(label)}</AvatarFallback>
                            </Avatar>
                            <div className="flex min-w-0 flex-col">
                              <span className="truncate font-medium text-sm">{label}</span>
                              <span className="truncate text-muted-foreground text-xs">
                                {m.email}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge size="sm" variant={ROLE_VARIANT[m.role]}>
                            {ROLE_LABEL[m.role]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            size="sm"
                            variant={m.status === "invited" ? "warning" : "success"}
                          >
                            {m.status === "invited" ? "Einladung offen" : "Aktiv"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {m.role !== "owner" ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={removingId === m.id}
                              onClick={() => void removeMember(m.id)}
                            >
                              {removingId === m.id ? "Entferne …" : "Entfernen"}
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-xs">Inhaber</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
