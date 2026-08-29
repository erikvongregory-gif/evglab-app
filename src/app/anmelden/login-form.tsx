"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SignInPage } from "@/components/ui/sign-in";

interface LoginFormProps {
  nextPath?: string;
  urlError?: string;
  urlNotice?: string;
  initialMode?: "signin" | "register";
  inviteToken?: string;
  inviteOnly?: boolean;
  waitlistMode?: boolean;
}

function messageForError(
  code: string | undefined,
  mode: "signin" | "register",
  detail?: string | null,
): string | undefined {
  if (!code) return undefined;
  const detailHint = detail ? ` (${detail})` : "";
  switch (code) {
    case "credentials":
      return "E-Mail oder Passwort ist falsch. Bitte prüfen und erneut versuchen.";
    case "email_not_confirmed":
      return "Bitte bestätige zuerst deine E-Mail-Adresse (Link in der Registrierungs-Mail).";
    case "user_banned":
      return "Dieses Konto ist gesperrt. Bitte Support kontaktieren.";
    case "auth":
      return mode === "register"
        ? `Registrierung fehlgeschlagen${detailHint}. Bitte erneut versuchen.`
        : `Anmeldung fehlgeschlagen${detailHint}. Bitte erneut versuchen.`;
    case "config":
      return 'Supabase-Umgebungsvariablen fehlen. Leg im Ordner dieser App eine Datei .env.local an mit NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY (Vorlage: .env.example), dann Dev-Server neu starten.';
    case "invite_required":
      return "Registrierung ist nur mit Einladung möglich.";
    case "invite_expired":
      return "Diese Einladung ist abgelaufen.";
    case "invite_used":
      return "Diese Einladung wurde bereits verwendet.";
    case "invite_invalid":
      return "Einladungslink ist ungültig.";
    case "invite_email_mismatch":
      return "E-Mail passt nicht zur Einladung.";
    case "invite_only":
      return "Google-Anmeldung ist derzeit nicht verfügbar.";
    case "google":
      return "Google-Anmeldung fehlgeschlagen. Bitte erneut versuchen.";
    case "oauth_state":
      return "Google-Anmeldung abgelaufen oder doppelt aufgerufen. Cookies für localhost löschen, dann erneut „Mit Google anmelden“ (nicht Zurück im Browser).";
    case "session_pending":
      return "Anmeldung fast fertig — bitte erneut auf „Mit Google anmelden“ klicken. Wenn es wieder hängt: Cookies für localhost löschen.";
    case "missing":
      return mode === "register"
        ? "Bitte alle Felder ausfüllen."
        : "Bitte E-Mail und Passwort ausfüllen.";
    case "admin_2fa_session_expired":
      return "Sicherheitssitzung abgelaufen. Bitte erneut anmelden — du erhältst danach einen neuen E-Mail-Code.";
    case "admin_2fa_email_config":
      return "Admin-E-Mail-Code: In .env.local fehlen RESEND_API_KEY und eine Absender-Adresse (ADMIN_2FA_FROM_EMAIL oder RESEND_FROM_EMAIL). Zusätzlich ADMIN_2FA_SECRET oder NEXTAUTH_SECRET (≥32 Zeichen). Dev-Server neu starten.";
    case "admin_2fa_email_failed":
      return "E-Mail mit Sicherheitscode konnte nicht gesendet werden.";
    default:
      return mode === "register"
        ? "Registrierung nicht möglich. Bitte erneut versuchen."
        : "Anmeldung nicht möglich. Bitte erneut versuchen.";
  }
}

function messageForNotice(code: string | undefined): string | undefined {
  if (!code) return undefined;
  switch (code) {
    case "invite_ready":
      return "Konto ist bereit. Du kannst dich jetzt anmelden.";
    case "account_ready":
      return "Konto erstellt. Melde dich an — wir senden dir dann einen Sicherheitscode per E-Mail.";
    case "password_updated":
      return "Passwort wurde geändert. Du kannst dich jetzt anmelden.";
    case "signed_out":
      return "Du wurdest abgemeldet. Melde dich jederzeit wieder an.";
    default:
      return undefined;
  }
}

export function LoginForm({
  nextPath = "/dashboard",
  urlError,
  urlNotice,
  initialMode = "signin",
  inviteToken,
  inviteOnly = false,
  waitlistMode,
}: LoginFormProps) {
  const searchParams = useSearchParams();
  const [persistedError, setPersistedError] = useState<string | undefined>();

  useEffect(() => {
    const err = urlError ?? searchParams.get("error") ?? undefined;
    if (err) setPersistedError(err);
  }, [searchParams, urlError]);

  const errorDetail = searchParams.get("detail");

  const modeParam = searchParams.get("mode");
  const resolvedMode =
    modeParam === "register" ||
    modeParam === "signup" ||
    initialMode === "register"
      ? ("register" as const)
      : ("signin" as const);
  const registerErrors = new Set([
    "invite_required",
    "invite_expired",
    "invite_used",
    "invite_invalid",
    "invite_email_mismatch",
  ]);
  const errorMode =
    persistedError && registerErrors.has(persistedError) ? ("register" as const) : resolvedMode;

  return (
    <SignInPage
      nextPath={nextPath}
      resetPasswordHref="/passwort-vergessen"
      initialMode={errorMode}
      inviteToken={inviteToken ?? searchParams.get("invite") ?? undefined}
      inviteOnly={inviteOnly}
      waitlistMode={waitlistMode}
      feedbackError={messageForError(persistedError, errorMode, errorDetail)}
      feedbackNotice={messageForNotice(urlNotice ?? searchParams.get("notice") ?? undefined)}
    />
  );
}
