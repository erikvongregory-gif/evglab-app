"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export function RegisterForm() {
  const searchParams = useSearchParams();
  const invite = searchParams.get("invite");

  return (
    <div className="space-y-4">
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Registrierung ist aktuell nur per Einladung möglich.
      </p>
      {invite ? (
        <Link
          href={`/invite/${encodeURIComponent(invite)}`}
          className="inline-flex w-full items-center justify-center rounded-lg bg-gradient-to-br from-[#d46830] to-[#b84d15] px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:brightness-105"
        >
          Einladung öffnen
        </Link>
      ) : null}
      <p className="text-center text-sm text-zinc-600">
        Schon registriert?{" "}
        <Link href="/anmelden" className="font-medium text-[#c65a20] hover:underline">
          Anmelden
        </Link>
      </p>
    </div>
  );
}
