"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

async function serverAuthReady(): Promise<{ ok: boolean; admin2faRequired?: boolean }> {
  try {
    const res = await fetch("/api/auth/status", { credentials: "same-origin", cache: "no-store" });
    if (!res.ok) return { ok: false };
    const json = (await res.json()) as { authenticated?: boolean; admin2faRequired?: boolean };
    return { ok: Boolean(json.authenticated), admin2faRequired: json.admin2faRequired };
  } catch {
    return { ok: false };
  }
}

function delayMs(attempt: number) {
  return attempt < 12 ? 120 : attempt < 28 ? 250 : 400;
}

export function AuthFinishClient({ initialNext = "/dashboard" }: { initialNext?: string }) {
  const [message, setMessage] = useState("Anmeldung wird abgeschlossen …");

  useEffect(() => {
    const next = initialNext;
    let cancelled = false;

    void (async () => {
      for (let attempt = 0; attempt < 55; attempt += 1) {
        if (cancelled) return;

        const server = await serverAuthReady();
        if (server.ok) {
          window.location.replace(server.admin2faRequired ? "/dashboard/2fa-email" : next);
          return;
        }

        try {
          if (attempt === 2 || attempt === 8) {
            await fetch("/api/auth/repair-session", {
              method: "POST",
              credentials: "same-origin",
              cache: "no-store",
            }).catch(() => undefined);
          }
          const supabase = createClient();
          if (attempt === 0 || attempt % 5 === 0) {
            await supabase.auth.refreshSession().catch(() => undefined);
          }
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session) {
            const recheck = await serverAuthReady();
            window.location.replace(recheck.admin2faRequired ? "/dashboard/2fa-email" : next);
            return;
          }
        } catch {
          /* Browser-Client optional — Server-Check ist maßgeblich */
        }

        await new Promise((resolve) => setTimeout(resolve, delayMs(attempt)));
      }

      if (!cancelled) {
        setMessage("Session nicht gefunden. Weiter zur Anmeldung …");
        window.setTimeout(() => {
          window.location.replace("/anmelden?error=session_pending");
        }, 800);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialNext]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#131211] px-4">
      <p className="text-sm text-[#c4bdb3]">{message}</p>
    </main>
  );
}
