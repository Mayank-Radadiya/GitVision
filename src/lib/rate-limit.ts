// ============================================================================
// Postgres-backed sliding-window rate limiter
// ============================================================================
// One row per (route × subject) key. The upsert is atomic per key, so it's
// correct across multiple serverless instances — no in-memory state to drift.
// Table: rate_limits (see db/schema.ts).

import { sql } from "@/db"; // neon client from db/index.ts

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
}

/**
 * Record one request for `key` within a `windowSeconds` sliding window.
 * `allowed` is false once the window count exceeds `limit`.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const rows = (await sql`
    INSERT INTO rate_limits (limit_key, window_start, count)
    VALUES (${key}, now(), 1)
    ON CONFLICT (limit_key) DO UPDATE SET
      count = CASE
        WHEN rate_limits.window_start < now() - (${windowSeconds} * interval '1 second')
          THEN 1
        ELSE rate_limits.count + 1
      END,
      window_start = CASE
        WHEN rate_limits.window_start < now() - (${windowSeconds} * interval '1 second')
          THEN now()
        ELSE rate_limits.window_start
      END
    RETURNING count
  `) as { count: number }[];

  const count = Number(rows[0]?.count ?? 1);
  return {
    allowed: count <= limit,
    limit,
    remaining: Math.max(limit - count, 0),
  };
}

/** Convenience guards for the common route-level keys. */
export const keys = {
  chat: (userId: string) => `chat:${userId}`,
  projectCreate: (userId: string) => `project-create:${userId}`,
  embeddings: (userId: string) => `embeddings:${userId}`,
} as const;
