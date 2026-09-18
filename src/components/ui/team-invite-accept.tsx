"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EvglabMark } from "@/components/studio/evglab-mark";
import { loginFontClassName } from "@/lib/fonts/studio-fonts";
import { MARKETING_SITE_URL } from "@/lib/siteConfig";
import type { WorkspaceInvitePreview } from "@/lib/dashboard/teamInvitePreview";
import styles from "@/components/ui/sign-in.module.css";

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
};

export function TeamInviteAccept({ token, invite, sessionEmail, needsTwoFactor }: TeamInviteAcceptProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const next = `/invite/team/${token}`;
  const nextParam = encodeURIComponent(next);
  const inviteEmail = invite.email;
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
    } finally {
      setBusy(false);
    }
  }

  const primaryLinkStyle = {
    textAlign: "center" as const,
    textDecoration: "none" as const,
    display: "flex" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };

  const statusCopy =
    invite.status === "missing"
      ? "Dieser Einladungslink ist ungültig oder wurde bereits verwendet."
      : invite.status === "expired"
        ? "Diese Einladung ist abgelaufen. Bitte lass dir eine neue schicken."
        : null;

  return (
    <main className={`${styles.shell} ${styles.shellFormOnly} ${loginFontClassName}`}>
      <div className={styles.glow} aria-hidden />
      <div className={styles.mesh} aria-hidden />

      <section className={styles.waitlistPanel}>
        <a href={MARKETING_SITE_URL} className={styles.brand} aria-label="BrewAI Startseite">
          <EvglabMark className={styles.brandMark} />
          <span className={styles.brandName}>BrewAI</span>
        </a>

        <h1 className={styles.waitlistTitle}>Team-Einladung</h1>
        <p className={styles.waitlistDesc}>
          {invite.status === "valid"
            ? "Tritt dem BrewAI-Workspace bei und arbeitet gemeinsam an Motiven, Marke und Mediathek."
            : statusCopy}
        </p>

        {invite.status === "valid" && inviteEmail ? (
          <div
            style={{
              marginTop: 18,
              padding: "14px 16px",
              borderRadius: 10,
              border: "1px solid var(--line-strong)",
              background: "var(--bg-2)",
            }}
          >
            <p className={styles.fieldLabel} style={{ marginBottom: 4 }}>
              Eingeladen als
            </p>
            <p style={{ margin: 0, color: "var(--tx-0)", fontWeight: 600 }}>{inviteEmail}</p>
            {invite.role ? (
              <p style={{ margin: "6px 0 0", color: "var(--tx-3)", fontSize: 13 }}>
                Rolle: {ROLE_LABEL[invite.role] ?? invite.role}
              </p>
            ) : null}
          </div>
        ) : null}

        {sessionEmail ? (
          <p style={{ marginTop: 14, fontSize: 13, color: "var(--tx-3)" }}>
            Angemeldet als <strong style={{ color: "var(--tx-0)" }}>{sessionEmail}</strong>
            {!emailMatches && invite.status === "valid" ? (
              <> — bitte mit der eingeladenen Adresse anmelden.</>
            ) : null}
          </p>
        ) : invite.status === "valid" ? (
          <p style={{ marginTop: 14, fontSize: 13, color: "var(--tx-3)" }}>
            Melde dich mit der eingeladenen E-Mail an, um beizutreten.
          </p>
        ) : null}

        {error ? (
          <p className={`${styles.feedback} ${styles.feedbackError}`} role="alert" style={{ marginTop: 16 }}>
            {error}
          </p>
        ) : null}

        {done ? (
          <p className={`${styles.feedback} ${styles.feedbackNotice}`} role="status" style={{ marginTop: 16 }}>
            Willkommen im Team — du wirst weitergeleitet …
          </p>
        ) : null}

        {invite.status === "valid" ? (
          <div style={{ marginTop: 22, display: "grid", gap: 10 }}>
            {!sessionEmail ? (
              <>
                <Link href={`/anmelden?next=${nextParam}`} className={styles.btnPrimary} style={primaryLinkStyle}>
                  Anmelden und beitreten
                </Link>
                <Link
                  href={`/anmelden?mode=register&next=${nextParam}`}
                  className={styles.modeToggle}
                  style={{ textAlign: "center", justifySelf: "center" }}
                >
                  Noch kein Konto? Registrieren
                </Link>
              </>
            ) : needsTwoFactor ? (
              <Link
                href={`/dashboard/2fa-email?next=${nextParam}`}
                className={styles.btnPrimary}
                style={primaryLinkStyle}
              >
                Sicherheitscode bestätigen
              </Link>
            ) : emailMatches ? (
              <button type="button" className={styles.btnPrimary} disabled={busy || done} onClick={() => void accept()}>
                {busy ? "Wird angenommen …" : "Einladung annehmen"}
              </button>
            ) : (
              <>
                <p className={`${styles.feedback} ${styles.feedbackError}`} role="status">
                  Falsches Konto. Melde dich mit {inviteEmail} an.
                </p>
                <Link href={`/anmelden?next=${nextParam}`} className={styles.btnPrimary} style={primaryLinkStyle}>
                  Mit anderer E-Mail anmelden
                </Link>
              </>
            )}
          </div>
        ) : (
          <div style={{ marginTop: 22 }}>
            <Link href="/anmelden" className={styles.btnPrimary} style={primaryLinkStyle}>
              Zur Anmeldung
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
