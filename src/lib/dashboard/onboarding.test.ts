import { describe, expect, it } from "vitest";
import {
  ONBOARDING_TOUR_VERSION,
  needsFullOnboardingFlow,
  sanitizeStudioOnboardingState,
} from "./onboarding";

describe("needsFullOnboardingFlow", () => {
  it("verlangt Tour für Legacy-Abschluss ohne tourVersion", () => {
    const state = sanitizeStudioOnboardingState({
      welcome: true,
      checklistDismissed: true,
      celebrated: true,
      flowVersion: 2,
      completedAt: "2026-03-01T10:00:00.000Z",
    });
    expect(needsFullOnboardingFlow(state)).toBe(true);
  });

  it("überspringt Tour nach Product-Tour-Abschluss", () => {
    const state = sanitizeStudioOnboardingState({
      flowVersion: 2,
      completedAt: "2026-03-15T10:00:00.000Z",
      tourVersion: ONBOARDING_TOUR_VERSION,
    });
    expect(needsFullOnboardingFlow(state)).toBe(false);
  });

  it("verlangt Tour für neue Nutzer", () => {
    expect(needsFullOnboardingFlow(sanitizeStudioOnboardingState({}))).toBe(true);
  });
});
