"use client";

import { useEffect, useState } from "react";
import { resolveAuthCallbackRedirect } from "@/lib/supabase/authEntryRedirect";
import { createClient } from "@/lib/supabase/client";

function hasRecoveryHash(hash: string): boolean {
  if (!hash || hash.length < 2) return false;
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  return params.has("access_token") && params.get("type") === "recovery";
}

async function bootstrapRecoveryFromHash(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!hasRecoveryHash(window.location.hash)) return false;

  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return Boolean(session);
  } catch {
    return false;
  }
}

export function AuthLandingRouter({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const [message, setMessage] = useState("Weiterleitung …");

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (hasRecoveryHash(window.location.hash)) {
        setMessage("Passwort-Reset wird vorbereitet …");
        const ok = await bootstrapRecoveryFromHash();
        if (cancelled) return;
        if (ok) {
          window.location.replace("/passwort-zuruecksetzen");
          return;
        }
      }

      const callback = resolveAuthCallbackRedirect(searchParams);
      if (callback) {
        window.location.replace(callback);
        return;
      }

      const qs = new URLSearchParams();
      for (const [key, raw] of Object.entries(searchParams)) {
        if (raw === undefined) continue;
        const vals = Array.isArray(raw) ? raw : [raw];
        for (const v of vals) qs.append(key, v);
      }
      const suffix = qs.toString();
      window.location.replace(suffix ? `/anmelden?${suffix}` : "/anmelden");
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#131211] px-4">
      <p className="text-sm text-[#c4bdb3]">{message}</p>
    </main>
  );
}
