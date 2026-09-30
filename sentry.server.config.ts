/**
 * T-020 — Sentry for the Node.js runtime, and the only place the logger's
 * error transport is wired.
 *
 * The transport receives the already-redacted record, so this file must never
 * re-derive or re-log the payload: doing either would create a second path
 * around the redaction in src/lib/logger.ts.
 *
 * F-24 — the transport above only covers `logger.error` calls. Errors the
 * framework captures on its own (unhandled route handlers, load errors) never
 * touch the logger, so `beforeSend` and `beforeBreadcrumb` put every event and
 * breadcrumb through the same walker before it can leave the process.
 */
import * as Sentry from "@sentry/nextjs";

import { registerErrorTransport, sanitizeForOutbound } from "@/src/lib/logger";

const dsn = process.env.SENTRY_DSN;
const enabled = process.env.NODE_ENV === "production" && Boolean(dsn);

Sentry.init({
  dsn,
  enabled,
  tracesSampleRate: 0,
  // Sentry's own diagnostics would add a second console write per error and
  // break the one-line-per-error contract in src/__tests__/unit/logger.test.ts.
  debug: false,
  beforeSend: sanitizeForOutbound,
  beforeBreadcrumb: sanitizeForOutbound,
});

if (enabled) {
  registerErrorTransport((payload) => {
    const source = payload.error;
    const reported =
      source !== null && typeof source === "object" && "message" in source
        ? Object.assign(
            new Error(String((source as { message: unknown }).message)),
            {
              name: String((source as { name?: unknown }).name ?? "Error"),
              stack: (source as { stack?: unknown }).stack,
            },
          )
        : new Error(String(payload.message ?? "Unknown error"));

    Sentry.captureException(reported, { extra: payload });
  });
}
