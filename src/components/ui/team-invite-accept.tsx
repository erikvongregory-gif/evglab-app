"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { EvglabMark } from "@/components/studio/evglab-mark";
import { Button } from "@/components/ui/button";
import type { WorkspaceInvitePreview } from "@/lib/dashboard/teamInvitePreview";
import { studioFontClassName } from "@/lib/fonts/studio-fonts";
import { MARKETING_SITE_URL } from "@/lib/siteConfig";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrator",
  editor: "Editor",
  viewer: "Viewer",
};

export type TeamInviteAcceptProps = {
  token: string;
  invite: WorkspaceInvitePreview;
  sessionEmail: string | null;
  needsTwoFactor: boolean;
  declined?: boolean;
};

export function TeamInviteAccept({
  token,
  invite,
  sessionEmail,
  needsTwoFactor,
  declined = false,
}: TeamInviteAcceptProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const autoStarted = useRef(false);

  const next = `/invite/team/${token}`;
  const nextParam = encodeURIComponent(next);
  const inviteEmail = invite.email;
  const emailParam = inviteEmail ? `&email=${encodeURIComponent(inviteEmail)}` : "";
  const emailMatches =
    Boolean(sessionEmail) &&
    Boolean(inviteEmail) &&
    sessionEmail!.trim().toLowerCase() === inviteEmail!.trim().toLowerCase();

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/dashboard/team/accept", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string; ok?: boolean } | null;
      if (!response.ok) throw new Error(data?.error || "Einladung konnte nicht angenommen werden.");
      setDone(true);
      router.replace("/dashboard");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Einladung konnte nicht angenommen werden.");
      setBusy(false);
    }
  }

  useEffect(() => {
    if (declined) return;
    if (autoStarted.current) return;
    if (invite.status !== "valid") return;
    if (!sessionEmail || !emailMatches || needsTwoFactor) return;
    if (done || error) return;
    autoStarted.current = true;
    void accept();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot auto-accept when session is ready
  }, [invite.status, sessionEmail, emailMatches, needsTwoFactor, done, error, declined]);

  const statusCopy =
    invite.status === "missing"
      ? "Dieser Einladungslink ist ungültig oder wurde bereits verwendet."
      : invite.status === "expired"
        ? "Diese Einladung ist abgelaufen. Bitte lass dir eine neue schicken."
        : null;

  if (declined) {
    return (
      <div
        className={cn(
          "flex min-h-dvh w-full items-center justify-center bg-background p-4",
          studioFontClassName,
        )}
      >
        <div className="mx-auto w-full max-w-md">
          <a
            href={MARKETING_SITE_URL}
            className="mb-6 flex items-center justify-center gap-2 text-foreground"
            aria-label="BrewAI Startseite"
          >
            <EvglabMark size={22} />
            <span className="font-semibold tracking-tight">BrewAI</span>
          </a>
          <div className="relative overflow-hidden rounded-xl border border-border/50 bg-card/80 p-8 shadow-xl backdrop-blur-sm">
            <h1 className="text-center text-2xl font-semibold text-foreground">Einladung abgelehnt</h1>
            <p className="mt-3 text-center text-sm text-muted-foreground">
              Kein Problem — du musst nichts weiter tun. Die Einladung kannst du ignorieren.
            </p>
            <Button asChild className="mt-6 h-11 w-full" variant="outline">
              <Link href={MARKETING_SITE_URL}>Zur Startseite</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-dvh w-full items-center justify-center bg-background p-4",
        studioFontClassName,
      )}
    >
      <div className="mx-auto w-full max-w-md">
        <a
          href={MARKETING_SITE_URL}
          className="mb-6 flex items-center justify-center gap-2 text-foreground"
          aria-label="BrewAI Startseite"
        >
          <EvglabMark size={22} />
          <span className="font-semibold tracking-tight">BrewAI</span>
        </a>

        <div className="relative overflow-hidden rounded-xl border border-border/50 bg-card/80 shadow-xl backdrop-blur-sm">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5" />
          <div className="relative z-10 space-y-6 p-8">
            <div className="space-y-2 text-center">
              <h1 className="text-3xl font-semibold text-foreground">Team-Einladung</h1>
              <p className="text-sm text-muted-foreground">
                {invite.status === "valid"
                  ? "Tritt dem Workspace bei und arbeitet gemeinsam an Motiven, Marke und Mediathek."
                  : statusCopy}
              </p>
            </div>

            {invite.status === "valid" && inviteEmail ? (
              <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
                <p className="text-muted-foreground text-xs uppercase tracking-wide">Eingeladen als</p>
                <p className="mt-1 font-medium text-foreground">{inviteEmail}</p>
                {invite.role ? (
                  <p className="mt-1 text-muted-foreground">Rolle: {ROLE_LABEL[invite.role] ?? invite.role}</p>
                ) : null}
              </div>
            ) : null}

            {sessionEmail ? (
              <p className="text-center text-sm text-muted-foreground">
                Angemeldet als <strong className="text-foreground">{sessionEmail}</strong>
                {!emailMatches && invite.status === "valid"
                  ? " — bitte mit der eingeladenen Adresse anmelden."
                  : null}
              </p>
            ) : null}

            {error ? (
              <p className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            {done || (busy && emailMatches && !error) ? (
              <p className="rounded-lg border border-border bg-muted/40 p-3 text-center text-sm text-muted-foreground" role="status">
                {done ? "Willkommen im Team — du wirst weitergeleitet …" : "Einladung wird angenommen …"}
              </p>
            ) : null}

            {invite.status === "valid" ? (
              <div className="grid gap-3">
                {!sessionEmail ? (
                  <>
                    <Button asChild className="h-11 w-full">
                      <Link href={`/anmelden?mode=register&next=${nextParam}${emailParam}`}>
                        Konto erstellen und beitreten
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="h-11 w-full">
                      <Link href={`/anmelden?next=${nextParam}${emailParam}`}>Bereits Konto? Anmelden</Link>
                    </Button>
                  </>
                ) : needsTwoFactor ? (
                  <Button asChild className="h-11 w-full">
                    <Link href={`/dashboard/2fa-email?next=${nextParam}`}>Sicherheitscode bestätigen</Link>
                  </Button>
                ) : emailMatches ? (
                  <Button className="h-11 w-full" disabled={busy || done} onClick={() => void accept()}>
                    {busy ? "Wird angenommen …" : "Einladung annehmen"}
                  </Button>
                ) : (
                  <>
                    <p className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive" role="status">
                      Falsches Konto. Melde dich mit {inviteEmail} an.
                    </p>
                    <Button asChild className="h-11 w-full">
                      <Link href={`/anmelden?mode=register&next=${nextParam}${emailParam}`}>
                        Mit {inviteEmail} fortfahren
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <Button asChild className="h-11 w-full">
                <Link href="/anmelden">Zur Anmeldung</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
