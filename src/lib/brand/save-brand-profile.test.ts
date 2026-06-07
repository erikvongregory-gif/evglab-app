import { describe, expect, it } from "vitest";
import { buildActivatedBrandSettings } from "@/lib/brand/save-brand-profile";

describe("save-brand-profile", () => {
  it("merges brand fields into existing dashboard settings", () => {
    const latestMetadata = {
      dashboard: {
        settings: {
          profileName: "Erik",
          breweryName: "",
          profilePhone: "",
          emailNotifications: true,
          weeklySummary: false,
          brandProfileMode: "undecided",
          brandInstagramUrl: "",
          brandWebsiteUrl: "",
          brandProfileSource: "manual",
          brandLockLevel: "strict",
          brandTone: "",
          brandColors: "",
          brandDos: "",
          brandDonts: "",
          brandReferenceImageUrls: [],
        },
      },
    };

    const settings = buildActivatedBrandSettings({
      latestMetadata,
      origin: "http://localhost:3001",
      input: {
        breweryName: "Paulaner",
        brandTone: "Traditionell, Warm",
        brandColors: "#E8772E, #FFFFFF",
        brandDos: "Warmes Licht.",
        brandDonts: "Keine Sportbanner.",
        brandWebsiteUrl: "https://paulaner.de",
        brandProfileSource: "url",
      },
      referenceImageUrls: ["https://paulaner.de/assets/hero.jpg"],
      analyzedAt: "2026-06-06T12:00:00.000Z",
    });

    expect(settings.brandProfileMode).toBe("guided");
    expect(settings.breweryName).toBe("Paulaner");
    expect(settings.profileName).toBe("Erik");
    expect(settings.weeklySummary).toBe(false);
    expect(settings.brandReferenceImageUrls).toEqual(["https://paulaner.de/assets/hero.jpg"]);
    expect(settings.brandAnalyzedAt).toBe("2026-06-06T12:00:00.000Z");
  });
});
