/**
 * T-020 — Sentry for the Edge runtime.
 *
 * The logger's error transport is not registered here: this bundle has no Node
 * stream context, and `captureException` in the Edge SDK is a global bound by
 * the framework rather than something the application can call per-record.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production" && Boolean(process.env.SENTRY_DSN),
  tracesSampleRate: 0,
  debug: false,
});
