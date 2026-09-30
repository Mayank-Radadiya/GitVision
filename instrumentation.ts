/**
 * T-020 — runtime entry point for error tracking (decision D-4).
 *
 * Sentry is initialised per runtime because the Edge bundle cannot load the
 * server config: it has no Node stream context.
 *
 * F-24 — `onRequestError` was previously described here as unnecessary. That was
 * wrong: automatic route/handler instrumentation covers errors thrown *inside* a
 * handler, but an error escaping a nested React Server Component never reaches
 * it. Next.js reports those through `onRequestError` and nothing else, so
 * without this export they were dropped. Sentry's build plugin also warns about
 * the absence at build time.
 */
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
