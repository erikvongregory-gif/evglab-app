import type { Metadata } from "next";
import { StudioPrimitivesDemo } from "@/components/studio/ui/primitives-demo";
import { studioFontClassName } from "@/lib/fonts/studio-fonts";

export const metadata: Metadata = {
  title: "Studio UI Kit (dev)",
  robots: { index: false, follow: false },
};

/** Dev-only Prüfansicht für T2a-Primitives — keine Produktivnavigation. */
export default function StudioUiKitPage() {
  if (process.env.NODE_ENV === "production") {
    return (
      <main style={{ padding: 48, fontFamily: "system-ui" }}>
        <h1>Nicht verfügbar</h1>
        <p>Studio-UI-Kit nur im Development-Modus.</p>
      </main>
    );
  }

  return (
    <div className={studioFontClassName}>
      <StudioPrimitivesDemo />
    </div>
  );
}
