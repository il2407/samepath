import type { NextConfig } from "next";

// Baseline hardening for every response. No full script CSP yet — Next.js
// inline bootstrap scripts need a nonce-based policy, which is a separate
// change; frame-ancestors/object-src/base-uri are safe to lock down now.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // pdf-parse (via pdfjs-dist) resolves its worker script relative to its
  // own file location at runtime; bundling it breaks that lookup, so it
  // must run as a plain, un-bundled Node dependency on the server.
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
