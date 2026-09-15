import Link from "next/link";

type CreateContentLockedViewProps = {
  feature?: "images" | "videos" | "studio";
};

const IMAGE_BENEFITS = [
  "KI-Werbebilder in deinem Markenlook",
  "Mehrere Varianten pro Generierung",
  "Monatliches Token-Kontingent je Tarif",
] as const;

const VIDEO_BENEFITS = [
  "KI-Videos via Seedance 2",
  "Story-Wizard mit Hook, Setting & Prompt",
  "90 Tokens pro Standard-Video (~8 s, 720p)",
] as const;

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 14 14" className="evg-locked__check" aria-hidden="true">
      <circle cx="7" cy="7" r="7" fill="var(--ac-tint)" />
      <path
        d="M4 7.2l2 2 4-4.4"
        fill="none"
        stroke="var(--ac)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CreateContentLockedView({ feature = "images" }: CreateContentLockedViewProps) {
  const isVideo = feature === "videos";
  const eyebrow = isVideo ? "Videos Erstellen" : "Bilder Erstellen";
  const subtitle = isVideo
    ? "Schließe zuerst ein Abonnement ab, um KI-Videos mit Seedance 2 zu generieren."
    : "Schließe zuerst ein Abonnement ab, um KI-Bilder und Kampagnen zu generieren.";
  const benefits = isVideo ? VIDEO_BENEFITS : IMAGE_BENEFITS;

  return (
    <div className="evg-locked">
      <div className="evg-locked__glow" aria-hidden="true" />

      <div className="evg-locked__icon" aria-hidden="true">
        <div className="evg-locked__icon-ring" />
        <svg width="25" height="25" viewBox="0 0 16 16" fill="none">
          <rect x="3" y="7" width="10" height="7" rx="1.6" fill="var(--ac-tint)" stroke="var(--ac)" strokeWidth="1.4" />
          <path d="M5.6 7V5.4a2.4 2.4 0 0 1 4.8 0V7" stroke="var(--ac)" strokeWidth="1.4" />
        </svg>
      </div>

      <div className="evg-locked__eyebrow">{eyebrow}</div>
      <h1 className="evg-locked__title">
        Abo <em>erforderlich</em>
      </h1>
      <p className="evg-locked__sub">{subtitle}</p>

      <div className="evg-locked__card">
        <div className="evg-locked__card-shine" aria-hidden="true" />
        {isVideo ? (
          <>
            „Videos Erstellen“ ist Teil deines <strong>BrewAI-Abos</strong>. Wähle einen Tarif — danach kannst du
            Story-Videos für Reels, TikTok und Shorts generieren.
          </>
        ) : (
          <>
            „Bilder Erstellen“ ist Teil deines <strong>BrewAI-Abos</strong>. Wähle einen Tarif — danach kannst du
            Motive, Posts und Kampagnen im Markenstil generieren.
          </>
        )}
      </div>

      <ul className="evg-locked__benefits">
        {benefits.map((b) => (
          <li key={b}>
            <CheckIcon />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <div className="evg-locked__actions">
        <Link href="/dashboard?tab=pricing" className="evg-locked__cta">
          Tarif wählen
          <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true">
            <path
              d="M3 7h8M7.5 3.5L11 7l-3.5 3.5"
              fill="none"
              stroke="var(--ac-ink)"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
        <Link href="/dashboard" className="evg-locked__ghost">
          Zum Dashboard
        </Link>
      </div>

      <p className="evg-locked__help">
        Fragen? <a href="mailto:kontakt@brewai.de">kontakt@brewai.de</a>
      </p>
    </div>
  );
}
