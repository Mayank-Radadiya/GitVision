import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true, // Helps catch issues early (dev only)
  experimental: {
    staleTimes: {
      static: 30 * 1000,
      dynamic: 10 * 1000,
    },
    serverActions: {
      bodySizeLimit: 1024 * 1024, // 1MB limit (example)
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
      {
        protocol: "https",
        hostname: "ui-avatars.com",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "camo.githubusercontent.com",
      },
    ],
  },
  compiler: {
    // Keep `log` alongside error/warn. `logger.info` writes through
    // console.log, so excluding only error+warn stripped every INFO line in
    // production — including the Inngest pipeline progress and embedding
    // diagnostics, which is exactly what you need when a job is stuck.
    // console.debug/dir/table/trace are still removed.
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error", "warn", "log"] }
        : false,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

// T-020 — source-map upload so Sentry can symbolicate server stack traces.
// `silent: true` keeps Sentry from writing to the console during the build.
export default withSentryConfig(nextConfig, {
  silent: true,
});
