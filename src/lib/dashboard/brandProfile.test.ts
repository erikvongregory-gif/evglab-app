import { describe, expect, it } from "vitest";
import {
  buildBrandProfilePromptContext,
  buildGenericBrandProfilePatch,
  type BrandProfile,
} from "@/lib/dashboard/brandProfile";
import { mergeDashboardSettings, sanitizeDashboardSettings } from "@/lib/dashboard/settingsPayload";

function makeProfile(overrides: Partial<BrandProfile> = {}): BrandProfile {
  return {
    brandProfileMode: "guided",
    brandInstagramUrl: "https://instagram.com/brauerei",
    brandWebsiteUrl: "https://brauerei-falter.de",
    brandProfileSource: "url",
    brandLockLevel: "strict",
    breweryName: "Brauerei Falter",
    brandTone: "Traditionell, bodenständig",
    brandColors: "#1A3C2E, #E8B84B",
    brandDos: "Warmes Licht, Biergarten-Szenen",
    brandDonts: "Keine sterilen Studio-Hintergründe",
    brandReferenceImageUrls: ["https://cdn.example.com/szene.jpg"],
    brandLabelReferenceUrl: "https://cdn.example.com/flasche.png",
    ...overrides,
  };
}

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
    expect(merged.brandLabelReferenceUrl).toBe("");
    expect(merged).not.toHaveProperty("brandAnalyzedAt");
  });
});

describe("buildBrandProfilePromptContext", () => {
  it("returns empty string for skip and undecided modes", () => {
    expect(buildBrandProfilePromptContext(makeProfile({ brandProfileMode: "skip" }))).toBe("");
    expect(buildBrandProfilePromptContext(makeProfile({ brandProfileMode: "undecided" }))).toBe("");
  });

  it("returns empty string for guided profile without any content", () => {
    const empty = makeProfile({
      breweryName: "",
      brandTone: "",
      brandColors: "",
      brandDos: "",
      brandDonts: "",
    });
    expect(buildBrandProfilePromptContext(empty)).toBe("");
  });

  it("includes only filled fields and never raw URLs", () => {
    const context = buildBrandProfilePromptContext(
      makeProfile({ brandTone: "", brandDonts: "" }),
    );
    expect(context).toContain("Brand/Brewery: Brauerei Falter");
    expect(context).toContain("Brand color palette: #1A3C2E, #E8B84B");
    expect(context).not.toContain("Brand tone");
    expect(context).not.toContain("never:");
    expect(context).not.toContain("http");
    expect(context).not.toContain("Reference image");
  });

  it("strict lock resolves conflicts in favor of the brand profile", () => {
    const context = buildBrandProfilePromptContext(makeProfile({ brandLockLevel: "strict" }));
    expect(context).toContain("STRICT lock");
    expect(context).toContain("the brand profile wins");
  });

  it("balanced lock keeps tone and colors but allows the brief to lead", () => {
    const context = buildBrandProfilePromptContext(makeProfile({ brandLockLevel: "balanced" }));
    expect(context).toContain("BALANCED lock");
    expect(context).toContain("keep brand tone and colors intact");
    expect(context).not.toContain("mandatory");
  });

  it("loose lock keeps only the never-rules binding", () => {
    const context = buildBrandProfilePromptContext(makeProfile({ brandLockLevel: "loose" }));
    expect(context).toContain("LOOSE lock");
    expect(context).toContain('Only the "never" rules above are binding');
  });
});
