"use client";

import { SignInPage } from "@/components/ui/sign-in";

interface LoginFormProps {
  nextPath?: string;
  urlError?: string;
  urlNotice?: string;
}

function messageForError(code: string | undefined): string | undefined {
  if (!code) return undefined;
  switch (code) {
    case "auth":
      return "Anmeldung fehlgeschlagen. Bitte erneut versuchen.";
    case "config":
      return 'Supabase-Umgebungsvariablen fehlen. Leg im Ordner dieser App eine Datei .env.local an mit NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY (Vorlage: .env.example), dann Dev-Server neu starten.';
    case "invite_required":
      return "Registrierung ist nur mit Einladung möglich.";
    case "invite_only":
      return "Google-Anmeldung ist derzeit nicht verfügbar.";
    case "google":
      return "Google-Anmeldung fehlgeschlagen. Bitte erneut versuchen.";
    case "missing":
      return "Bitte E-Mail und Passwort ausfüllen.";
    case "admin_2fa_session_expired":
      return "Sicherheitssitzung abgelaufen. Bitte erneut anmelden — du erhältst danach einen neuen E-Mail-Code.";
    case "admin_2fa_email_config":
      return "Admin-E-Mail-Code: In .env.local fehlen RESEND_API_KEY und eine Absender-Adresse (ADMIN_2FA_FROM_EMAIL oder RESEND_FROM_EMAIL). Zusätzlich ADMIN_2FA_SECRET oder NEXTAUTH_SECRET (≥32 Zeichen). Dev-Server neu starten.";
    case "admin_2fa_email_failed":
      return "E-Mail mit Sicherheitscode konnte nicht gesendet werden.";
    default:
      return "Anmeldung nicht möglich. Bitte erneut versuchen.";
  }
}

function messageForNotice(code: string | undefined): string | undefined {
  if (!code) return undefined;
  switch (code) {
    case "invite_ready":
      return "Konto ist bereit. Du kannst dich jetzt anmelden.";
    default:
      return undefined;
  }
}

export function LoginForm({ nextPath = "/dashboard", urlError, urlNotice }: LoginFormProps) {
  return (
    <SignInPage
      nextPath={nextPath}
      feedbackError={messageForError(urlError)}
      feedbackNotice={messageForNotice(urlNotice)}
    />
  );
}
