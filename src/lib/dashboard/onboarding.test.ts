import { describe, expect, it } from "vitest";
import {
  ONBOARDING_TOUR_VERSION,
  UI_TOUR_VERSION,
  isUiTourComplete,
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

  it("UI-Tour beeinflusst Marken-Onboarding nicht", () => {
    const state = sanitizeStudioOnboardingState({
      flowVersion: 2,
      completedAt: "2026-03-15T10:00:00.000Z",
      tourVersion: ONBOARDING_TOUR_VERSION,
      uiTourVersion: UI_TOUR_VERSION,
    });
    expect(needsFullOnboardingFlow(state)).toBe(false);
    expect(isUiTourComplete(state)).toBe(true);
  });
});

describe("isUiTourComplete", () => {
  it("ist false ohne uiTourVersion", () => {
    expect(isUiTourComplete(sanitizeStudioOnboardingState({}))).toBe(false);
  });

  it("ist true ab aktueller Version", () => {
    expect(
      isUiTourComplete(sanitizeStudioOnboardingState({ uiTourVersion: UI_TOUR_VERSION })),
    ).toBe(true);
  });
});
