"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ResetPasswordPage } from "@/components/ui/password-reset-pages";
import { createClient } from "@/lib/supabase/client";

type Props = {
  notice?: string;
  error?: string;
  children?: ReactNode;
};

async function serverHasUser(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/status", { credentials: "same-origin", cache: "no-store" });
    if (!res.ok) return false;
    const json = (await res.json()) as { authenticated?: boolean };
    return Boolean(json.authenticated);
  } catch {
    return false;
  }
}

function hasRecoveryHash(hash: string): boolean {
  if (!hash || hash.length < 2) return false;
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  return params.has("access_token");
}

export function ResetPasswordSessionGate({ notice, error }: Props) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (await serverHasUser()) {
        if (!cancelled) setReady(true);
        return;
      }

      try {
        const supabase = createClient();

        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
          if (cancelled) return;
          if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
            setReady(true);
          }
        });

        if (hasRecoveryHash(window.location.hash)) {
          await supabase.auth.getSession();
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session) {
          if (window.location.hash) {
            window.history.replaceState(null, "", window.location.pathname + window.location.search);
          }
          if (!cancelled) setReady(true);
          subscription.unsubscribe();
          return;
        }

        const search = new URLSearchParams(window.location.search);
        const code = search.get("code");
        if (code) {
          window.location.replace(
            `/auth/callback?code=${encodeURIComponent(code)}&next=${encodeURIComponent("/passwort-zuruecksetzen")}`,
          );
          subscription.unsubscribe();
          return;
        }

        for (let attempt = 0; attempt < 15; attempt += 1) {
          if (cancelled) break;
          await new Promise((resolve) => setTimeout(resolve, 200));
          if (await serverHasUser()) {
            setReady(true);
            subscription.unsubscribe();
            return;
          }
          const {
            data: { session: retrySession },
          } = await supabase.auth.getSession();
          if (retrySession) {
            setReady(true);
            subscription.unsubscribe();
            return;
          }
        }

        subscription.unsubscribe();
        if (!cancelled) setFailed(true);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    if (typeof window !== "undefined") {
      window.location.replace("/passwort-vergessen?error=session");
    }
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#131211] px-4">
        <p className="text-sm text-[#c4bdb3]">Link ungültig — weiter …</p>
      </main>
    );
  }

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#131211] px-4">
        <p className="text-sm text-[#c4bdb3]">Passwort-Reset wird vorbereitet …</p>
      </main>
    );
  }

  return <ResetPasswordPage notice={notice} error={error} />;
}
