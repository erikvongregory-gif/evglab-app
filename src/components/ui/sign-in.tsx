"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { startTransition, useCallback, useState } from "react";
import { useFormStatus } from "react-dom";
import { loginFontClassName } from "@/lib/fonts/studio-fonts";
import { LOGIN_WAITLIST_ENABLED } from "@/lib/featureFlags";
import { EvglabMark } from "@/components/studio/evglab-mark";
import { MARKETING_SITE_URL } from "@/lib/siteConfig";
import styles from "./sign-in.module.css";

type AuthMode = "signin" | "register";

function resolveAuthMode(searchParams: URLSearchParams, fallback: AuthMode): AuthMode {
  const modeParam = searchParams.get("mode");
  if (modeParam === "register") return "register";
  if (modeParam === "signin") return "signin";
  return fallback;
}

const GoogleG = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden>
    <path
      fill="#4285F4"
      d="M22.5 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2-1.9 3.3-4.7 3.3-7.9z"
    />
    <path
      fill="#34A853"
      d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.7c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2v2.8A11 11 0 0 0 12 23z"
    />
    <path fill="#FBBC05" d="M5.7 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2a11 11 0 0 0 0 9.8l3.7-2.8z" />
    <path
      fill="#EA4335"
      d="M12 5.4c1.6 0 3 .6 4.2 1.6l3.1-3.1A11 11 0 0 0 2 7.1l3.7 2.8C6.6 7.3 9.1 5.4 12 5.4z"
    />
  </svg>
);

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

export interface SignInPageProps {
  authPostAction?: string;
  signupPostAction?: string;
  nextPath?: string;
  showGoogle?: boolean;
  googleNextPath?: string;
  resetPasswordHref?: string;
  feedbackNotice?: React.ReactNode;
  feedbackError?: React.ReactNode;
  initialMode?: AuthMode;
  inviteToken?: string;
  inviteOnly?: boolean;
  onSignIn?: (event: React.FormEvent<HTMLFormElement>) => void;
  onSignUp?: (event: React.FormEvent<HTMLFormElement>) => void;
  onGoogleSignIn?: () => void;
  googlePending?: boolean;
  onResetPassword?: () => void;
  waitlistMode?: boolean;
  signInOnly?: boolean;
}

function AuthSubmitInner({ mode }: { mode: AuthMode }) {
  const { pending } = useFormStatus();
  const isRegister = mode === "register";
  return (
    <button type="submit" disabled={pending} className={styles.btnPrimary}>
      {pending
        ? isRegister
          ? "Wird registriert …"
          : "Wird angemeldet …"
        : isRegister
          ? "Jetzt registrieren"
          : "Anmelden"}
    </button>
  );
}

function LoginHero({ mode }: { mode: AuthMode }) {
  const isRegister = mode === "register";

  return (
    <section className={styles.hero}>
      <div className={styles.glow} aria-hidden />
      <div className={styles.mesh} aria-hidden />

      <a href={MARKETING_SITE_URL} className={styles.brand} aria-label="EvGlab Startseite">
        <EvglabMark className={styles.brandMark} />
        <span className={styles.brandName}>EvGlab</span>
      </a>

      <div className={`${styles.heroBody} ${styles.stagger}`}>
        <div className={styles.eyebrow}>
          <span className={styles.eyebrowLine} aria-hidden />
          KI-Marketing · Brauereien
        </div>

        <div className={styles.heroHeadlineStack}>
          <h1
            className={`${styles.display} ${styles.heroHeadline} ${!isRegister ? styles.heroHeadlineVisible : ""}`}
            aria-hidden={isRegister}
          >
            Dein Motiv.
            <br />
            <em>Generiert.</em>
            <br />
            Sofort.
          </h1>
          <h1
            className={`${styles.display} ${styles.heroHeadline} ${isRegister ? styles.heroHeadlineVisible : ""}`}
            aria-hidden={!isRegister}
          >
            Drei Motive.
            <br />
            <em>Kostenlos.</em>
            <br />
            Jetzt.
          </h1>
        </div>

        <div className={styles.hook}>
          <span className={styles.hookCount}>3</span>
          <span>
            Bilder <b>kostenlos</b> generieren — keine Kreditkarte
          </span>
        </div>
      </div>

      <div className={`${styles.heroFoot} ${styles.eyebrow}`}>
        <span className={styles.dotOk} aria-hidden />
        app.evglab.com · v2.4 · live
      </div>
    </section>
  );
}

