import type { NextConfig } from "next";

/**
 * Where browsers POST the violations the report-only policy produces. Named
 * here so the policy, `Reporting-Endpoints` and `Report-To` cannot drift apart.
 */
const CSP_REPORT_ENDPOINT = "/api/csp-report";

/**
 * M19, decision D-5 — report-only Content-Security-Policy.
 *
 * Two things about this policy are deliberately permissive, and both are the
 * point of the report-only phase:
 *
 * - `script-src` allows `'unsafe-inline'` and `'unsafe-eval'`. Next.js ships
 *   inline bootstrap scripts, and removing them properly needs a per-request
 *   nonce threaded through `middleware.ts` — that is a change in its own right,
 *   not a header string. Until that lands, the allowlist that matters is the
 *   set of *origins*, and that set is the thing this phase measures.
 * - `style-src` allows `'unsafe-inline'`. Shiki injects its token colours as
 *   inline `<style>` at render time, so this one has no non-inline form.
 *
 * The origin lists are hand-enumerated from what the app actually loads, and
 * a violation report is how we find the ones we missed. T-022 promotes this to
 * the enforcing header once that report has been read and has stopped moving.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  // Plugins and <object>/<embed> have no place in this app. 'none' is the
  // only value with no bypass.
  "object-src 'none'",
  // Matches X-Frame-Options: DENY, but this one also covers nested iframes.
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.com",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://img.clerk.com https://*.clerk.com https://avatars.githubusercontent.com https://camo.githubusercontent.com https://ui-avatars.com`,
  "font-src 'self' data:",
  `connect-src 'self' https://*.clerk.com wss://*.clerk.com https://api.openrouter.ai https://*.inngest.app wss://*.inngest.app https://*.vercel.com wss://*.vercel.com http://localhost:8288 ws://localhost:8288`,
  // Clerk's bot-protection widget and its captcha iframe.
  "frame-src 'self' https://*.clerk.com https://challenges.cloudflare.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  `report-uri ${CSP_REPORT_ENDPOINT}`,
  "report-to csp-endpoint",
].join("; ");

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
            // Report-only until T-022. Shipping the enforcing header before the
            // origin list below has been validated against a real violation
            // report would break chat streaming, Shiki, Clerk and the Inngest
            // dev server — a broken app teaches us nothing about the policy.
            key: "Content-Security-Policy-Report-Only",
            value: CONTENT_SECURITY_POLICY,
          },
          {
            // `Reporting-Endpoints` is what current browsers read; `Report-To`
            // is the older name. Both name the group `report-to` refers to.
            key: "Reporting-Endpoints",
            value: `csp-endpoint="${CSP_REPORT_ENDPOINT}"`,
          },
          {
            key: "Report-To",
            value: JSON.stringify({
              group: "csp-endpoint",
              max_age: 10886400,
              endpoints: [{ url: CSP_REPORT_ENDPOINT }],
            }),
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
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

export default nextConfig;
