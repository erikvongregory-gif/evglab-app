import type { MetadataRoute } from "next";
import { SITE } from "@/lib/siteConfig";

export const dynamic = "force-static";

/** Minimale Sitemap — App-Root leitet auf /anmelden; Login-URL bleibt per robots/meta aus dem Index. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE.baseUrl.replace(/\/$/, "");
  return [{ url: base, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 1 }];
}
