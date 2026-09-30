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

// There is deliberately no exported key builder. A caller that assembled its
// own key would have to know about the IP and daily dimensions to include them,
// and the one that forgot would silently restore the signup-churn hole this
// file exists to close.

/** The metered surfaces. Each one costs real money per call. */
export type MeteredScope =
  | "chat"
  | "projectCreate"
  | "embeddings"
  | "embeddingsRead"
  | "summary"
  | "issuesSync"
  | "projectResync";

export type LimitScope = "user" | "ip" | "daily";

/**
 * Ceilings per metered surface, on two dimensions.
 *
 * The user limit is the fairness budget: one person, one allowance. The IP
 * limit is the cost ceiling, and it exists because a user-scoped limit alone
 * is not a budget — a fresh Clerk account resets it entirely, so signup churn
 * buys unlimited LLM and GitHub spend.
 *
 * The IP ceiling is deliberately looser than the user one. An office, a
 * university and a mobile carrier all put many real users behind a single
 * address; if the IP limit were the tighter of the pair they would throttle
 * each other and the per-user limit would never be reached.
 */
export const LIMITS: Record<
  MeteredScope,
  { user: { limit: number; windowSeconds: number }; ip: { limit: number; windowSeconds: number } }
> = {
  // 20/min per user, 200/min per address.
  chat: { user: { limit: 20, windowSeconds: 60 }, ip: { limit: 200, windowSeconds: 60 } },
  // 10/hour per user — 40/hour per address covers a small team on one network.
  projectCreate: {
    user: { limit: 10, windowSeconds: 3600 },
    ip: { limit: 40, windowSeconds: 3600 },
  },
  // 5/10min per user, 40/10min per address.
  embeddings: {
    user: { limit: 5, windowSeconds: 600 },
    ip: { limit: 40, windowSeconds: 600 },
  },
  // 30/min per user, 200/min per address. Status polling, not generation, so it
  // gets a far wider budget than `embeddings` — but it is still metered, because
  // an unrated status endpoint is a free amplification loop for whoever wants one.
  embeddingsRead: {
    user: { limit: 30, windowSeconds: 60 },
    ip: { limit: 200, windowSeconds: 60 },
  },
  // 20/hour per user, 120/hour per address.
  summary: {
    user: { limit: 20, windowSeconds: 3600 },
    ip: { limit: 120, windowSeconds: 3600 },
  },
  // 5/hour per user, 40/hour per address.
  issuesSync: {
    user: { limit: 5, windowSeconds: 3600 },
    ip: { limit: 40, windowSeconds: 3600 },
  },
  // 5/hour per user, 20/hour per address — the same per-user budget as
  // `issuesSync`, and a tighter IP ceiling than the 40 that the other sync
  // uses. A re-sync spends one of the 5,000 shared GitHub calls per request
  // and can re-embed every changed file behind it, so the address-wide
  // ceiling is the one that actually bounds the shared-token bill.
  projectResync: {
    user: { limit: 5, windowSeconds: 3600 },
    ip: { limit: 20, windowSeconds: 3600 },
  },
};

/**
 * One counter for every metered surface, per day.
 *
 * Not a fairness control and not a substitute for the two above: a distributed
 * attack is one IP at a time until it is not. This is the backstop that bounds
 * the invoice when the per-subject limits are all individually under budget —
 * many accounts, many addresses, or a bug in a caller.
 */
export const DAILY_CEILING: { limit: number; windowSeconds: number } = {
  limit: 5_000,
  windowSeconds: 86_400,
};

const DAILY_KEY = "metered:daily";

/**
 * The caller's address, or `null` when it cannot be trusted to be one.
 *
 * Header order is the whole point. `x-forwarded-for` is *append-only*: a
 * client that sends its own value keeps it, and the proxy adds to the end. So
 * the first hop is chosen by the caller and the last hop is chosen by a proxy
 * we control — we read the last one. `x-vercel-forwarded-for` and
 * `cf-connecting-ip` are better still, because the platform *overwrites* them
 * and a client cannot smuggle a value through at all, so they win outright.
 *
 * A value that is not IP-shaped returns `null` rather than being passed on:
 * the key lands in a `varchar(255)` primary key, and an unbounded
 * attacker-chosen string is a write amplifier that groups no real client.
 */
export function clientIp(req?: Request | null): string | null {
  if (!req) return null;

  const headers = req.headers;
  const platform = headers.get("x-vercel-forwarded-for") ?? headers.get("cf-connecting-ip");
  const forwarded = headers.get("x-forwarded-for")?.split(",").pop()?.trim();
  const candidate = platform?.trim() || forwarded;

  if (!candidate) return null;

  // Bracketed IPv6, e.g. `[2001:db8::1]`, and a `host:port` pair on the
  // legacy form. Longest legal textual IPv6 is 45 characters.
  let value = candidate.replace(/^\[/, "").replace(/\](:\d+)?$/, "").split("%")[0]!;
  // A legacy `1.2.3.4:port` form. Only stripped when the remainder looks like
  // an IPv4 address, so a bare `::1` keeps its last group.
  const hostPort = /^(.*\..*):\d+$/.exec(value);
  if (hostPort) value = hostPort[1]!;
  if (value.length > 45) return null;
  if (!/^[0-9a-f:.]+$/i.test(value)) return null;
  if (!value.includes(".") && !value.includes(":")) return null;

  return value;
}

/** The rate-limit row key for one dimension of one surface. */
function keyFor(scope: MeteredScope, dimension: LimitScope, subject: string): string {
  const prefix = dimension === "user" ? "u" : "i";
  const name = scope.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
  return `${name}:${prefix}:${subject}`;
}

export interface RateLimitDecision extends RateLimitResult {
  /** Which ceiling was hit, so the caller can say something accurate. */
  scope: LimitScope;
}

/**
 * Count one metered call against every ceiling that applies to it.
 *
 * The dimensions are checked cheapest-first and short-circuit: a caller who is
 * already over their own budget does not get to spend two more writes. The
 * result reports the first ceiling that refused, because that is the one the
 * user has to be told about.
 *
 * Pass the request when there is one. A server-side tRPC `caller` has none,
 * and that is not a gap worth papering over with a placeholder address: every
 * such call would share one counter and the first caller would throttle the
 * rest. They are covered by the user and daily dimensions regardless.
 */
export async function enforceLimits(
  scope: MeteredScope,
  userId: string,
  req?: Request | null,
): Promise<RateLimitDecision> {
  const user = LIMITS[scope].user;
  const userResult = await rateLimit(keyFor(scope, "user", userId), user.limit, user.windowSeconds);
  if (!userResult.allowed) return { ...userResult, scope: "user" };

  const ip = clientIp(req);
  if (ip) {
    const ipLimit = LIMITS[scope].ip;
    const ipResult = await rateLimit(keyFor(scope, "ip", ip), ipLimit.limit, ipLimit.windowSeconds);
    if (!ipResult.allowed) return { ...ipResult, scope: "ip" };
  }

  const daily = await rateLimit(DAILY_KEY, DAILY_CEILING.limit, DAILY_CEILING.windowSeconds);
  if (!daily.allowed) return { ...daily, scope: "daily" };

  return { ...userResult, scope: "user" };
}
