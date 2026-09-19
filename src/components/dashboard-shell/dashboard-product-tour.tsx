"use client";

import * as React from "react";
import { Tour, useTour, type TourStep } from "@/components/ui/product-tour";
import { UI_TOUR_VERSION } from "@/lib/dashboard/onboarding";
import { patchOnboarding } from "@/components/studio/onboarding/onboarding-tour-types";

const STORAGE_KEY = "brewai-ui-tour-v1";

const STEPS: TourStep[] = [
  {
    title: "Willkommen im Studio",
    content:
      "Kurzer Rundgang durch dein Dashboard. Jederzeit mit Esc beenden — er erscheint danach nicht wieder.",
    placement: "center",
  },
  {
    target: "#tour-create",
    title: "Neu erstellen",
    content: "Starte hier Bilder und Inhalte für deine Brauerei.",
    placement: "right",
  },
  {
    target: "#tour-nav-assistant",
    title: "BrewAI",
    content: "Dein Assistent für Texte, Ideen und Markenfragen.",
    placement: "right",
  },
  {
    target: "#tour-nav-create",
    title: "Bilder erstellen",
    content: "Hier generierst du Motive passend zu deinem Markenprofil.",
    placement: "right",
  },
  {
    target: "#tour-nav-media",
    title: "Mediathek",
    content: "Alle fertigen Assets findest du gebündelt in der Mediathek.",
    placement: "right",
  },
  {
    target: "#tour-search",
    title: "Schnellsuche",
    content: "Springe direkt zu Bereichen und Seiten im Studio.",
    placement: "bottom",
  },
  {
    target: "#tour-avatar",
    title: "Fertig",
    content: "Konto, Abonnement und Einstellungen erreichst du über dein Profil.",
    placement: "bottom",
  },
];

export function DashboardProductTour({ initialSeen }: { initialSeen: boolean }) {
  const tour = useTour(STORAGE_KEY);

  React.useEffect(() => {
    if (initialSeen) {
      tour.markSeen();
      return;
    }
    if (tour.seen()) {
      // lokal schon gesehen → Server nachziehen, falls Flag fehlt
      void patchOnboarding({ uiTourVersion: UI_TOUR_VERSION }).catch(() => {});
      return;
    }
    const t = window.setTimeout(() => tour.start(), 650);
    return () => window.clearTimeout(t);
    // einmalig nach Mount
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start only once
  }, []);

  const persistSeen = React.useCallback(() => {
    tour.markSeen();
    void patchOnboarding({ uiTourVersion: UI_TOUR_VERSION }).catch(() => {});
  }, [tour]);

  return (
    <Tour
      steps={STEPS}
      open={tour.open}
      onOpenChange={tour.setOpen}
      index={tour.index}
      onIndexChange={tour.setIndex}
      onFinish={persistSeen}
      onSkip={persistSeen}
    />
  );
}
