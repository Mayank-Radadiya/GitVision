/**
 * T-020 — Sentry for the Node.js runtime, and the only place the logger's
 * error transport is wired.
 *
 * The transport receives the already-redacted record, so this file must never
 * re-derive or re-log the payload: doing either would create a second path
 * around the redaction in src/lib/logger.ts.
 */
import * as Sentry from "@sentry/nextjs";

import { registerErrorTransport } from "@/src/lib/logger";

const dsn = process.env.SENTRY_DSN;
const enabled = process.env.NODE_ENV === "production" && Boolean(dsn);

Sentry.init({
  dsn,
  enabled,
  tracesSampleRate: 0,
  // Sentry's own diagnostics would add a second console write per error and
  // break the one-line-per-error contract in src/__tests__/unit/logger.test.ts.
  debug: false,
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
