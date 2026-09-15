import { describe, expect, it } from "vitest";
import { buildSocialTextOverlaySvg, parsePrimaryBrandColor } from "@/lib/social/text-overlay";

describe("text-overlay", () => {
  it("parses primary brand hex", () => {
    expect(parsePrimaryBrandColor("#E8772E, #6B4423")).toBe("#E8772E");
    expect(parsePrimaryBrandColor("warm orange")).toBe("#FFFFFF");
  });

  it("embeds headline and escapes xml", () => {
    const svg = buildSocialTextOverlaySvg({
      width: 1024,
      height: 1280,
      headline: "Frisch & gut <test>",
      subline: "Ab sofort im Ausschank",
      ctaText: "Jetzt probieren",
      fontName: "Augustina",
      fontWeight: "700",
    });
    expect(svg).toContain("Frisch &amp; gut");
    expect(svg).toContain("&lt;test&gt;");
    expect(svg).toContain("Jetzt probieren");
    expect(svg).toContain("Augustina");
  });
});
