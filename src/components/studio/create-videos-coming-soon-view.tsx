import Link from "next/link";
import { StudioButton, StudioPageHeader } from "@/components/studio/ui";

export function CreateVideosComingSoonView() {
  return (
    <>
      <StudioPageHeader
        eyebrow="Videos Erstellen"
        title={
          <>
            Demnächst <em>verfügbar</em>
          </>
        }
        subtitle="KI-Videos im Markenstil — Reels, Stories und Werbeclips aus deinem Markenprofil."
      />
      <div className="studio-card studio-card-pad" style={{ marginTop: 22, maxWidth: 560 }}>
        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, color: "var(--tx-1)" }}>
          „Videos Erstellen“ ist in Arbeit. Du findest den Bereich schon in der Navigation — sobald die Funktion live
          ist, kannst du hier kurze Marken-Videos generieren.
        </p>
        <ul style={{ margin: "16px 0 0", paddingLeft: 18, color: "var(--tx-2)", fontSize: 13.5, lineHeight: 1.6 }}>
          <li>Reels & Stories im Markenlook</li>
          <li>Basierend auf deinem Markenprofil</li>
          <li>Optimiert für Social Media</li>
        </ul>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 22 }}>
          <StudioButton href="/inhalte-erstellen" variant="primary">
            Bilder Erstellen
          </StudioButton>
          <StudioButton href="/dashboard" variant="ghost">
            Zum Dashboard
          </StudioButton>
        </div>
        <p style={{ margin: "18px 0 0", fontSize: 12.5, color: "var(--tx-3)" }}>
          Fragen?{" "}
          <Link href="mailto:support@evglab.com" style={{ color: "var(--tx-2)", textDecoration: "underline" }}>
            support@evglab.com
          </Link>
        </p>
      </div>
    </>
  );
}
