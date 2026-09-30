/**
 * F-24 — Sentry for the browser runtime (decision D-4).
 *
 * This file is the client counterpart of instrumentation.ts. It is
 * `instrumentation-client.ts` rather than the older `sentry.client.config.ts`
 * because the latter is deprecated under Turbopack, and `next dev` runs with
 * `--turbopack` in this repo.
 *
 * The DSN is read from `NEXT_PUBLIC_SENTRY_DSN`, not `SENTRY_DSN`: Next.js only
 * inlines `NEXT_PUBLIC_*` into the browser bundle, so the server-side name would
 * compile to `undefined` here and the client would silently never report.
 *
 * The same gate as the server and edge runtimes applies, per D-4: no outbound
 * call outside production. `beforeSend` and `beforeBreadcrumb` run every event
 * and breadcrumb through the redaction gate in src/lib/logger.ts, so a browser
 * payload cannot bypass the denylist that stdout is held to.
 */
import * as Sentry from "@sentry/nextjs";

import { sanitizeForOutbound } from "@/src/lib/logger";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: process.env.NODE_ENV === "production" && Boolean(dsn),
  tracesSampleRate: 0,
  debug: false,
  beforeSend: sanitizeForOutbound,
  beforeBreadcrumb: sanitizeForOutbound,
});
