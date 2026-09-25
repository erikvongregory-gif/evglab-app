import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Supabase Auth benötigt Route Handler & Middleware — kein static export. */
  outputFileTracingIncludes: {
    "/api/inhalte-erstellen/*": ["./assets/campaign-references/**/*"],
  },
  images: {
    // Private signed URLs must not outlive their expiry in the public image optimizer cache.
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/sign/**" },
    ],
  },
};

export default nextConfig;
