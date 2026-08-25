import { describe, expect, it } from "vitest";
import { MAX_MY_BEERS, hasUsableBeerEtikett, sanitizeDashboardBeers } from "./metadata";

describe("sanitizeDashboardBeers", () => {
  it("liefert leere Liste fuer ungueltige Eingaben", () => {
    expect(sanitizeDashboardBeers(undefined)).toEqual([]);
    expect(sanitizeDashboardBeers("nope")).toEqual([]);
    expect(sanitizeDashboardBeers([{ name: "ohne id" }, { id: "ohne-name" }])).toEqual([]);
  });

  it("uebernimmt gueltige Biere und setzt Defaults", () => {
    const [beer] = sanitizeDashboardBeers([
      { id: "b1", name: "  Falter Hell  ", flaschenfarbe: "lila" },
    ]);
    expect(beer).toEqual({
      id: "b1",
      name: "Falter Hell",
      bierstil: "helles",
      flaschenTyp: "nrw_500",
      flaschenfarbe: "braun",
      etikettUrl: "",
      createdAt: "",
    });
  });

  it("behaelt gueltige Werte bei", () => {
    const [beer] = sanitizeDashboardBeers([
      {
        id: "b2",
        name: "Wiesn Märzen",
        bierstil: "maerzen",
        flaschenTyp: "buegel_500",
        flaschenfarbe: "gruen",
        etikettUrl: "https://cdn.example.com/etikett.jpg",
        createdAt: "2026-08-25T10:00:00.000Z",
      },
    ]);
    expect(beer.bierstil).toBe("maerzen");
    expect(beer.flaschenTyp).toBe("buegel_500");
    expect(beer.flaschenfarbe).toBe("gruen");
    expect(beer.etikettUrl).toBe("https://cdn.example.com/etikett.jpg");
  });

  it("deckelt auf MAX_MY_BEERS Eintraege", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ id: `b${i}`, name: `Bier ${i}` }));
    expect(sanitizeDashboardBeers(many)).toHaveLength(MAX_MY_BEERS);
  });
});

describe("hasUsableBeerEtikett", () => {
  it("erkennt nur dauerhaft ladbare HTTPS-URLs als nutzbar", () => {
    expect(hasUsableBeerEtikett("https://cdn.example.com/etikett.jpg")).toBe(true);
    expect(hasUsableBeerEtikett("https://tempfile.redpandaai.co/abc.jpg")).toBe(false);
    expect(hasUsableBeerEtikett("https://foo.tempfile.ai/x.png")).toBe(false);
    expect(hasUsableBeerEtikett("")).toBe(false);
    expect(hasUsableBeerEtikett("data:image/jpeg;base64,aaa")).toBe(false);
  });
});
