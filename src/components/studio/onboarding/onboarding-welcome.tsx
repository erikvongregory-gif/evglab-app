"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { StudioButton } from "@/components/studio/ui";
import { studioFontClassName } from "@/lib/fonts/studio-fonts";
import { StudioOnboardingDemo } from "@/components/studio/onboarding/onboarding-demo";
import { useStudioOnboarding } from "@/components/studio/onboarding/onboarding-context";

export function StudioOnboardingWelcome() {
  const onboarding = useStudioOnboarding();
  const router = useRouter();
  const open = Boolean(onboarding?.welcomeOpen);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !onboarding) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onboarding.closeWelcome();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onboarding]);

  if (!open || !onboarding) return null;

  const nextTask = onboarding.tasks.find((task) => !task.optional && !task.done);

  const start = () => {
    onboarding.closeWelcome();
    if (nextTask) router.push(nextTask.href);
  };

  return createPortal(
    <div
      className={`evg-studio ${studioFontClassName} studio-onb-welcome-root`}
      role="presentation"
    >
      <button
        type="button"
        className="evg-scrim studio-onb-welcome-scrim"
        aria-label="Willkommen schließen"
        onClick={onboarding.closeWelcome}
      />
      <div
        className="evg-dialog studio-onb-welcome-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-onb-welcome-title"
      >
        <div className="evg-rubrik">Willkommen</div>
        <h2 id="studio-onb-welcome-title" className="evg-h1 studio-onb-welcome-title">
          Marketing-Motive für deine Brauerei — in Minuten statt Wochen
        </h2>
        <p className="studio-onb-welcome-lead">
          Du beantwortest ein paar kurze Fragen, BrewAI baut daraus den Prompt und generiert
          Motive im Stil deiner Marke. Die Checkliste unten rechts führt dich durch die ersten
          Schritte — du kannst jederzeit selbst losziehen.
        </p>

        <StudioOnboardingDemo />

        <div className="studio-onb-welcome-actions">
          <button type="button" className="evg-btn" onClick={onboarding.closeWelcome}>
            Später
          </button>
          <StudioButton variant="primary" size="lg" onClick={start}>
            {nextTask ? nextTask.label : "Los geht’s"}
          </StudioButton>
        </div>
      </div>
    </div>,
    document.body,
  );
}
