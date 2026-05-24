import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.VERCEL ? undefined : "standalone",
  /** Allow dev access via Tailscale IP / MagicDNS hostname — fixes HMR/skeleton stuck */
  allowedDevOrigins: [
    "100.69.42.87",
    "server-01-uptbgr",
    "server-01-uptbgr.tail-scale.ts.net",
  ],
  experimental: {
    // Native browser View Transitions API → smooth route navigation animations.
    // Auto-active untuk semua route push/replace di App Router.
    viewTransition: true,
  },
};

export default nextConfig;
