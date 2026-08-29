"use client";

import Link from "next/link";
import { Beer, Check, Eye, EyeOff, Lock, Mail } from "lucide-react";
import React, { useId, useState } from "react";
import { EvglabMark } from "@/components/studio/evglab-mark";
import { studioFontClassName } from "@/lib/fonts/studio-fonts";
import { MARKETING_SITE_URL } from "@/lib/siteConfig";
import styles from "./auth-card.module.css";

export type AuthMode = "login" | "signup";
export type OAuthProvider = "google" | "apple" | "linkedin";

export interface AuthCardProps {
  defaultMode?: AuthMode;
  mode?: AuthMode;
  onModeChange?: (mode: AuthMode) => void;

  onSubmit: (payload: {
    mode: AuthMode;
    email: string;
    password: string;
    brewery?: string;
    stayLoggedIn?: boolean;
    acceptedTerms?: boolean;
  }) => Promise<void> | void;

  onOAuth: (provider: OAuthProvider) => void;
  onForgotPassword?: () => void;
  loading?: boolean;
  error?: string | null;

  /** Production form POST (keeps existing /auth/signin + /auth/signup). */
  formAction?: string;
  nextPath?: string;
  inviteToken?: string;
  oauthProviders?: OAuthProvider[];
  googleHref?: string;
  feedbackNotice?: React.ReactNode;
  inviteBlocked?: boolean;
  inviteBlockedMessage?: string;
  termsHref?: string;
  privacyHref?: string;
  showModeSwitch?: boolean;
  forgotPasswordHref?: string;
}

function passwordStrength(password: string): 0 | 1 | 2 | 3 | 4 {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return Math.max(1, Math.min(4, score)) as 0 | 1 | 2 | 3 | 4;
}

const STRENGTH_LABEL = ["", "SCHWACH", "OKAY", "GUT", "STARK"] as const;

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

