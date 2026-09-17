import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearStudioDraft, defaultStudioDraft, readStudioDraft, writeStudioDraft, writeStudioDraftMeta, writeStudioDraftRefs } from "./studio-draft";

const store = new Map<string, string>();
let failNext: string | null = null;

describe("studio draft persistence", () => {
  beforeEach(() => {
    store.clear();
    failNext = null;
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          if (failNext === key || failNext === "*") {
            failNext = null;
            throw new Error("QuotaExceededError");
          }
          store.set(key, value);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
      },
    });
  });
  afterEach(() => {
    clearStudioDraft();
    vi.unstubAllGlobals();
  });

  it("restores the chosen beer id after reload", () => {
    writeStudioDraft(defaultStudioDraft({ selectedBeerId: "beer-2", userPrompt: "Holztisch" }));
    expect(readStudioDraft()?.selectedBeerId).toBe("beer-2");
    expect(readStudioDraft()?.userPrompt).toBe("Holztisch");
    expect(readStudioDraft()?.produktKategorie).toBe("bier");
  });

  it("keeps a stored drink category", () => {
    writeStudioDraft(defaultStudioDraft({ produktKategorie: "tafelwasser" }));
    expect(readStudioDraft()?.produktKategorie).toBe("tafelwasser");
  });

  it("loads legacy drafts that still store references inline", () => {
    store.set(
      "brewai-create-draft",
      JSON.stringify({
        ...defaultStudioDraft({ userPrompt: "Alt" }),
        extraReferences: [{ name: "Look", dataUrl: "data:image/png;base64,abc", role: "look" }],
        savedAt: Date.now(),
      }),
    );
    expect(readStudioDraft()?.extraReferences).toEqual([
      { name: "Look", dataUrl: "data:image/png;base64,abc", role: "look" },
    ]);
  });

  it("does not rewrite reference bytes when only text changes", () => {
    const refs = [{ name: "Szene", dataUrl: `data:image/png;base64,${"a".repeat(80)}`, role: "scene" as const }];
    writeStudioDraftRefs(refs);
    const before = store.get("brewai-create-draft-refs");
    writeStudioDraftMeta(defaultStudioDraft({ userPrompt: "neu", extraReferences: refs }));
    expect(store.get("brewai-create-draft-refs")).toBe(before);
    expect(store.get("brewai-create-draft")?.includes("data:image/png")).toBe(false);
    expect(readStudioDraft()?.userPrompt).toBe("neu");
    expect(readStudioDraft()?.extraReferences).toEqual(refs);
  });

  it("keeps previous references if a later ref write fails", () => {
    writeStudioDraftMeta(defaultStudioDraft({ userPrompt: "Tisch" }));
    const first = [{ name: "A", dataUrl: "data:image/png;base64,aaa", role: "look" as const }];
    writeStudioDraftRefs(first);
    failNext = "brewai-create-draft-refs";
    expect(
      writeStudioDraftRefs([{ name: "B", dataUrl: "data:image/png;base64,bbb", role: "scene" }]),
    ).toBe(false);
    expect(readStudioDraft()?.extraReferences).toEqual(first);
    expect(readStudioDraft()?.userPrompt).toBe("Tisch");
  });
});
