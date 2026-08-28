"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { StudioSearchProvider } from "@/components/studio/studio-global-search";
import { studioFontClassName } from "@/lib/fonts/studio-fonts";

function SearchFieldMock() {
  return (
    <div className="evg-shell-topbar-search evg-shell-topbar-search--desktop" style={{ maxWidth: 380 }}>
      <div className="evg-shell-topbar-search-field studio-field-with-icon">
        <span className="evg-shell-topbar-search-icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5 L13 13" strokeLinecap="round" />
          </svg>
        </span>
        <input
          className="studio-field evg-shell-topbar-search-input"
          placeholder="Suche · Bereiche und Motive …"
          readOnly
          aria-label="Suche Vorschau"
        />
        <span className="evg-shell-topbar-search-kbd studio-mono" aria-hidden="true">
          Ctrl+K
        </span>
      </div>
    </div>
  );
}

function SearchQaInner() {
  const searchParams = useSearchParams();
  const view = searchParams.get("view") ?? "empty";

  const subtitle = useMemo(() => {
    const labels: Record<string, string> = {
      empty: "Leer / alle Bereiche",
      quick: "Quick-Link-Filter",
      media: "Medien-Treffer (Mock)",
      "no-results": "Keine Treffer",
      mobile: "Mobile Panel",
    };
    return labels[view] ?? view;
  }, [view]);

  return (
    <div className={`evg-studio ${studioFontClassName}`} style={{ minHeight: "100dvh", background: "var(--app)", padding: 24 }}>
      <style>{`html, body { background: var(--app) !important; margin: 0; }`}</style>
      <p style={{ margin: "0 0 20px", fontSize: 12, color: "var(--t3)" }}>
        T11.1 QA — Globale Suche ({subtitle}, Mock Provider)
      </p>
      <StudioSearchProvider>
        <SearchFieldMock />
        <p style={{ marginTop: 16, fontSize: 12, color: "var(--t3)" }}>
          Öffne die echte Suche über Ctrl+K oder klicke in ein Suchfeld auf einer Dashboard-Route. Diese Seite dient der
          CSS-/Layout-Vorschau.
        </p>
      </StudioSearchProvider>
    </div>
  );
}

export default function T11SearchQaPage() {
  return (
    <Suspense fallback={null}>
      <SearchQaInner />
    </Suspense>
  );
}
