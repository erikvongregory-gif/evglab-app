import type { NextConfig } from "next";

function contentSecurityPolicy(): string {
  const dev = process.env.NODE_ENV !== "production";
  // ponytail: static CSP. 'unsafe-inline' stays until ThemeBootScript and Next hydration get a nonce.
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://auth.brewai.de${dev ? " ws: http://localhost:3001 http://127.0.0.1:3001" : ""}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

const nextConfig: NextConfig = {
  /* Supabase Auth benötigt Route Handler & Middleware — kein static export. */
  outputFileTracingIncludes: {
    // Alle Referenzbilder, die die Generierung per process.cwd()/assets liest — fehlt ein Ordner hier,
    // läuft die Live-App still ohne diese Referenzen (Look, Glas, Flasche, Trübung).
    "/api/inhalte-erstellen/*": [
      "./assets/campaign-references/**/*",
      "./assets/premium-references/**/*",
      "./assets/reportage-references/**/*",
      "./assets/glass-references/**/*",
      "./assets/bottle-references/**/*",
      "./assets/liquid-references/**/*",
    ],
  },
  images: {
    // Private signed URLs must not outlive their expiry in the public image optimizer cache.
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/sign/**" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy() },
        ],
      },
    ];
  },
};

export default nextConfig;
