"use client";

import { useEffect } from "react";
import { Analytics } from "@vercel/analytics/next";

/**
 * T-077 — product analytics.
 *
 * Two sinks, deliberately asymmetric:
 *
 * • Vercel Analytics is cookieless and needs no project key, so there is no
 *   configuration in which enabling it is the wrong call — but it is still
 *   confined to production, because the point of the mount is production
 *   telemetry, not a beacon that fires on every `next dev` reload.
 * • PostHog is initialised only when `NEXT_PUBLIC_POSTHOG_KEY` is present. A
 *   client-side SDK pointed at a placeholder host does not fail loudly — it
 *   buffers events and drops them, which reads as "analytics are broken"
 *   rather than "analytics are not configured". Absence of the key therefore
 *   has to skip initialisation outright rather than half-enable it.
 *
 * `capture_pageview: "history_change"` rather than `true`: the App Router
 * navigates client-side, so `true` records only the first pageview of a
 * session and every soft navigation after it is invisible. The typed option
 * is documented at `posthog-js/dist/module.d.ts:4133`.
 *
 * `posthog.init` is the only call that mutates the module-level singleton, so
 * a dependency array of `[key]` cannot re-init it. The guard below also keeps
 * React 19's double-invoked effects from initialising twice.
 */
let initialised = false;

export default function ProductAnalytics() {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  const enabled = process.env.NODE_ENV === "production";

  useEffect(() => {
    if (!enabled || !key || initialised) return;
    initialised = true;

    void import("posthog-js").then(({ default: posthog }) => {
      posthog.init(key, {
        api_host: host || "https://us.i.posthog.com",
        capture_pageview: "history_change",
      });
    });
  }, [enabled, key, host]);

  if (!enabled) return null;

  return <Analytics />;
}
