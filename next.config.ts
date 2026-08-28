import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (via pdfjs-dist) resolves its worker script relative to its
  // own file location at runtime; bundling it breaks that lookup, so it
  // must run as a plain, un-bundled Node dependency on the server.
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
