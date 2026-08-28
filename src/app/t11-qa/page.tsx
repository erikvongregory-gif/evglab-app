"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SignInPage } from "@/components/ui/sign-in";

function AuthQaDemo({ view }: { view: string }) {
  const feedbackError =
    view === "error" ? "E-Mail oder Passwort ist falsch. Bitte prüfen und erneut versuchen." : undefined;
  const feedbackNotice = view === "notice" ? "Du wurdest abgemeldet. Melde dich jederzeit wieder an." : undefined;
  const initialMode = view === "register" ? ("register" as const) : ("signin" as const);

  return (
    <>
      <p
        style={{
          position: "fixed",
          top: 8,
          left: 8,
          zIndex: 99,
          margin: 0,
          fontSize: 11,
          color: "#7e7263",
          fontFamily: "monospace",
        }}
      >
        T11 QA — Auth ({view}, Mock, keine API)
      </p>
      <SignInPage
        nextPath="/dashboard"
        initialMode={initialMode}
        inviteOnly={false}
        waitlistMode={view === "waitlist"}
        feedbackError={feedbackError}
        feedbackNotice={feedbackNotice}
        signInOnly={view === "admin"}
      />
    </>
  );
}

function T11QaInner() {
  const searchParams = useSearchParams();
  const view = searchParams.get("view") ?? "signin";
  return <AuthQaDemo view={view} />;
}

export default function T11QaPage() {
  return (
    <Suspense fallback={null}>
      <T11QaInner />
    </Suspense>
  );
}
