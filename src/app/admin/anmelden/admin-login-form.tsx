"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SignInPage } from "@/components/ui/sign-in";

function messageForError(code: string | undefined, detail?: string | null): string | undefined {
  if (!code) return undefined;
  const detailHint = detail ? ` (${detail})` : "";
  switch (code) {
    case "credentials":
      return "E-Mail oder Passwort ist falsch.";
    case "auth":
      return `Kein Admin-Zugang${detailHint}. Nur Konten mit Admin-Rolle können sich hier anmelden.`;
    case "config":
      return "Supabase ist nicht konfiguriert. Bitte .env.local prüfen.";
    case "admin_2fa_session_expired":
      return "Sicherheitssitzung abgelaufen. Bitte erneut anmelden.";
    case "admin_2fa_email_config":
      return "Admin-E-Mail-Code: RESEND_API_KEY und Absender in .env.local fehlen.";
    case "admin_2fa_email_failed":
      return "Sicherheitscode konnte nicht per E-Mail gesendet werden.";
    case "missing":
      return "Bitte E-Mail und Passwort ausfüllen.";
    default:
      return "Admin-Anmeldung nicht möglich. Bitte erneut versuchen.";
  }
}

export function AdminLoginForm({
  urlError,
  urlNotice,
}: {
  urlError?: string;
  urlNotice?: string;
}) {
  const searchParams = useSearchParams();
  const [persistedError, setPersistedError] = useState<string | undefined>();

  useEffect(() => {
    const err = urlError ?? searchParams.get("error") ?? undefined;
    if (err) setPersistedError(err);
  }, [searchParams, urlError]);

  const noticeCode = urlNotice ?? searchParams.get("notice") ?? undefined;

  const errorDetail = searchParams.get("detail");
  const errorMessage = messageForError(persistedError, errorDetail);

  return (
    <SignInPage
      authPostAction="/auth/admin-signin"
      nextPath="/admin"
      showGoogle={false}
      waitlistMode={false}
      signInOnly
      initialMode="signin"
      feedbackError={errorMessage ? <span>{errorMessage}</span> : undefined}
      feedbackNotice={
        noticeCode === "signed_out" ? (
          <span>Du wurdest abgemeldet.</span>
        ) : undefined
      }
    />
  );
}
