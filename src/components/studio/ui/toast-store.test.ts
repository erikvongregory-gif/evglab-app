import { afterEach, describe, expect, it } from "vitest";
import {
  clearStudioToasts,
  dismissStudioToast,
  getStudioToasts,
  showStudioToast,
  subscribeStudioToasts,
} from "./toast-store";

afterEach(() => {
  clearStudioToasts();
});

describe("studio toast store", () => {
  it("adds and dismisses toasts", () => {
    const id = showStudioToast({ title: "Gespeichert", tone: "success" });
    expect(getStudioToasts()).toHaveLength(1);
    expect(getStudioToasts()[0]?.title).toBe("Gespeichert");
    dismissStudioToast(id);
    expect(getStudioToasts()).toHaveLength(0);
  });

  it("defaults tone and duration", () => {
    showStudioToast({ title: "Hinweis" });
    const t = getStudioToasts()[0];
    expect(t?.tone).toBe("info");
    expect(t?.durationMs).toBe(4200);
  });

  it("notifies subscribers", () => {
    const seen: number[] = [];
    const unsub = subscribeStudioToasts((items) => seen.push(items.length));
    showStudioToast({ title: "A" });
    showStudioToast({ title: "B" });
    unsub();
    expect(seen.at(-1)).toBe(2);
  });

  it("caps queue at 4", () => {
    for (let i = 0; i < 6; i++) showStudioToast({ title: `T${i}` });
    expect(getStudioToasts()).toHaveLength(4);
    expect(getStudioToasts()[0]?.title).toBe("T2");
  });
});
