import Link from "next/link";
import { StudioButton, StudioPageHeader } from "@/components/studio/ui";

export function CreateContentLockedView() {
  return (
    <>
      <StudioPageHeader
        eyebrow="Inhalte erstellen"
        title={
          <>
            Abo <em>erforderlich</em>
          </>
        }
        subtitle="Schließe zuerst ein Abonnement ab, um KI-Bilder und Kampagnen zu generieren."
      />
      <div className="studio-card studio-card-pad" style={{ marginTop: 22, maxWidth: 560 }}>
        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, color: "var(--tx-1)" }}>
          „Inhalte erstellen“ ist Teil deines EvGlab-Abos. Wähle einen Tarif — danach kannst du Motive, Posts und
          Kampagnen im Markenstil generieren.
        </p>
        <ul style={{ margin: "16px 0 0", paddingLeft: 18, color: "var(--tx-2)", fontSize: 13.5, lineHeight: 1.6 }}>
          <li>KI-Werbebilder in deinem Markenlook</li>
          <li>Mehrere Varianten pro Generierung</li>
          <li>Monatliches Token-Kontingent je Tarif</li>
        </ul>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 22 }}>
          <StudioButton href="/dashboard?tab=pricing" variant="primary">
            Tarif wählen
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
