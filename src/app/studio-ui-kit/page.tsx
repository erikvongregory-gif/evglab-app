import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StudioPrimitivesDemo } from "@/components/studio/ui/primitives-demo";
import { studioFontClassName } from "@/lib/fonts/studio-fonts";

export const metadata: Metadata = {
  title: "Studio UI Kit (dev)",
  robots: { index: false, follow: false },
};

/** Dev-only Prüfansicht — Production liefert HTTP 404 via notFound(). */
export default function StudioUiKitPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <div className={studioFontClassName}>
      <StudioPrimitivesDemo />
    </div>
  );
}
