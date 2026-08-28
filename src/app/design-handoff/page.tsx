import type { Metadata } from "next";
import { Suspense } from "react";
import DesignHandoffPage from "./page-client";

export const metadata: Metadata = {
  title: "Design Handoff (dev)",
  robots: { index: false, follow: false },
};

export default function DesignHandoffRoute() {
  if (process.env.NODE_ENV === "production") {
    return (
      <main style={{ padding: 48, fontFamily: "system-ui" }}>
        <h1>Nicht verfügbar</h1>
        <p>Design-Handoff nur im Development-Modus.</p>
      </main>
    );
  }

  return (
    <Suspense fallback={<div className="evg-studio" style={{ minHeight: "100vh", background: "var(--bg-0, #0b0a08)" }} />}>
      <DesignHandoffPage />
    </Suspense>
  );
}
