import { describe, expect, it } from "vitest";
import { buildUnfilteredLiquidLockFragment, resolveBeerClarity } from "./hyperrealism-blocks";

describe("resolveBeerClarity", () => {
  it("uses Sorten-Filtrierung when set", () => {
    expect(
      resolveBeerClarity({ bierstil: "helles", filtrierung: "unfiltriert", zusatzWunsch: "" }),
    ).toBe("trueb");
    expect(
      resolveBeerClarity({ bierstil: "hefeweizen", filtrierung: "filtriert", zusatzWunsch: "" }),
    ).toBe("klar");
  });

  it("lets freitext override the sorten field", () => {
    expect(
      resolveBeerClarity({
        bierstil: "helles",
        filtrierung: "filtriert",
        zusatzWunsch: "naturtrüb eingeschenkt",
      }),
    ).toBe("trueb");
  });

  it("defaults cloudy styles without explicit filtrierung", () => {
    expect(resolveBeerClarity({ bierstil: "kellerbier" })).toBe("trueb");
    expect(resolveBeerClarity({ bierstil: "helles" })).toBe("klar");
  });
});

describe("buildUnfilteredLiquidLockFragment", () => {
  it("overrides clear liquid from Image 1 when unfiltriert", () => {
    const lock = buildUnfilteredLiquidLockFragment({
      bierstil: "helles",
      filtrierung: "unfiltriert",
      zusatzWunsch: "",
      produktKategorie: "bier",
    } as Parameters<typeof buildUnfilteredLiquidLockFragment>[0]);
    expect(lock).toMatch(/IMAGE-1 LIQUID OVERRIDE/i);
    expect(lock).toMatch(/IGNORE/i);
    expect(lock).toMatch(/naturtrüb/i);
  });
});