export const SignInPage: React.FC<SignInPageProps> = ({
  authPostAction,
  signupPostAction,
  nextPath = "/dashboard",
  showGoogle = true,
  googleNextPath,
  resetPasswordHref = "/passwort-vergessen",
  feedbackNotice,
  feedbackError,
  initialMode = "signin",
  inviteToken,
  inviteOnly = false,
  onSignIn,
  onSignUp,
  onGoogleSignIn,
  googlePending = false,
  onResetPassword,
  waitlistMode = LOGIN_WAITLIST_ENABLED,
  signInOnly = false,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const mode = resolveAuthMode(searchParams, initialMode);
  const [localError, setLocalError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [showPwConfirm, setShowPwConfirm] = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistJoined, setWaitlistJoined] = useState(false);
  const [waitlistPending, setWaitlistPending] = useState(false);
  const [waitlistError, setWaitlistError] = useState<string | null>(null);

  const isRegister = mode === "register";

  const setMode = useCallback(
    (next: AuthMode) => {
      setLocalError(null);
      const params = new URLSearchParams(searchParams.toString());
      if (next === "register") {
        params.set("mode", "register");
      } else {
        params.delete("mode");
        params.delete("error");
        params.delete("notice");
      }
      const qs = params.toString();
      const href = qs ? `${pathname}?${qs}` : pathname;
      startTransition(() => {
        router.replace(href, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  const googleHref = `/auth/google?next=${encodeURIComponent(googleNextPath ?? nextPath)}`;
  const signInAction = authPostAction ?? "/auth/signin";
  const signUpAction = signupPostAction ?? "/auth/signup";
  const postTarget = isRegister ? signUpAction : signInAction;

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (onSignIn && !isRegister) {
      onSignIn(event);
      return;
    }
    if (onSignUp && isRegister) {
      onSignUp(event);
      return;
    }

    if (isRegister) {
      const form = event.currentTarget;
      const password = String(new FormData(form).get("password") ?? "");
      const passwordConfirm = String(new FormData(form).get("passwordConfirm") ?? "");
      if (password !== passwordConfirm) {
        event.preventDefault();
        setLocalError("Passwörter stimmen nicht überein.");
        return;
      }
    }
    setLocalError(null);
  };

  const formProps =
    onSignIn && !isRegister
      ? { onSubmit: onSignIn }
      : onSignUp && isRegister
        ? { onSubmit: onSignUp }
        : {
            action: postTarget,
            method: "post" as const,
            onSubmit: handleFormSubmit,
          };

  const displayError = localError ?? feedbackError;

  const handleWaitlistSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = waitlistEmail.trim();
    if (!email) {
      setWaitlistError("Bitte gib eine E-Mail ein.");
      return;
    }
    setWaitlistPending(true);
    setWaitlistError(null);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, source: "login_waitlist" }),
      });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok) {
        setWaitlistError(payload?.error || "Eintrag fehlgeschlagen. Bitte versuch es erneut.");
        return;
      }
      setWaitlistJoined(true);
      setWaitlistEmail("");
    } catch {
      setWaitlistError("Eintrag fehlgeschlagen. Bitte versuch es erneut.");
    } finally {
      setWaitlistPending(false);
    }
  };

  if (waitlistMode) {
    return (
      <div className={`${styles.shell} ${styles.shellFormOnly} ${loginFontClassName}`}>
        <section className={styles.formwrap}>
          <div className={styles.formcol}>
            <h2 className={styles.waitlistTitle}>Login bald wieder offen</h2>
            <p className={styles.waitlistDesc}>
              Trag dich in die Warteliste ein. Du bekommst als Erstes Bescheid, sobald Login und Registrierung
              wieder freigeschaltet sind.
            </p>
            <form onSubmit={handleWaitlistSubmit}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="waitlist-email">
                  E-Mail
                </label>
                <div className={styles.fieldIco}>
                  <input
                    id="waitlist-email"
                    type="email"
                    value={waitlistEmail}
                    onChange={(event) => setWaitlistEmail(event.target.value)}
                    placeholder="name@beispiel.de"
                    className={styles.field}
                    autoComplete="email"
                  />
                  <MailIcon />
                </div>
              </div>
              <button type="submit" disabled={waitlistPending} className={styles.btnPrimary}>
                {waitlistPending ? "Wird eingetragen …" : "Auf die Warteliste"}
              </button>
            </form>
            {waitlistJoined ? <p className={styles.waitlistSuccess}>Danke! Du stehst jetzt auf der Warteliste.</p> : null}
            {waitlistError ? <p className={styles.waitlistError}>{waitlistError}</p> : null}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={`${styles.shell} ${loginFontClassName}`}>
      <LoginHero mode={mode} />
      <div className={styles.divider} aria-hidden />

      <section className={styles.formwrap}>
        <div className={`${styles.formcol} ${styles.stagger}`}>
          <h2 className={styles.formTitle}>{signInOnly ? "Admin-Anmeldung" : isRegister ? "Konto erstellen" : "Willkommen zurück"}</h2>
          <p className={styles.lead}>
            {signInOnly ? (
              <>Nur für EvGlab-Administratoren. Nach dem Login folgt ein E-Mail-Sicherheitscode.</>
            ) : isRegister ? (
              <>
                Bereits Konto?{" "}
                <button type="button" className={styles.modeToggle} onClick={() => setMode("signin")}>
                  Anmelden →
                </button>
              </>
            ) : (
              <>
                Noch kein Konto?{" "}
                <button type="button" className={styles.modeToggle} onClick={() => setMode("register")}>
                  Kostenlos starten →
                </button>
              </>
            )}
          </p>

          {inviteOnly && isRegister && !inviteToken ? (
            <div className={`${styles.feedback} ${styles.feedbackError}`} role="status">
              Registrierung ist nur mit Einladung möglich. Bitte nutze deinen Einladungslink.
            </div>
          ) : null}

          {feedbackNotice ? (
            <div className={`${styles.feedback} ${styles.feedbackNotice}`} role="status">
              {feedbackNotice}
            </div>
          ) : null}

          {displayError ? (
            <div className={`${styles.feedback} ${styles.feedbackError}`} role="alert">
              {displayError}
            </div>
          ) : null}

          <form key={mode} className={styles.formBlock} {...formProps}>
            <input type="hidden" name="next" value={nextPath} />
            {inviteToken ? <input type="hidden" name="inviteToken" value={inviteToken} /> : null}

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor="auth-email">
                E-Mail
              </label>
              <div className={styles.fieldIco}>
                <input
                  id="auth-email"
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

            <div className={isRegister ? styles.fieldGroup : styles.fieldGroupLast}>
              <div className={isRegister ? undefined : styles.labelRow}>
                <label className={styles.fieldLabel} htmlFor="auth-password">
                  Passwort
                </label>
                {!isRegister ? (
                  onResetPassword ? (
                    <a
                      href="#"
                      className={styles.forgot}
                      onClick={(event) => {
                        event.preventDefault();
                        onResetPassword();
                      }}
                    >
                      Vergessen?
                    </a>
                  ) : (
                    <Link href={resetPasswordHref} className={styles.forgot}>
                      Vergessen?
                    </Link>
                  )
                ) : null}
              </div>
              <div className={styles.fieldIco}>
                <input
                  id="auth-password"
                  name="password"
                  type={showPw ? "text" : "password"}
                  required
                  minLength={isRegister ? 8 : undefined}
                  autoComplete={isRegister ? "new-password" : "current-password"}
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

            <div className={`${styles.confirmWrap} ${isRegister ? styles.confirmWrapOpen : ""}`}>
              <div className={styles.confirmInner}>
                <div className={styles.fieldGroupLast}>
                  <label className={styles.fieldLabel} htmlFor="auth-password-confirm">
                    Passwort bestätigen
                  </label>
                  <div className={styles.fieldIco}>
                    <input
                      id="auth-password-confirm"
                      name="passwordConfirm"
                      type={showPwConfirm ? "text" : "password"}
                      required={isRegister}
                      disabled={!isRegister}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      className={`${styles.field} ${styles.fieldPw}`}
                      tabIndex={isRegister ? 0 : -1}
                      aria-hidden={!isRegister}
                    />
                    <LockIcon />
                    <button
                      type="button"
                      className={styles.pwToggle}
                      onClick={() => setShowPwConfirm((value) => !value)}
                      aria-label={showPwConfirm ? "Passwort verbergen" : "Passwort anzeigen"}
                      tabIndex={isRegister ? 0 : -1}
                    >
                      <EyeIcon off={showPwConfirm} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <AuthSubmitInner mode={mode} />
          </form>

          {showGoogle ? (
            <>
              <div className={styles.or}>oder</div>
              {onGoogleSignIn ? (
                <button
                  type="button"
                  onClick={onGoogleSignIn}
                  disabled={googlePending}
                  className={styles.btnGoogle}
                >
                  <GoogleG />
                  {googlePending
                    ? "Weiter zu Google …"
                    : isRegister
                      ? "Mit Google registrieren"
                      : "Mit Google anmelden"}
                </button>
              ) : (
                <a href={googleHref} className={styles.btnGoogle} rel="noopener">
                  <GoogleG />
                  {isRegister ? "Mit Google registrieren" : "Mit Google anmelden"}
                </a>
              )}
            </>
          ) : null}

          <p className={styles.legal}>
            Mit der {isRegister ? "Registrierung" : "Anmeldung"} akzeptierst du unsere{" "}
            <Link href="/agb" target="_blank" rel="noopener noreferrer">
              AGB
            </Link>{" "}
            und{" "}
            <Link href="/datenschutz" target="_blank" rel="noopener noreferrer">
              Datenschutzerklärung
            </Link>
            .
          </p>
        </div>
      </section>
    </div>
  );
};
