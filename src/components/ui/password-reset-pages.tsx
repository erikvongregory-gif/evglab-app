"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { loginFontClassName } from "@/lib/fonts/studio-fonts";
import { LoginHero } from "@/components/ui/sign-in";
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

const MailIcon = () => (
  <svg
    className={styles.icoLeft}
    viewBox="0 0 24 24"
    width="17"
    height="17"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <rect x="3" y="5.5" width="18" height="13" rx="2" />
    <path d="m4 7 8 5.5L20 7" />
  </svg>
);

const LockIcon = () => (
  <svg
    className={styles.icoLeft}
    viewBox="0 0 24 24"
    width="17"
    height="17"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
  </svg>
);

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="17"
      height="17"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {off ? (
        <>
          <path d="M3 3l18 18" />
          <path d="M10.6 5.1A10 10 0 0 1 12 5c5 0 9 4.5 10 7-.4 1-1.3 2.4-2.6 3.6M6.2 6.7C4.2 8 2.8 9.8 2 12c1 2.5 5 7 10 7 1.6 0 3-.4 4.3-1" />
          <path d="M9.5 9.6a3 3 0 0 0 4.2 4.2" />
        </>
      ) : (
        <>
          <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}

function PasswordResetShell({ children }: { children: ReactNode }) {
  return (
    <div className={`${styles.shell} ${loginFontClassName}`}>
      <LoginHero mode="signin" />
      <div className={styles.divider} aria-hidden />
      <section className={styles.formwrap}>
        <div className={`${styles.formcol} ${styles.stagger}`}>{children}</div>
      </section>
    </div>
  );
}

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={styles.btnPrimary}>
      {pending ? pendingLabel : label}
    </button>
  );
}

export function PasswordResetLoading({ message }: { message: string }) {
  return (
    <PasswordResetShell>
      <h2 className={styles.formTitle}>Einen Moment …</h2>
      <p className={styles.lead}>{message}</p>
    </PasswordResetShell>
  );
}

export function ForgotPasswordPage({ notice, error }: FeedbackProps) {
  return (
    <PasswordResetShell>
      <h2 className={styles.formTitle}>Passwort vergessen</h2>
      <p className={styles.lead}>
        Gib deine E-Mail ein. Du erhältst einen Link von BrewAI, mit dem du ein neues Passwort setzen kannst.
      </p>

      <Feedback notice={notice} error={error} />

      <form className={styles.formBlock} action="/auth/reset-password/request" method="post">
        <div className={styles.fieldGroupLast}>
          <label className={styles.fieldLabel} htmlFor="reset-email">
            E-Mail
          </label>
          <div className={styles.fieldIco}>
            <input
              id="reset-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="name@beispiel.de"
              className={styles.field}
            />
            <MailIcon />
          </div>
        </div>
        <SubmitButton label="Link senden" pendingLabel="Wird gesendet …" />
      </form>

      <p className={styles.register}>
        <Link href="/anmelden" className={styles.modeToggle}>
          ← Zurück zur Anmeldung
        </Link>
      </p>
    </PasswordResetShell>
  );
}

export function ResetPasswordPage({ notice, error }: FeedbackProps) {
  const [showPw, setShowPw] = useState(false);
  const [showPwConfirm, setShowPwConfirm] = useState(false);

  return (
    <PasswordResetShell>
      <h2 className={styles.formTitle}>Neues Passwort</h2>
      <p className={styles.lead}>Wähle ein neues Passwort mit mindestens 8 Zeichen.</p>

      <Feedback notice={notice} error={error} />

      <form className={styles.formBlock} action="/auth/reset-password/update" method="post">
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor="new-password">
            Neues Passwort
          </label>
          <div className={styles.fieldIco}>
            <input
              id="new-password"
              name="password"
              type={showPw ? "text" : "password"}
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="••••••••"
              className={`${styles.field} ${styles.fieldPw}`}
            />
            <LockIcon />
            <button
              type="button"
              className={styles.pwToggle}
              onClick={() => setShowPw((value) => !value)}
              aria-label={showPw ? "Passwort verbergen" : "Passwort anzeigen"}
            >
              <EyeIcon off={showPw} />
            </button>
          </div>
        </div>

        <div className={styles.fieldGroupLast}>
          <label className={styles.fieldLabel} htmlFor="new-password-confirm">
            Passwort bestätigen
          </label>
          <div className={styles.fieldIco}>
            <input
              id="new-password-confirm"
              name="passwordConfirm"
              type={showPwConfirm ? "text" : "password"}
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="••••••••"
              className={`${styles.field} ${styles.fieldPw}`}
            />
            <LockIcon />
            <button
              type="button"
              className={styles.pwToggle}
              onClick={() => setShowPwConfirm((value) => !value)}
              aria-label={showPwConfirm ? "Passwort verbergen" : "Passwort anzeigen"}
            >
              <EyeIcon off={showPwConfirm} />
            </button>
          </div>
        </div>

        <SubmitButton label="Passwort speichern" pendingLabel="Wird gespeichert …" />
      </form>

      <p className={styles.register}>
        <Link href="/passwort-vergessen" className={styles.modeToggle}>
          Neuen Link anfordern
        </Link>
      </p>
    </PasswordResetShell>
  );
}
