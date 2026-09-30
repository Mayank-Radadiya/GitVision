/**
 * T-020 — runtime entry point for error tracking (decision D-4).
 *
 * Sentry is initialised per runtime because the Edge bundle cannot load the
 * server config: it has no Node stream context. `onRequestError` is
 * deliberately absent — Sentry's automatic route/handler instrumentation
 * already covers it once the nodejs runtime is initialised here.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
