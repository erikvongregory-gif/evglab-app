import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Supabase Auth benötigt Route Handler & Middleware — kein static export. */
  images: {
    remotePatterns: [
      // Generierte Bilder liegen im oeffentlichen Supabase-Storage-Bucket.
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
  },
};

export default nextConfig;
