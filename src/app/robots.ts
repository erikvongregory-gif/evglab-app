import type { MetadataRoute } from "next";
import { SITE } from "@/lib/siteConfig";

export const dynamic = "force-static";

const disallow = ["/api/", "/_next/", "/dashboard", "/admin", "/invite/", "/registrieren", "/auth/"];

const defaultRule = {
  allow: "/" as const,
  disallow,
};

const aiUserAgents = [
  "GPTBot",
  "ChatGPT-User",
  "Google-Extended",
  "PerplexityBot",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
] as const;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", ...defaultRule }, ...aiUserAgents.map((userAgent) => ({ userAgent, ...defaultRule }))],
    sitemap: `${SITE.baseUrl}/sitemap.xml`,
    host: SITE.baseUrl,
  };
}
