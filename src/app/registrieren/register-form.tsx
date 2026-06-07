"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

/**
 * Legacy-Shim: Registrierung läuft auf /anmelden?mode=register.
 * Bleibt erhalten, damit veraltete Build-/HMR-Referenzen nicht brechen.
 */
export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const q = new URLSearchParams(searchParams.toString());
    q.set("mode", "register");
    const qs = q.toString();
    router.replace(qs ? `/anmelden?${qs}` : "/anmelden?mode=register");
  }, [router, searchParams]);

  return null;
}
