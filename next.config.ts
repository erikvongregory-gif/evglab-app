import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Supabase Auth benötigt Route Handler & Middleware — kein static export. */
  images: {
    // Private signed URLs must not outlive their expiry in the public image optimizer cache.
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/sign/**" },
    ],
  },
};

export default nextConfig;
