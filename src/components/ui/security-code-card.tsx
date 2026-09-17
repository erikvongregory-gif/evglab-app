"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  const [backupCode, setBackupCode] = useState("");
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>("idle");
  const [submitError, setSubmitError] = useState<string | undefined>();
  const [resendCooldown, setResendCooldown] = useState(0);

  const complete = code.length === DIGIT_COUNT || (ownerHasBackupCode && backupCode.trim().length >= 6);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = window.setTimeout(() => setResendCooldown((n) => Math.max(0, n - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [resendCooldown]);

  const resetAfterFail = useCallback(() => {
    setOutcome("idle");
    setVerifyBusy(false);
    setCode("");
    setBackupCode("");
  }, []);

  const submitCode = useCallback(async (): Promise<
    { ok: true; next: string } | { ok: false; error: string }
  > => {
    const value = code.length === DIGIT_COUNT ? code : backupCode.trim();
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
  }, [backupCode, code, nextPath]);

  const onVerify = async () => {
    if (verifyBusy || outcome !== "idle" || !complete) return;
    setSubmitError(undefined);
    setVerifyBusy(true);
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
  };

  const canEnterCode = hasPendingCode || ownerHasBackupCode;
  const bannerError = errorMessage(submitError ?? error);
  const title = useMemo(() => {
    if (outcome === "ok") return "Verifiziert";
    if (outcome === "fail") return "Code ungültig";
    return "Sicherheitscode";
  }, [outcome]);

  return (
    <div
      className={cn(
        "flex min-h-dvh w-full items-center justify-center bg-background p-4",
        studioFontClassName,
      )}
    >
      <div className="mx-auto w-full max-w-[480px]">
        <a
          href={MARKETING_SITE_URL}
          className="mb-6 flex items-center justify-center gap-2 text-foreground"
          aria-label="BrewAI Startseite"
        >
          <EvglabMark size={22} />
          <span className="font-semibold tracking-tight">BrewAI</span>
        </a>

        <div className="relative overflow-hidden rounded-xl border border-border/50 bg-card/80 shadow-xl backdrop-blur-sm">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5" />
          <div className="relative z-10 flex flex-col gap-6 p-6 md:p-8">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="relative flex size-16 items-center justify-center rounded-full bg-background shadow-xs ring-1 ring-border ring-inset md:size-20">
                <MailCheck className="size-7 text-muted-foreground md:size-8" />
              </div>
              <div className="space-y-1.5">
                <h1 className="font-medium text-xl md:text-xl">{title}</h1>
                <p className="text-muted-foreground text-sm tracking-tight">
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
            {bannerError ? (
              <p
                className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-center text-destructive text-sm"
                role="alert"
              >
                {bannerError}
              </p>
            ) : null}

            {outcome === "ok" ? (
              <p className="text-center text-sm text-muted-foreground" role="status">
                Dieses Gerät wird 30 Tage vertraut. Weiterleitung …
              </p>
            ) : null}

            {canEnterCode && outcome === "idle" ? (
              <div className="space-y-5">
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={DIGIT_COUNT}
                    value={code}
                    onChange={setCode}
                    disabled={verifyBusy}
                    autoFocus={hasPendingCode}
                  >
                    <InputOTPGroup className="gap-2 md:gap-3">
                      {Array.from({ length: DIGIT_COUNT }, (_, i) => (
                        <InputOTPSlot
                          key={i}
                          index={i}
                          className="size-12 rounded-md border text-lg md:size-14"
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
                  />
                ) : null}

                <Button
                  type="button"
                  className="h-11 w-full"
                  disabled={verifyBusy || !complete}
                  onClick={() => void onVerify()}
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
                  className="space-y-3"
                >
                  <input type="hidden" name="action" value="send" />
                  <input type="hidden" name="next" value={nextPath} />
                  <Button
                    type="submit"
                    variant={canEnterCode ? "outline" : "default"}
                    className="h-11 w-full"
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
                  <Button type="submit" variant="ghost" className="w-full" disabled={verifyBusy}>
                    Abmelden
                  </Button>
                </form>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
