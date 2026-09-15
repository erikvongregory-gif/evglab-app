import { describe, expect, it } from "vitest";
import { looksLikeBlockedGatePage } from "@/lib/brand/consent-gate-dismiss";

describe("looksLikeBlockedGatePage", () => {
  it("flags age gate shell without brand content", () => {
    const html = `<html><body><h1>Altersprüfung</h1><p>Bist du bereits über 16 Jahre alt?</p><button>Ja</button></body></html>`;
    expect(looksLikeBlockedGatePage(html, "Altersprüfung. Bist du bereits über 16 Jahre alt?")).toBe(true);
  });

  it("passes real brewery homepage content", () => {
    const html = "<html><body><h1>Willkommen</h1></body></html>";
    const excerpt =
      "Willkommen bei Lang Bräu. Traditionelle Brauerei im Bayerischen Wald. Unsere Biere — handwerklich gebraut mit Leidenschaft seit 1892.";
    expect(looksLikeBlockedGatePage(html, excerpt)).toBe(false);
  });

  it("passes when brand text dominates despite cookie mention in footer", () => {
    const excerpt =
      "Über uns — Familienbrauerei seit 1920. Unser Sortiment umfasst Helles, Weizen und saisonale Spezialitäten. Cookie-Einstellungen im Footer.";
    expect(looksLikeBlockedGatePage("<html></html>", excerpt)).toBe(false);
  });
});
