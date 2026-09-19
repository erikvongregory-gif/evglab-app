"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MailCheck } from "lucide-react";

import { EvglabMark } from "@/components/studio/evglab-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Separator } from "@/components/ui/separator";
import { studioFontClassName } from "@/lib/fonts/studio-fonts";
import { MARKETING_SITE_URL } from "@/lib/siteConfig";
import { cn } from "@/lib/utils";

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
  const [code, setCode] = useState("");
  const [displayCode, setDisplayCode] = useState("");
  const [rattling, setRattling] = useState<boolean[]>(() => Array(DIGIT_COUNT).fill(false));
  const [backupCode, setBackupCode] = useState("");
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>("idle");
  const [submitError, setSubmitError] = useState<string | undefined>();
  const [resendCooldown, setResendCooldown] = useState(0);
  const timersRef = useRef<number[]>([]);
  const codeRef = useRef(code);
  codeRef.current = code;

  const complete = code.length === DIGIT_COUNT || (ownerHasBackupCode && backupCode.trim().length >= 6);

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

  const clearTimers = () => {
    timersRef.current.forEach((id) => window.clearInterval(id));
    timersRef.current = [];
  };

  const resetAfterFail = useCallback(() => {
    setOutcome("idle");
    setVerifyBusy(false);
    setCode("");
    setDisplayCode("");
    setRattling(Array(DIGIT_COUNT).fill(false));
    setBackupCode("");
  }, []);

  const submitCode = useCallback(async (): Promise<
    { ok: true; next: string } | { ok: false; error: string }
  > => {
    const value =
      codeRef.current.length === DIGIT_COUNT ? codeRef.current : backupCode.trim();
    const body = new FormData();
    body.set("next", nextPath);
    body.set("code", value);
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
  }, [backupCode, nextPath]);

  const finishWithOutcome = useCallback(async () => {
    try {
      const result = await submitCode();
      if (result.ok) {
        setOutcome("ok");
        window.setTimeout(() => {
          window.location.assign(result.next);
        }, 900);
        return;
      }
      setSubmitError(result.error);
      setOutcome("fail");
      window.setTimeout(resetAfterFail, 1400);
    } catch {
      setSubmitError("admin_2fa_invalid");
      setOutcome("fail");
      window.setTimeout(resetAfterFail, 1400);
    }
  }, [resetAfterFail, submitCode]);

  const runVerifyAnimationThenSubmit = () => {
    if (verifyBusy || outcome !== "idle" || !complete) return;

    const usingBackup =
      ownerHasBackupCode &&
      backupCode.trim().length >= 6 &&
      code.length !== DIGIT_COUNT;

    setSubmitError(undefined);
    setVerifyBusy(true);

    if (usingBackup || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      void finishWithOutcome();
      return;
    }

    clearTimers();
    const finalDigits = code.split("");
    setRattling(finalDigits.map(() => true));
    setDisplayCode(code);

    finalDigits.forEach((digit, i) => {
      const iv = window.setInterval(() => {
        setDisplayCode((prev) => {
          const chars = prev.padEnd(DIGIT_COUNT, "0").split("");
          chars[i] = String(Math.floor(Math.random() * 10));
          return chars.join("").slice(0, DIGIT_COUNT);
        });
      }, 45);
      timersRef.current.push(iv);

      window.setTimeout(() => {
        window.clearInterval(iv);
        setDisplayCode((prev) => {
          const chars = prev.padEnd(DIGIT_COUNT, "0").split("");
          chars[i] = digit;
          return chars.join("").slice(0, DIGIT_COUNT);
        });
        setRattling((prev) => {
          const next = [...prev];
          next[i] = false;
          return next;
        });
        if (i === finalDigits.length - 1) {
          window.setTimeout(() => {
            void finishWithOutcome();
          }, 280);
        }
      }, 420 + i * 220);
    });
  };

  const canEnterCode = hasPendingCode || ownerHasBackupCode;
  const bannerError = errorMessage(submitError ?? error);
  const otpValue = verifyBusy && displayCode ? displayCode : code;
  const title = useMemo(() => {
    if (outcome === "ok") return "Verifiziert";
    if (outcome === "fail") return "Falsch";
    return "Sicherheitscode";
  }, [outcome]);

  return (
    <div className={cn(styles.page, studioFontClassName)}>
      <div className={styles.shell}>
        <a
          href={MARKETING_SITE_URL}
          className={styles.brand}
          aria-label="BrewAI Startseite"
        >
          <EvglabMark size={22} />
          <span className={styles.brandName}>BrewAI</span>
          <span className={styles.beta}>Beta</span>
        </a>

        <div className={styles.card}>
          <div className={styles.cardGlow} aria-hidden />
          <div className={styles.cardBody}>
            <div className={styles.header}>
              <div className={styles.iconRing}>
                <MailCheck className={styles.icon} aria-hidden />
              </div>
              <div className={styles.headerText}>
                <h1 className={styles.title}>{title}</h1>
                <p className={styles.lead}>
                  {hasPendingCode ? (
                    <>
                      Wir haben einen 6-stelligen Code an <strong>{email}</strong> gesendet.
                    </>
                  ) : (
                    <>
                      Zum Schutz deines Kontos brauchen wir einen Code für <strong>{email}</strong>.
                    </>
                  )}
                </p>
              </div>
            </div>

            <Separator />

            {showDevForward && devForwardTo ? (
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-muted-foreground text-xs">
                Dev-Mail-Sink aktiv: Zustellung an <strong>{devForwardTo}</strong>.
              </div>
            ) : null}

            {notice === "resent" ? (
              <p className="text-center text-sm text-muted-foreground" role="status">
                Neuer Code wurde gesendet.
              </p>
            ) : null}
            {bannerError && outcome === "idle" ? (
              <p
                className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-center text-destructive text-sm"
                role="alert"
              >
                {bannerError}
              </p>
            ) : null}

            {canEnterCode && outcome === "idle" ? (
              <div className={styles.formBlock}>
                <div className={styles.otpWrap}>
                  <InputOTP
                    maxLength={DIGIT_COUNT}
                    value={otpValue}
                    onChange={(value) => {
                      if (verifyBusy) return;
                      setCode(value);
                    }}
                    disabled={verifyBusy}
                    autoFocus={hasPendingCode}
                    containerClassName={styles.otpContainer}
                  >
                    <InputOTPGroup className={styles.otpGroup}>
                      {Array.from({ length: DIGIT_COUNT }, (_, i) => (
                        <InputOTPSlot
                          key={i}
                          index={i}
                          className={cn(
                            styles.otpSlot,
                            rattling[i] && styles.rattling,
                          )}
                          style={{ animationDelay: `${0.28 + i * 0.05}s` }}
                        />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                {ownerHasBackupCode ? (
                  <Input
                    type="text"
                    autoComplete="off"
                    placeholder="Oder Recovery-Code"
                    value={backupCode}
                    disabled={verifyBusy}
                    onChange={(e) => setBackupCode(e.target.value)}
                    className={styles.backupInput}
                  />
                ) : null}

                <Button
                  type="button"
                  className={cn("h-11 w-full", styles.actionBtn)}
                  disabled={verifyBusy || !complete}
                  onClick={runVerifyAnimationThenSubmit}
                >
                  {verifyBusy ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Wird geprüft …
                    </>
                  ) : (
                    "Bestätigen"
                  )}
                </Button>
              </div>
            ) : null}

            {outcome === "idle" ? (
              <>
                <Separator />
                <form
                  action="/auth/admin-2fa/verify"
                  method="post"
                  onSubmit={() => {
                    if (hasPendingCode) setResendCooldown(30);
                  }}
                  className={styles.actions}
                >
                  <input type="hidden" name="action" value="send" />
                  <input type="hidden" name="next" value={nextPath} />
                  <Button
                    type="submit"
                    variant={canEnterCode ? "outline" : "default"}
                    className={cn("h-11 w-full", styles.actionBtn)}
                    disabled={verifyBusy || (hasPendingCode && resendCooldown > 0)}
                  >
                    {hasPendingCode
                      ? resendCooldown > 0
                        ? `Neuer Code in ${resendCooldown}s`
                        : "Code erneut senden"
                      : "Code per E-Mail senden"}
                  </Button>
                </form>

                <form action="/auth/signout" method="post">
                  <Button
                    type="submit"
                    variant="ghost"
                    className={cn("w-full", styles.signOut)}
                    disabled={verifyBusy}
                  >
                    Abmelden
                  </Button>
                </form>
              </>
            ) : null}
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
              <div className={styles.verifiedTitle}>Verifiziert</div>
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
    </div>
  );
}
