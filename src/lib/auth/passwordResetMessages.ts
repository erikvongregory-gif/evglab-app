export function messageForForgotPassword(
  code: string | undefined,
  detail?: string | null,
): {
  notice?: string;
  error?: string;
} {
  switch (code) {
    case "sent":
      return {
        notice:
          "Wenn ein Konto mit dieser E-Mail existiert, erhältst du in Kürze eine E-Mail von EvGlab mit dem Link zum Zurücksetzen.",
      };
    case "missing":
      return { error: "Bitte gib deine E-Mail-Adresse ein." };
    case "config":
      return {
        error:
          "Supabase ist nicht konfiguriert. Prüfe NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.",
      };
    case "email_config":
      return {
        error:
          "E-Mail-Versand ist nicht konfiguriert. Trage in .env.local einen gültigen RESEND_API_KEY (beginnt mit re_), RESEND_FROM_EMAIL und SUPABASE_SERVICE_ROLE_KEY ein — danach Dev-Server neu starten.",
      };
    case "resend_invalid_key":
      return {
        error:
          "Der RESEND_API_KEY in .env.local ist ungültig oder noch ein Platzhalter. Hole einen echten Key unter resend.com → API Keys, trage ihn ein und starte den Dev-Server neu.",
      };
    case "resend_domain_unverified":
      return {
        error:
          "Die Absender-Domain evglab.com ist bei Resend noch nicht verifiziert. Unter resend.com/domains DNS-Einträge setzen — oder lokal testweise nur an deine Resend-Account-E-Mail senden (Sandbox: onboarding@resend.dev).",
      };
    case "resend_sandbox_recipient": {
      const allowed = detail?.trim();
      return {
        error: allowed
          ? `Resend-Testmodus: Mails können aktuell nur an ${allowed} gesendet werden. Nutze diese E-Mail zum Testen — oder verifiziere evglab.com bei Resend.`
          : "Resend-Testmodus: Mails können nur an deine bei Resend registrierte E-Mail gesendet werden. Alternativ evglab.com unter resend.com/domains verifizieren.",
      };
    }
    case "reset_rate_limited":
      return {
        error: "Bitte warte etwa eine Minute und fordere den Link dann erneut an.",
      };
    case "email_failed":
      return {
        error: "Die E-Mail konnte nicht gesendet werden. Bitte versuche es in ein paar Minuten erneut.",
      };
    case "session":
      return {
        error: "Der Link ist abgelaufen oder ungültig. Bitte fordere einen neuen Link an.",
      };
    default:
      return {};
  }
}

export function messageForResetPassword(code: string | undefined): {
  notice?: string;
  error?: string;
} {
  switch (code) {
    case "weak":
      return { error: "Das Passwort muss mindestens 8 Zeichen lang sein." };
    case "mismatch":
      return { error: "Die Passwörter stimmen nicht überein." };
    case "auth":
      return { error: "Passwort konnte nicht gespeichert werden. Bitte fordere einen neuen Link an." };
    case "config":
      return {
        error:
          "Supabase ist nicht konfiguriert. Prüfe NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.",
      };
    default:
      return {};
  }
}
