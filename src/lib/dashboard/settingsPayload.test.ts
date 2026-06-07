import { describe, expect, it } from "vitest";
import { clampBrandSettingsFields, mergeDashboardSettings, sanitizeDashboardSettings } from "@/lib/dashboard/settingsPayload";

describe("settingsPayload", () => {
  it("strips client-only fields and applies defaults", () => {
    const out = sanitizeDashboardSettings({
      brandReferenceImagesStale: true,
      brandProfileMode: "guided",
      breweryName: "Lang Bräu",
      brandTone: "Warm",
      brandColors: "#fff",
      brandDos: "Licht",
      brandDonts: "Neon",
    });
    expect(out).not.toHaveProperty("brandReferenceImagesStale");
    expect(out.brandProfileMode).toBe("guided");
    expect(out.emailNotifications).toBe(true);
    expect(out.brandLockLevel).toBe("strict");
  });

  it("clamps long brand fields from AI output", () => {
    const out = clampBrandSettingsFields({
      brandDos: "x".repeat(900),
      brandTone: "y".repeat(400),
    });
    expect(out.brandDos).toHaveLength(600);
    expect(out.brandTone).toHaveLength(300);
  });

  it("merges brand scan patch onto base settings", () => {
    const base = sanitizeDashboardSettings({
      profileName: "Erik",
      brandProfileMode: "undecided",
    });
    const merged = mergeDashboardSettings(base, {
      brandProfileMode: "guided",
      breweryName: "Test Brauerei",
      brandTone: "Craft",
      brandColors: "#111111",
      brandDos: "Do",
      brandDonts: "Dont",
      brandWebsiteUrl: "https://example.com",
    });
    expect(merged.brandProfileMode).toBe("guided");
    expect(merged.profileName).toBe("Erik");
    expect(merged.breweryName).toBe("Test Brauerei");
  });
});