export function AuthCard({
  defaultMode = "login",
  mode: controlledMode,
  onModeChange,
  onSubmit,
  onOAuth,
  onForgotPassword,
  loading = false,
  error = null,
  formAction,
  nextPath = "/dashboard",
  inviteToken,
  oauthProviders = ["google"],
  googleHref,
  feedbackNotice,
  inviteBlocked = false,
  inviteBlockedMessage = "Registrierung ist nur mit Einladung möglich. Bitte nutze deinen Einladungslink.",
  termsHref = (() => {
    try {
      const host = new URL(MARKETING_SITE_URL).hostname;
      if (host === "localhost" || host === "127.0.0.1") return "https://brewai.de/agb";
    } catch {
      /* keep fallback */
    }
    return `${MARKETING_SITE_URL.replace(/\/$/, "")}/agb`;
  })(),
  privacyHref = (() => {
    try {
      const host = new URL(MARKETING_SITE_URL).hostname;
      if (host === "localhost" || host === "127.0.0.1") return "https://brewai.de/datenschutz";
    } catch {
      /* keep fallback */
    }
    return `${MARKETING_SITE_URL.replace(/\/$/, "")}/datenschutz`;
  })(),
  showModeSwitch = true,
  forgotPasswordHref = "/passwort-vergessen",
}: AuthCardProps) {
  const reactId = useId();
  const [uncontrolledMode, setUncontrolledMode] = useState<AuthMode>(defaultMode);
  const mode = controlledMode ?? uncontrolledMode;
  const isSignup = mode === "signup";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [brewery, setBrewery] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const strength = passwordStrength(password);
  const displayError = localError ?? error;
  const signupDisabled = isSignup && (inviteBlocked || !acceptedTerms);

  const setMode = (next: AuthMode) => {
    setLocalError(null);
    if (controlledMode === undefined) setUncontrolledMode(next);
    onModeChange?.(next);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    if (isSignup && !acceptedTerms) {
      event.preventDefault();
      setLocalError("Bitte AGB und Datenschutz bestätigen");
      return;
    }
    if (isSignup && inviteBlocked) {
      event.preventDefault();
      setLocalError(inviteBlockedMessage);
      return;
    }

    setLocalError(null);

    if (formAction) {
      // Native POST to existing auth routes — do not preventDefault.
      onSubmit({
        mode,
        email,
        password,
        brewery: isSignup ? brewery : undefined,
        acceptedTerms: isSignup ? acceptedTerms : undefined,
      });
      return;
    }

    event.preventDefault();
    await onSubmit({
      mode,
      email,
      password,
      brewery: isSignup ? brewery : undefined,
      acceptedTerms: isSignup ? acceptedTerms : undefined,
    });
  };

  const formProps = formAction
    ? { action: formAction, method: "post" as const, onSubmit: handleSubmit }
    : { onSubmit: handleSubmit };

  const panelFacts = isSignup
    ? [
        "Markenprofil, Sortiment und Mediathek an einem Ort",
        "Team-Zugriff auf dieselbe Bibliothek",
        "Weiterarbeiten dort, wo du aufgehört hast",
      ]
    : [
        "300 Tokens Startguthaben nach Onboarding",
        "Keine Kreditkarte für den Einstieg",
        "Alle Rechte bleiben bei deiner Brauerei",
      ];

  return (
    <div className={`${styles.page} ${studioFontClassName} evg-studio`}>
      <div className={styles.pageGrid} aria-hidden />
      <div className={styles.shell}>
        <a href={MARKETING_SITE_URL} className={styles.brandAbove} aria-label="BrewAI Startseite">
          <EvglabMark />
          <span className={styles.brandName}>BrewAI</span>
          <span className={styles.brandStudio}>STUDIO</span>
        </a>

        <div className={styles.card}>
        <section
          className={`${styles.formPane} ${isSignup ? styles.formPaneSignup : styles.formPaneLogin}`}
          aria-label={isSignup ? "Konto anlegen" : "Anmelden"}
        >
          <p className={styles.kicker}>{isSignup ? "Konto anlegen" : "Anmelden"}</p>
          <h1 className={styles.formTitle}>{isSignup ? "Brauerei anlegen" : "Willkommen zurück"}</h1>
          <p className={styles.formLead}>
            {isSignup
              ? "Drei Angaben, dann steht dein Markenprofil."
              : "Deine Mediathek, dein Sortiment, dein Markenstil — alles liegt bereit."}
          </p>

          {inviteBlocked && isSignup ? (
            <div className={`${styles.feedback} ${styles.feedbackError}`} role="status">
              {inviteBlockedMessage}
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

          <form key={mode} className={styles.fields} {...formProps}>
            <input type="hidden" name="next" value={nextPath} />
            {inviteToken ? <input type="hidden" name="inviteToken" value={inviteToken} /> : null}

            {isSignup ? (
              <div className={styles.field}>
                <label className={styles.label} htmlFor={`${reactId}-brewery`}>
                  Brauerei
                </label>
                <div className={styles.inputWrap}>
                  <Beer className={styles.inputIcon} size={17} strokeWidth={1.75} aria-hidden />
                  <input
                    id={`${reactId}-brewery`}
                    name="brewery"
                    type="text"
                    autoComplete="organization"
                    placeholder="Name der Brauerei"
                    className={styles.input}
                    value={brewery}
                    onChange={(e) => setBrewery(e.target.value)}
                  />
                </div>
              </div>
            ) : null}

            <div className={styles.field}>
              <label className={styles.label} htmlFor={`${reactId}-email`}>
                E-Mail
              </label>
              <div className={styles.inputWrap}>
                <Mail className={styles.inputIcon} size={17} strokeWidth={1.75} aria-hidden />
                <input
                  id={`${reactId}-email`}
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="name@beispiel.de"
                  className={styles.input}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.field}>
              <div className={styles.labelRow}>
                <label className={styles.label} htmlFor={`${reactId}-password`}>
                  Passwort
                </label>
                {!isSignup ? (
                  onForgotPassword ? (
                    <button type="button" className={styles.forgot} onClick={onForgotPassword}>
                      Passwort vergessen?
                    </button>
                  ) : (
                    <Link href={forgotPasswordHref} className={styles.forgot}>
                      Passwort vergessen?
                    </Link>
                  )
                ) : null}
              </div>
              <div className={styles.inputWrap}>
                <Lock className={styles.inputIcon} size={17} strokeWidth={1.75} aria-hidden />
                <input
                  id={`${reactId}-password`}
                  name="password"
                  type={showPw ? "text" : "password"}
                  required
                  minLength={isSignup ? 8 : undefined}
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  placeholder="••••••••"
                  className={styles.input}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className={styles.pwToggle}
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "Passwort ausblenden" : "Passwort anzeigen"}
                >
                  {showPw ? <EyeOff size={17} strokeWidth={1.8} /> : <Eye size={17} strokeWidth={1.8} />}
                </button>
              </div>
            </div>

            {isSignup && password ? (
              <div className={styles.strength} aria-live="polite">
                <div className={styles.strengthBars} aria-hidden>
                  {[1, 2, 3, 4].map((n) => {
                    const onClass =
                      strength >= 1
                        ? ([
                            styles.strengthBarOn1,
                            styles.strengthBarOn2,
                            styles.strengthBarOn3,
                            styles.strengthBarOn4,
                          ][strength - 1] ?? styles.strengthBarOn1)
                        : "";
                    return (
                      <span
                        key={n}
                        className={`${styles.strengthBar} ${strength >= n ? onClass : ""}`}
                      />
                    );
                  })}
                </div>
                <span className={styles.strengthLabel}>{STRENGTH_LABEL[strength]}</span>
              </div>
            ) : null}

            {isSignup ? (
              <div className={styles.terms}>
                <input
                  id={`${reactId}-terms`}
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => {
                    setAcceptedTerms(e.target.checked);
                    if (e.target.checked) setLocalError(null);
                  }}
                />
                <label htmlFor={`${reactId}-terms`}>
                  Ich akzeptiere die{" "}
                  <a href={termsHref} target="_blank" rel="noopener noreferrer">
                    AGB
                  </a>{" "}
                  und die{" "}
                  <a href={privacyHref} target="_blank" rel="noopener noreferrer">
                    Datenschutzerklärung
                  </a>
                  .
                </label>
              </div>
            ) : null}

            <button type="submit" className={styles.submit} disabled={loading || signupDisabled}>
              {loading
                ? isSignup
                  ? "Wird registriert …"
                  : "Wird angemeldet …"
                : isSignup
                  ? "Konto anlegen"
                  : "Anmelden"}
            </button>
          </form>

          {oauthProviders.length > 0 ? (
            <>
              <div className={styles.or}>oder</div>
              <div className={styles.oauthRow}>
                {oauthProviders.includes("google") ? (
                  googleHref ? (
                    <a
                      href={googleHref}
                      className={`${styles.oauthBtn} ${styles.oauthIcon}`}
                      rel="noopener"
                      aria-label="Mit Google"
                      title="Mit Google"
                    >
                      <GoogleG />
                    </a>
                  ) : (
                    <button
                      type="button"
                      className={`${styles.oauthBtn} ${styles.oauthIcon}`}
                      disabled={loading}
                      onClick={() => onOAuth("google")}
                      aria-label="Mit Google"
                      title="Mit Google"
                    >
                      <GoogleG />
                    </button>
                  )
                ) : null}
                <span className={styles.oauthHint}>Login über Anbieter</span>
              </div>
            </>
          ) : null}

          <p className={styles.footer}>
            {isSignup ? (
              <>
                Schon dabei?{" "}
                {showModeSwitch ? (
                  <button type="button" className={styles.forgot} onClick={() => setMode("login")}>
                    Zum Login
                  </button>
                ) : null}
              </>
            ) : (
              <>
                Neu hier?{" "}
                {showModeSwitch ? (
                  <button type="button" className={styles.forgot} onClick={() => setMode("signup")}>
                    Brauerei anlegen
                  </button>
                ) : null}
              </>
            )}
          </p>
        </section>

        <aside
          className={`${styles.curve} ${isSignup ? styles.curveSignup : styles.curveLogin}`}
          aria-hidden={false}
        >
          <div
            className={`${styles.curveInner} ${isSignup ? styles.curveInnerSignup : styles.curveInnerLogin}`}
          >
            <p className={styles.kicker}>{isSignup ? "Schon dabei?" : "Neu hier?"}</p>
            <h2 className={styles.panelTitle}>
              {isSignup
                ? "Weiter da, wo dein Sortiment aufgehört hat."
                : "Motive, die nach deiner Brauerei aussehen."}
            </h2>
            <p className={styles.panelLead}>
              {isSignup
                ? "Melde dich an — Markenstil, Sorten und Anlässe sind hinterlegt und werden automatisch mitgegeben."
                : "Markenprofil anlegen, Sortiment hinterlegen, in unter zwei Minuten das erste Motiv."}
            </p>
            <div className={styles.facts}>
              {panelFacts.map((fact) => (
                <div key={fact} className={styles.fact}>
                  <span className={styles.factIcon} aria-hidden>
                    <Check size={9} strokeWidth={2.5} />
                  </span>
                  <span>{fact}</span>
                </div>
              ))}
            </div>
            {showModeSwitch ? (
              <button
                type="button"
                className={styles.panelCta}
                onClick={() => setMode(isSignup ? "login" : "signup")}
              >
                {isSignup ? "Zum Login" : "Brauerei anlegen"}
              </button>
            ) : null}
          </div>
        </aside>
        </div>

        <div className={styles.pageFoot}>
          <span>app.brewai.de · Studio</span>
          <span>Rechte bei deiner Brauerei</span>
        </div>
      </div>
    </div>
  );
}
