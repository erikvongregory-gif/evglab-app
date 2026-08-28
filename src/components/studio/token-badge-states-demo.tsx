"use client";

import { StudioTokenBadge } from "@/components/studio/studio-token-badge";

/** Nachreichung Schritt 2 — vier Token-Badge-Zustände (gemockt). */
export function TokenBadgeStatesDemo() {
  const periodEnd = "2026-09-09T12:00:00.000Z";
  const charges = [
    {
      id: "1",
      imageUrl:
        "data:image/svg+xml," +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><rect fill="#3a3328" width="28" height="28"/><text x="14" y="18" text-anchor="middle" fill="#a79e8c" font-size="10">1</text></svg>',
        ),
      title: "Biergarten-Sommer",
      createdAt: new Date().toISOString(),
      tokens: 20,
    },
  ];

  return (
    <div className="evg-studio" style={{ padding: 32, background: "var(--page)", minHeight: "100%" }}>
      <h1 className="evg-h1" style={{ marginBottom: 24 }}>
        Token-Badge · Zustände
      </h1>
      <div style={{ display: "grid", gap: 28, maxWidth: 420 }}>
        <div>
          <div className="evg-rubrik" style={{ marginBottom: 8 }}>
            Owner
          </div>
          <StudioTokenBadge unlimited plan="pro" />
        </div>
        <div>
          <div className="evg-rubrik" style={{ marginBottom: 8 }}>
            Normal (840 / 1.200)
          </div>
          <StudioTokenBadge remaining={840} monthly={1200} plan="start" periodEnd={periodEnd} recentCharges={charges} />
        </div>
        <div>
          <div className="evg-rubrik" style={{ marginBottom: 8 }}>
            ≤ 20 % (180 / 1.200)
          </div>
          <StudioTokenBadge remaining={180} monthly={1200} plan="start" periodEnd={periodEnd} recentCharges={charges} />
        </div>
        <div>
          <div className="evg-rubrik" style={{ marginBottom: 8 }}>
            0 / 1.200
          </div>
          <StudioTokenBadge remaining={0} monthly={1200} plan="start" periodEnd={periodEnd} recentCharges={charges} />
        </div>
      </div>
    </div>
  );
}
