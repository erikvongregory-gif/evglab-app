"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { studioFontClassName } from "@/lib/fonts/studio-fonts";
import styles from "./security-code-card.module.css";

const DIGIT_COUNT = 6;

export type SecurityCodeCardProps = {
  email: string;
  nextPath: string;
  hasPendingCode: boolean;
  ownerHasBackupCode: boolean;
  showDevForward: boolean;
  devForwardTo?: string;
  notice?: string;
  error?: string;
};

type Outcome = "idle" | "ok" | "fail";

function errorMessage(error: string | undefined) {
  if (!error) return null;
  if (error === "missing_code") return "Bitte gib den Code ein.";
  if (error === "email_failed") {
    return "Code konnte nicht gesendet werden. Prüfe die E-Mail-Konfiguration oder versuch es erneut.";
  }
  if (error === "admin_2fa_session_expired") {
    return "Sitzung abgelaufen. Bitte fordere einen neuen Code an.";
  }
  return "Code ungültig oder abgelaufen. Bitte fordere einen neuen Code an.";
}

export function SecurityCodeCard({
  email,
  nextPath,
  hasPendingCode,
  ownerHasBackupCode,
  showDevForward,
  devForwardTo,
  notice,
  error,
}: SecurityCodeCardProps) {
  const [digits, setDigits] = useState<string[]>(() => Array(DIGIT_COUNT).fill(""));
  const [display, setDisplay] = useState<string[]>(() => Array(DIGIT_COUNT).fill(""));
  const [rattling, setRattling] = useState<boolean[]>(() => Array(DIGIT_COUNT).fill(false));
  const [backupCode, setBackupCode] = useState("");
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>("idle");
  const [localError, setLocalError] = useState<string | undefined>(error);
  const [resendCooldown, setResendCooldown] = useState(0);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const timersRef = useRef<number[]>([]);

  const complete = digits.every((d) => d !== "") || (ownerHasBackupCode && backupCode.trim().length >= 6);
  const confirmOpacity = !complete && !verifyBusy ? 0.55 : 1;

  useEffect(() => {
    setLocalError(error);
  }, [error]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = window.setTimeout(() => setResendCooldown((n) => Math.max(0, n - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [resendCooldown]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((id) => window.clearInterval(id));
      timersRef.current = [];
    };
  }, []);

  const setDigit = useCallback((i: number, val: string) => {
    setDigits((prev) => {
      const next = [...prev];
      next[i] = val;
      return next;
    });
  }, []);

  const handleInput = (i: number, raw: string) => {
    const cleaned = raw.replace(/\D/g, "");
    if (cleaned.length > 1) {
      // Paste / autofill of full OTP
      const chars = cleaned.slice(0, DIGIT_COUNT).split("");
      setDigits((prev) => {
        const next = [...prev];
        for (let j = 0; j < DIGIT_COUNT; j += 1) next[j] = chars[j] ?? "";
        return next;
      });
      const focusAt = Math.min(chars.length, DIGIT_COUNT - 1);
      refs.current[focusAt]?.focus();
      return;
    }
    const v = cleaned.slice(-1);
    setDigit(i, v);
    if (v && refs.current[i + 1]) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, key: string) => {
    if (key === "Backspace" && !digits[i] && refs.current[i - 1]) {
      refs.current[i - 1]?.focus();
    }
  };

  const clearTimers = () => {
    timersRef.current.forEach((id) => window.clearInterval(id));
    timersRef.current = [];
  };

  const resetAfterFail = useCallback(() => {
    setOutcome("idle");
    setVerifyBusy(false);
    setDigits(Array(DIGIT_COUNT).fill(""));
    setDisplay(Array(DIGIT_COUNT).fill(""));
    setRattling(Array(DIGIT_COUNT).fill(false));
    setBackupCode("");
    window.setTimeout(() => refs.current[0]?.focus(), 50);
  }, []);

  const submitCode = useCallback(async (): Promise<{ ok: true; next: string } | { ok: false; error: string }> => {
    const code =
      digits.every((d) => d !== "") ? digits.join("") : backupCode.trim();
    const body = new FormData();
    body.set("next", nextPath);
    body.set("code", code);
    body.set("client", "1");
    const res = await fetch("/auth/admin-2fa/verify", {
      method: "POST",
      body,
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    let data: { ok?: boolean; next?: string; error?: string } | null = null;
    try {
      data = (await res.json()) as { ok?: boolean; next?: string; error?: string };
    } catch {
      data = null;
    }
    if (res.ok && data?.ok && data.next) return { ok: true, next: data.next };
    return { ok: false, error: data?.error || "admin_2fa_invalid" };
  }, [backupCode, digits, nextPath]);

  const finishWithOutcome = useCallback(
    async () => {
      try {
        const result = await submitCode();
        if (result.ok) {
          setOutcome("ok");
          window.setTimeout(() => {
            window.location.assign(result.next);
          }, 900);
          return;
        }
        setLocalError(result.error);
        setOutcome("fail");
        window.setTimeout(resetAfterFail, 1400);
      } catch {
        setLocalError("admin_2fa_invalid");
        setOutcome("fail");
        window.setTimeout(resetAfterFail, 1400);
      }
    },
    [resetAfterFail, submitCode],
  );

  const runVerifyAnimationThenSubmit = () => {
    if (verifyBusy || outcome !== "idle") return;
    const usingBackup = ownerHasBackupCode && backupCode.trim().length >= 6 && !digits.every((d) => d !== "");
    if (!complete) return;

    setLocalError(undefined);
    setVerifyBusy(true);

    if (usingBackup || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      void finishWithOutcome();
      return;
    }

    clearTimers();
    const finalCode = [...digits];
    setRattling(finalCode.map(() => true));
    setDisplay([...finalCode]);

    finalCode.forEach((digit, i) => {
      const iv = window.setInterval(() => {
        setDisplay((prev) => {
          const d = [...prev];
          d[i] = String(Math.floor(Math.random() * 10));
          return d;
        });
      }, 45);
      timersRef.current.push(iv);

      window.setTimeout(() => {
        window.clearInterval(iv);
        setDisplay((prev) => {
          const d = [...prev];
          d[i] = digit;
          return d;
        });
        setRattling((prev) => {
          const r = [...prev];
          r[i] = false;
          return r;
        });
        if (i === finalCode.length - 1) {
          window.setTimeout(() => {
            void finishWithOutcome();
          }, 280);
        }
      }, 420 + i * 220);
    });
  };

  const hiddenCode = useMemo(() => {
    if (digits.every((d) => d !== "")) return digits.join("");
    return backupCode.trim();
  }, [digits, backupCode]);

  const canEnterCode = hasPendingCode || ownerHasBackupCode;
  const bannerError = errorMessage(localError);

  return (
    <div className={`${styles.page} ${studioFontClassName} evg-studio`}>
      <div className={styles.card}>
        <div className={styles.glow} aria-hidden />
        <div className={styles.topLine} aria-hidden />

        <div className={styles.body}>
          <div className={styles.lock} aria-hidden>
            <svg width="22" height="22" viewBox="0 0 16 16">
              <rect
                x="3"
                y="7"
                width="10"
                height="7"
                rx="1.6"
                fill="rgba(201,162,77,.10)"
                stroke="var(--ac, #c9a24d)"
                strokeWidth="1.4"
              />
              <path
                d="M5.6 7V5.4a2.4 2.4 0 0 1 4.8 0V7"
                fill="none"
                stroke="var(--ac, #c9a24d)"
                strokeWidth="1.4"
              />
            </svg>
          </div>

          <div className={styles.kicker}>VERIFIZIERUNG</div>
          <h1 className={styles.title}>Sicherheitscode</h1>
          <p className={styles.lead}>
            {hasPendingCode ? (
              <>
                Wir haben einen 6-stelligen Code für <strong>{email}</strong> ausgestellt. Nach der
                Bestätigung merken wir uns dieses Gerät 30 Tage.
              </>
            ) : (
              <>
                Zum Schutz deines Kontos brauchen wir einen Code per E-Mail. Fordere ihn jetzt für{" "}
                <strong>{email}</strong> an.
              </>
            )}
          </p>

          {showDevForward && devForwardTo ? (
            <div className={styles.warn}>
              Dev-Mail-Sink aktiv (<code>RESEND_DEV_FORWARD_TO</code>): physische Zustellung an{" "}
              <strong>{devForwardTo}</strong>. Logische Identität bleibt <strong>{email}</strong>.
            </div>
          ) : null}

          {notice === "resent" ? <p className={styles.bannerOk}>Neuer Code wurde gesendet.</p> : null}
          {bannerError ? <p className={styles.bannerErr}>{bannerError}</p> : null}

          {canEnterCode ? (
            <>
              <div className={styles.label}>
                {ownerHasBackupCode ? "E-Mail-Code" : "E-Mail-Code"}
              </div>
              <div className={styles.digits}>
                {Array.from({ length: DIGIT_COUNT }, (_, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      refs.current[i] = el;
                    }}
                    className={`${styles.otpbox}${rattling[i] ? ` ${styles.rattling}` : ""}`}
                    type="text"
                    inputMode="numeric"
                    autoComplete={i === 0 ? "one-time-code" : "off"}
                    maxLength={DIGIT_COUNT}
                    value={verifyBusy ? display[i] : digits[i]}
                    disabled={verifyBusy}
                    aria-label={`Ziffer ${i + 1} von ${DIGIT_COUNT}`}
                    onChange={(e) => handleInput(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e.key)}
                    autoFocus={i === 0 && hasPendingCode}
                  />
                ))}
              </div>

              {ownerHasBackupCode ? (
                <input
                  className={styles.backup}
                  type="text"
                  autoComplete="off"
                  placeholder="Oder Recovery-Code"
                  value={backupCode}
                  disabled={verifyBusy}
                  onChange={(e) => setBackupCode(e.target.value)}
                />
              ) : null}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  runVerifyAnimationThenSubmit();
                }}
              >
                <input type="hidden" name="next" value={nextPath} />
                <input type="hidden" name="code" value={hiddenCode} />
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  style={{ opacity: confirmOpacity }}
                  disabled={verifyBusy || !complete}
                >
                  {verifyBusy ? "Wird geprüft …" : "Bestätigen"}
                </button>
              </form>
            </>
          ) : null}

          <form
            action="/auth/admin-2fa/verify"
            method="post"
            onSubmit={() => {
              if (hasPendingCode) setResendCooldown(30);
            }}
          >
            <input type="hidden" name="action" value="send" />
            <input type="hidden" name="next" value={nextPath} />
            <button
              type="submit"
              className={canEnterCode ? styles.btnSecondary : styles.btnPrimary}
              disabled={verifyBusy || (hasPendingCode && resendCooldown > 0)}
            >
              {hasPendingCode
                ? resendCooldown > 0
                  ? `Neuer Code in ${resendCooldown}s`
                  : "Neuen Code senden"
                : "Code per E-Mail senden"}
            </button>
          </form>

          <form action="/auth/signout" method="post">
            <button type="submit" className={styles.btnGhost} disabled={verifyBusy}>
              Abmelden
            </button>
          </form>
        </div>

        {outcome === "ok" ? (
          <div className={styles.verified} role="status" aria-live="polite">
            <div className={styles.checkRing}>
              <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden>
                <path
                  className={styles.checkPath}
                  d="M5 12.5l4.5 4.5L19 7.5"
                  fill="none"
                  stroke="#6FA96F"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className={styles.verifiedTitle}>Richtig</div>
            <div className={styles.verifiedLead}>
              Dieses Gerät wird für 30 Tage vertraut. Du wirst weitergeleitet …
            </div>
          </div>
        ) : null}

        {outcome === "fail" ? (
          <div className={`${styles.verified} ${styles.failed}`} role="alert" aria-live="assertive">
            <div className={styles.failRing}>
              <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden>
                <path
                  className={styles.failPath}
                  d="M7 7l10 10M17 7L7 17"
                  fill="none"
                  stroke="#E07070"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className={styles.verifiedTitle}>Falsch</div>
            <div className={styles.verifiedLead}>
              Code ungültig oder abgelaufen. Versuch es erneut.
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
