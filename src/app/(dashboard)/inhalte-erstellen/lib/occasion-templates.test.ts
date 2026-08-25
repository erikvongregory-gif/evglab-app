import { describe, expect, it } from "vitest";
import {
  OCCASION_TEMPLATES,
  getSeasonStatus,
  seasonBadgeLabel,
  sortTemplatesForDate,
  type OccasionTemplate,
} from "./occasion-templates";

const oktoberfest = OCCASION_TEMPLATES.find((t) => t.id === "oktoberfest")!;
const feierabend = OCCASION_TEMPLATES.find((t) => t.id === "feierabend")!;

describe("getSeasonStatus", () => {
  it("ist aktiv innerhalb des Saisonfensters", () => {
    expect(getSeasonStatus(oktoberfest, new Date(2026, 8, 20)).state).toBe("active");
  });

  it("ist upcoming kurz vor Saisonstart mit Tagesangabe", () => {
    const status = getSeasonStatus(oktoberfest, new Date(2026, 7, 25));
    expect(status.state).toBe("upcoming");
    expect(status.daysUntilStart).toBe(7);
  });

  it("ist off ausserhalb von Fenster und Vorlauf", () => {
    expect(getSeasonStatus(oktoberfest, new Date(2026, 1, 10)).state).toBe("off");
  });

  it("findet den Saisonstart im Folgejahr (Jahreswechsel)", () => {
    // Ende Dezember, nach der Saison: naechster Start liegt im neuen Jahr → off (> 42 Tage).
    expect(getSeasonStatus(oktoberfest, new Date(2026, 11, 30)).state).toBe("off");
  });

  it("markiert Vorlagen ohne Saison als evergreen", () => {
    expect(getSeasonStatus(feierabend, new Date(2026, 5, 1)).state).toBe("evergreen");
  });
});

describe("sortTemplatesForDate", () => {
  it("sortiert aktive vor bald startenden vor ganzjaehrigen vor off", () => {
    const sorted = sortTemplatesForDate(OCCASION_TEMPLATES, new Date(2026, 8, 20));
    const states = sorted.map((entry) => entry.status.state);
    const rank = { active: 0, upcoming: 1, evergreen: 2, off: 3 } as const;
    for (let i = 1; i < states.length; i += 1) {
      expect(rank[states[i]]).toBeGreaterThanOrEqual(rank[states[i - 1]]);
    }
    expect(states[0]).toBe("active");
  });
});

describe("seasonBadgeLabel", () => {
  it("liefert die passenden Badges", () => {
    expect(seasonBadgeLabel({ state: "active" })).toBe("Jetzt aktuell");
    expect(seasonBadgeLabel({ state: "upcoming", daysUntilStart: 5 })).toBe("Startet diese Woche");
    expect(seasonBadgeLabel({ state: "upcoming", daysUntilStart: 21 })).toBe("In 3 Wochen");
    expect(seasonBadgeLabel({ state: "evergreen" })).toBeNull();
    expect(seasonBadgeLabel({ state: "off" })).toBeNull();
  });
});

describe("Vorlagen-Katalog", () => {
  it("hat eindeutige IDs und Prompt-Notizen innerhalb des Schema-Limits", () => {
    const ids = new Set(OCCASION_TEMPLATES.map((t) => t.id));
    expect(ids.size).toBe(OCCASION_TEMPLATES.length);
    for (const template of OCCASION_TEMPLATES as OccasionTemplate[]) {
      expect(template.preset.promptNote.length).toBeLessThanOrEqual(200);
      expect(template.icon.length).toBeGreaterThan(0);
      expect(template.accent).toMatch(/^#/);
      if (template.preset.personenModus === "E") {
        expect(template.preset.gruppenDynamik).toBeDefined();
      }
    }
  });
});
