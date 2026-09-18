import { describe, expect, it } from "vitest";
import { extractBrandFontHint } from "@/lib/brand/extract-brand-fonts";

describe("extractBrandFontHint", () => {
  it("picks Google Fonts family from stylesheet link", () => {
    const html = `<!DOCTYPE html><html><head>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap" rel="stylesheet">
      <style>h1 { font-family: "Playfair Display", serif; }</style>
    </head><body><h1>Lang Bräu</h1></body></html>`;

    const hint = extractBrandFontHint([html], "https://brauerei.de/");
    expect(hint?.family).toBe("Playfair Display");
    expect(hint?.googleCssUrls[0]).toContain("fonts.googleapis.com");
  });

  it("reads self-hosted @font-face woff2", () => {
    const html = `<style>
      @font-face {
        font-family: "BrauDisplay";
        src: url("/fonts/brau-display.woff2") format("woff2");
      }
      body { font-family: "BrauDisplay", sans-serif; }
    </style>`;

    const hint = extractBrandFontHint([html], "https://brauerei.de/");
    expect(hint?.family).toBe("BrauDisplay");
    expect(hint?.faceSrcUrls[0]).toBe("https://brauerei.de/fonts/brau-display.woff2");
  });

  it("ignores generic system stacks", () => {
    const html = `<style>body { font-family: Arial, Helvetica, sans-serif; }</style>`;
    expect(extractBrandFontHint([html], "https://brauerei.de/")).toBeNull();
  });
});
