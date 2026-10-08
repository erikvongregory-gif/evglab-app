import { describe, expect, it, vi } from "vitest";
import { hyperrealisticSchema } from "@/app/(dashboard)/inhalte-erstellen/lib/schemas";
import { buildCastingDirection } from "./casting-direction";

const randomIndex = vi.hoisted(() => vi.fn<(max: number) => number>());
vi.mock("node:crypto", () => ({ randomInt: randomIndex }));

const args = {
  input: hyperrealisticSchema.parse({ etikettBild: "https://example.com/product.png", photoStyle: "reportage", flaschenTyp: "nrw_500", flaschenfarbe: "braun", bierstil: "helles", szene: "biergarten_sommer", personenModus: "E", zusatzWunsch: "Zwei Frauen stoßen an" }),
  references: [{ index: 1, role: "look" as const }],
};

describe("anonymous casting", () => {
  it("varies facial direction between requests while keeping the requested people", () => {
    randomIndex.mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValueOnce(3).mockReturnValueOnce(0);
    const first = buildCastingDirection(args);
    const next = buildCastingDirection(args);
    expect(first).not.toBe(next);
    expect(first).toContain("broad oval face");
    expect(first).toContain("angular face");
    expect(first).toContain("Keep requested gender, age, clothing and appearance");
    expect(first).toContain("do not add people");
  });

  it("preserves selected character identities", () => {
    expect(buildCastingDirection({ ...args, references: [{ index: 1, role: "character" }] })).toBe("");
    expect(buildCastingDirection({ ...args, character: { appearanceLock: "Original brewery character" } })).toBe("");
  });

  it("does not cast people for product-only images", () => {
    expect(buildCastingDirection({ ...args, input: { ...args.input, personenModus: "A", zusatzWunsch: "" } })).toBe("");
  });
});
