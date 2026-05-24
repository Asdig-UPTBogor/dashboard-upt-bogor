import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.VERCEL ? undefined : "standalone",
  env: {
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA || "",
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_MESSAGE: process.env.VERCEL_GIT_COMMIT_MESSAGE || "",
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV || "",
  },
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
