import Link from "next/link";
import { loginFontClassName } from "@/lib/fonts/studio-fonts";
import styles from "./sign-in.module.css";

type FeedbackProps = {
  notice?: string;
  error?: string;
};

function Feedback({ notice, error }: FeedbackProps) {
  return (
    <>
      {notice ? (
        <div className={`${styles.feedback} ${styles.feedbackNotice}`} role="status">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className={`${styles.feedback} ${styles.feedbackError}`} role="alert">
          {error}
        </div>
      ) : null}
    </>
  );
}

export function ForgotPasswordPage({ notice, error }: FeedbackProps) {
  return (
    <div className={`${styles.shell} ${styles.shellFormOnly} ${loginFontClassName}`}>
      <section className={styles.formwrap}>
        <div className={styles.formcol}>
          <h2 className={styles.formTitle}>Passwort vergessen</h2>
          <p className={styles.lead}>
            Gib deine E-Mail ein. Du erhältst einen Link, mit dem du ein neues Passwort setzen kannst.
          </p>

          <Feedback notice={notice} error={error} />

          <form className={styles.formBlock} action="/auth/reset-password/request" method="post">
            <div className={styles.fieldGroupLast}>
              <label className={styles.fieldLabel} htmlFor="reset-email">
                E-Mail
              </label>
              <input
                id="reset-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="name@beispiel.de"
                className={styles.field}
                style={{ paddingLeft: 14 }}
              />
            </div>
            <button type="submit" className={styles.btnPrimary}>
              Link senden
            </button>
          </form>

          <p className={styles.register}>
            <Link href="/anmelden" className={styles.modeToggle}>
              ← Zurück zur Anmeldung
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}

export function ResetPasswordPage({ notice, error }: FeedbackProps) {
  return (
    <div className={`${styles.shell} ${styles.shellFormOnly} ${loginFontClassName}`}>
      <section className={styles.formwrap}>
        <div className={styles.formcol}>
          <h2 className={styles.formTitle}>Neues Passwort</h2>
          <p className={styles.lead}>Wähle ein neues Passwort mit mindestens 8 Zeichen.</p>

          <Feedback notice={notice} error={error} />

          <form className={styles.formBlock} action="/auth/reset-password/update" method="post">
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor="new-password">
                Neues Passwort
              </label>
              <input
                id="new-password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="••••••••"
                className={styles.field}
                style={{ paddingLeft: 14 }}
              />
            </div>

            <div className={styles.fieldGroupLast}>
              <label className={styles.fieldLabel} htmlFor="new-password-confirm">
                Passwort bestätigen
              </label>
              <input
                id="new-password-confirm"
                name="passwordConfirm"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="••••••••"
                className={styles.field}
                style={{ paddingLeft: 14 }}
              />
            </div>

            <button type="submit" className={styles.btnPrimary}>
              Passwort speichern
            </button>
          </form>

          <p className={styles.register}>
            <Link href="/passwort-vergessen" className={styles.modeToggle}>
              Neuen Link anfordern
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}

export function messageForForgotPassword(code: string | undefined): {
  notice?: string;
  error?: string;
} {
  switch (code) {
    case "sent":
      return {
        notice:
          "Wenn ein Konto mit dieser E-Mail existiert, erhältst du in Kürze einen Link zum Zurücksetzen. Prüfe auch den Spam-Ordner.",
      };
    case "missing":
      return { error: "Bitte gib deine E-Mail-Adresse ein." };
    case "config":
      return {
        error:
          "Supabase ist nicht konfiguriert. Prüfe NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.",
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
