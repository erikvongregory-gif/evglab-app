import { describe, expect, it } from "vitest";
import { buildPrunedAuthUserData } from "@/lib/auth/pruneAuthMetadata";

const onboarding = {
  v: 1 as const,
  welcome: true,
  checklistDismissed: true,
  celebrated: true,
  hints: ["dash-nav", "dash-create"],
};

function oversizedMetadata() {
  return {
    full_name: "Test",
    dashboard: {
      settings: { profileName: "Test", brandProfileMode: "guided" },
      teamMembers: [],
      onboarding,
      // Sprengt die 12-KB-Schwelle und löst damit das Verkleinern aus.
      mediaLibrary: Array.from({ length: 40 }, (_, i) => ({
        id: `m${i}`,
        imageUrl: `https://example.com/${"x".repeat(400)}`,
        prompt: "y".repeat(200),
        createdAt: "2026-01-01T00:00:00.000Z",
        aspectRatio: "1:1",
        resolution: "1K",
        outputFormat: "png",
      })),
    },
  };
}

describe("buildPrunedAuthUserData", () => {
  it("behält den Onboarding-Fortschritt beim Verkleinern", () => {
    const pruned = buildPrunedAuthUserData(oversizedMetadata());
    const dashboard = (pruned?.dashboard ?? {}) as Record<string, unknown>;
    expect(dashboard.onboarding).toEqual(onboarding);
  });

  it("kürzt die Mediathek und behält Felder außerhalb von dashboard", () => {
    const pruned = buildPrunedAuthUserData(oversizedMetadata());
    const dashboard = (pruned?.dashboard ?? {}) as Record<string, unknown>;
    expect((dashboard.mediaLibrary as unknown[]).length).toBe(12);
    expect(pruned?.full_name).toBe("Test");
  });

  it("lässt schlanke Metadata unangetastet", () => {
    expect(buildPrunedAuthUserData({ dashboard: { settings: {}, onboarding } })).toBeNull();
  });
});
