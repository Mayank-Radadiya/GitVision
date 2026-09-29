/**
 * Health-check tunables.
 *
 * These live outside the route module on purpose: Next.js validates the
 * exported surface of a `route.ts` and rejects anything that is not a route
 * field, so a constant exported from there fails `next build` even though
 * `tsc --noEmit` is happy.
 */

/**
 * How long a project may sit in "processing" with no progress recorded
 * before we call it wedged.
 *
 * This is a *no-progress* window, not a total-runtime window. The embedding
 * pipeline is explicitly allowed to run for up to 30 minutes on large repos,
 * so a flat "running longer than 15 minutes" check would page the operator on
 * every healthy large repo.
 */
export const STUCK_AFTER_MS = 15 * 60 * 1000;
