import { describe, expect, it } from "vitest";
import { buildGenericBrandProfilePatch } from "@/lib/dashboard/brandProfile";
import { mergeDashboardSettings, sanitizeDashboardSettings } from "@/lib/dashboard/settingsPayload";

describe("buildGenericBrandProfilePatch", () => {
  it("clears brand fields and switches to skip mode", () => {
    const base = sanitizeDashboardSettings({
      profileName: "Erik",
      breweryName: "Paulaner",
      brandProfileMode: "guided",
      brandWebsiteUrl: "https://paulaner.de",
      brandTone: "Traditionell",
      brandColors: "#E8772E",
      brandDos: "Warmes Licht",
      brandDonts: "Keine Sportbanner",
      brandReferenceImageUrls: ["https://example.com/ref.jpg"],
      brandAnalyzedAt: "2026-06-06T12:00:00.000Z",
    });

    const merged = mergeDashboardSettings(base, buildGenericBrandProfilePatch());

    expect(merged.brandProfileMode).toBe("skip");
    expect(merged.brandProfileSource).toBe("skip");
    expect(merged.brandWebsiteUrl).toBe("");
    expect(merged.brandTone).toBe("");
    expect(merged.brandReferenceImageUrls).toEqual([]);
    expect(merged.profileName).toBe("Erik");
    expect(merged.breweryName).toBe("Paulaner");
    expect(merged).not.toHaveProperty("brandAnalyzedAt");
  });
});
