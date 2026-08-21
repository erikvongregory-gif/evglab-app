import Link from "next/link";

import { StudioButton, StudioPageHeader } from "@/components/studio/ui";



type CreateContentLockedViewProps = {

  feature?: "images" | "videos" | "studio";

};



export function CreateContentLockedView({ feature = "images" }: CreateContentLockedViewProps) {

  const isVideo = feature === "videos";

  const eyebrow = isVideo ? "Videos Erstellen" : "Bilder Erstellen";

  const subtitle = isVideo

    ? "Schließe zuerst ein Abonnement ab, um KI-Videos mit Seedance 2 zu generieren."

    : "Schließe zuerst ein Abonnement ab, um KI-Bilder und Kampagnen zu generieren.";



  return (

    <>

      <StudioPageHeader

        eyebrow={eyebrow}

        title={

          <>

            Abo <em>erforderlich</em>

          </>

        }

        subtitle={subtitle}

      />

      <div className="studio-card studio-card-pad" style={{ marginTop: 22, maxWidth: 560 }}>

        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, color: "var(--tx-1)" }}>

          {isVideo

            ? "„Videos Erstellen“ ist Teil deines BrewAI-Abos. Wähle einen Tarif — danach kannst du Story-Videos für Reels, TikTok und Shorts generieren."

            : "„Bilder Erstellen“ ist Teil deines BrewAI-Abos. Wähle einen Tarif — danach kannst du Motive, Posts und Kampagnen im Markenstil generieren."}

        </p>

        <ul style={{ margin: "16px 0 0", paddingLeft: 18, color: "var(--tx-2)", fontSize: 13.5, lineHeight: 1.6 }}>

          {isVideo ? (

            <>

              <li>KI-Videos via Seedance 2</li>

              <li>Story-Wizard mit Hook, Setting & Prompt</li>

              <li>90 Tokens pro Standard-Video (~8 s, 720p)</li>

            </>

          ) : (

            <>

              <li>KI-Werbebilder in deinem Markenlook</li>

              <li>Mehrere Varianten pro Generierung</li>

              <li>Monatliches Token-Kontingent je Tarif</li>

            </>

          )}

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

          <Link href="mailto:kontakt@brewai.de" style={{ color: "var(--tx-2)", textDecoration: "underline" }}>

            kontakt@brewai.de

          </Link>

        </p>

      </div>

    </>

  );

}

