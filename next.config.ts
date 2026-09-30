import withBundleAnalyzer from "@next/bundle-analyzer";
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
//
// F-24 — the credentials below are what actually enable the upload. The plugin
// skips it (with a warning) when org, project or authToken is missing, so the
// previous call passed none and never uploaded anything. All three are undefined
// in local dev and CI, which keeps the build free of outbound calls; set them in
// the Vercel production env to get symbolicated server traces.
// The analyzer wraps the Sentry config rather than the other way round: Sentry
// stays inner so it keeps owning the webpack hook it injects, and the analyzer
// sees the fully composed config. `ANALYZE=true bun run build` writes reports to
// .next/analyze; a normal build is unaffected. openAnalyzer stays off so CI
// never tries to launch a browser.
export default withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
  openAnalyzer: false,
})(
  withSentryConfig(nextConfig, {
    silent: true,
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
  }),
);
