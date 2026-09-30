"use client";

import { useEffect } from "react";
import { Analytics } from "@vercel/analytics/next";

/**
 * T-077 — product analytics.
 *
 * Two sinks, deliberately asymmetric:
 *
 * • Vercel Analytics is mounted unconditionally. `@vercel/analytics` is
 *   cookieless and needs no project key, so there is no configuration in which
 *   enabling it is the wrong call.
 * • PostHog is initialised only when `NEXT_PUBLIC_POSTHOG_KEY` is present. A
 *   client-side SDK pointed at a placeholder host does not fail loudly — it
 *   buffers events and drops them, which reads as "analytics are broken"
 *   rather than "analytics are not configured". Absence of the key therefore
 *   has to skip initialisation outright rather than half-enable it.
 *
 * `posthog.init` is the only call that mutates the module-level singleton, so
 * a dependency array of `[key]` cannot re-init it. The guard below also keeps
 * React 19's double-invoked effects in development from initialising twice.
 */
let initialised = false;

export default function ProductAnalytics() {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

  useEffect(() => {
    if (!key || initialised) return;
    initialised = true;

    void import("posthog-js").then(({ default: posthog }) => {
      posthog.init(key, {
        api_host: host || "https://us.i.posthog.com",
        capture_pageview: true,
      });
    });
  }, [key, host]);

  return <Analytics />;
}
