"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { resolveAuthCallbackRedirect } from "@/lib/supabase/authEntryRedirect";

/** E-Mail-Auth-Links auf /anmelden (code, Hash, Recovery-Event) abfangen. */
export function AuthLinkBootstrap({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  useEffect(() => {
    const callback = resolveAuthCallbackRedirect(searchParams);
    if (callback) {
      window.location.replace(callback);
      return;
    }

    const hash = window.location.hash;
    if (!hash.includes("access_token")) return;

    let cancelled = false;

    void (async () => {
      try {
        const supabase = createClient();
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((event) => {
          if (cancelled) return;
          if (event === "PASSWORD_RECOVERY") {
            window.location.replace("/passwort-zuruecksetzen");
          }
        });

        await supabase.auth.getSession();
        const params = new URLSearchParams(hash.replace(/^#/, ""));
        if (params.get("type") === "recovery") {
          window.location.replace("/passwort-zuruecksetzen");
        }

        subscription.unsubscribe();
      } catch {
        /* Login-Formular bleibt nutzbar */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return null;
}
