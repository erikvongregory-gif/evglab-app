"use client";

import { useEffect, useRef } from "react";

export function OnboardingBreweryStep({
  breweryName,
  websiteUrl,
  error,
  onChangeName,
  onChangeWebsite,
}: {
  breweryName: string;
  websiteUrl: string;
  error: string;
  onChangeName: (v: string) => void;
  onChangeWebsite: (v: string) => void;
}) {
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (error) nameRef.current?.focus();
  }, [error]);

  return (
    <div className="evg-onb-stack">
      <label className="evg-onb-field" data-invalid={Boolean(error)}>
        <span className="evg-onb-label">BRAUEREINAME</span>
        <input
          ref={nameRef}
          className="evg-onb-input"
          value={breweryName}
          onChange={(e) => onChangeName(e.target.value)}
          placeholder="z. B. Hopfen & Malz"
          autoComplete="organization"
          maxLength={120}
        />
        {error ? <p className="evg-onb-error">{error}</p> : null}
      </label>

      <label className="evg-onb-field">
        <span className="evg-onb-label">WEBSITE</span>
        <input
          className="evg-onb-input"
          value={websiteUrl}
          onChange={(e) => onChangeWebsite(e.target.value)}
          placeholder="beispielbrauerei.de"
          inputMode="url"
          autoComplete="url"
          maxLength={200}
        />
      </label>

      <div className="evg-onb-info">
        <svg width="15" height="15" viewBox="0 0 16 16" style={{ flex: "none", marginTop: 1 }} aria-hidden>
          <circle cx="8" cy="8" r="6.6" fill="none" stroke="var(--info, #6E93B8)" strokeWidth="1.4" />
          <path d="M8 7.2V11.2" stroke="var(--info, #6E93B8)" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="8" cy="5" r=".9" fill="var(--info, #6E93B8)" />
        </svg>
        <div>
          Mit der Website lesen wir im nächsten Schritt Markensignale ein. Du bestätigst jeden
          Vorschlag selbst — nichts wird still übernommen.
        </div>
      </div>
    </div>
  );
}
