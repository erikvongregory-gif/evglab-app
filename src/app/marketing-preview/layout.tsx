import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { PreferencesStoreProvider } from "@/stores/preferences/preferences-provider";
import { PREFERENCE_DEFAULTS } from "@/lib/preferences/preferences-config";

export default function MarketingPreviewLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_MARKETING_PREVIEW !== "1") {
    notFound();
  }

  return (
    <PreferencesStoreProvider
      initialValues={{
        ...PREFERENCE_DEFAULTS,
        theme_mode: "light",
        theme_preset: "tangerine",
        sidebar_variant: "sidebar",
        sidebar_collapsible: "icon",
      }}
    >
      <style>{`
        html {
          --chart-1: #c7691e !important;
          --chart-2: #d4782a !important;
          --color-chart-1: #c7691e !important;
        }
        .marketing-preview-shell [data-slot="chart"] {
          --color-tokens: #c7691e !important;
        }
        .marketing-preview-shell .recharts-area-curve {
          stroke: #c7691e !important;
          stroke-width: 2px !important;
        }
      `}</style>
      <div className="marketing-preview-shell min-h-dvh bg-background text-foreground antialiased">
        {children}
      </div>
    </PreferencesStoreProvider>
  );
}
