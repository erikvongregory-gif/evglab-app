import { describe, expect, it } from "vitest";
import { computeProfileStrength } from "@/lib/brand/brand-profile-display";

describe("computeProfileStrength", () => {
  it("rates a full AI-scanned profile as very strong", () => {
    const strength = computeProfileStrength({
      breweryName: "Lang Bräu",
      brandTone: "Bodenständig, Handwerklich, Warm, Regional",
      brandColors: "#E8772E, #6B4423, #F4EFE6, #3D5C45, #2A1F14",
      brandDos: "Warmes natürliches Licht. Produkt im Mittelpunkt mit ruhiger Komposition.",
      brandDonts: "Keine grellen Neonfarben oder Event-Banner.",
      referenceImageCount: 4,
    });
    expect(strength.percent).toBe(100);
    expect(strength.label).toBe("Sehr stark");
  });

  it("rates an empty profile as weak", () => {
    const strength = computeProfileStrength({
      breweryName: "",
      brandTone: "",
      brandColors: "",
      brandDos: "",
      brandDonts: "",
    });
    expect(strength.percent).toBe(0);
    expect(strength.label).toBe("Ausbaufähig");
  });

  it("gives partial credit without reference images and few colors", () => {
    const strength = computeProfileStrength({
      breweryName: "Brauerei Müller",
      brandTone: "Traditionell",
      brandColors: "#112233",
      brandDos: "Warmes Licht.",
      brandDonts: "Keine Neonfarben.",
    });
    // 20 (Name) + 12 (1 Ton) + 8 (1 Farbe) + 9 (1 Do) + 15 (Don't) = 64
    expect(strength.percent).toBe(64);
    expect(strength.label).toBe("Solide");
  });

  it("does not count prose colors as hex swatches", () => {
    const strength = computeProfileStrength({
      breweryName: "X",
      brandTone: "Warm, Regional, Ehrlich",
      brandColors: "Erdige Brauntöne und warmes Orange",
      brandDos: "Licht. Komposition.",
      brandDonts: "Nichts Grelles.",
    });
    // 20 + 20 + 0 + 15 + 15 = 70
    expect(strength.percent).toBe(70);
    expect(strength.label).toBe("Stark");
  });
});
