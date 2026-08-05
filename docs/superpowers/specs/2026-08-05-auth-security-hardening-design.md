# Auth & Security Hardening — GitVision

**Date:** 2026-08-05
**Status:** Implemented

## Goal

Fix the auth/security gaps found in a review of GitVision's API routes and
tRPC routers: cross-tenant data leaks (IDOR), unbounded LLM/GitHub cost abuse,
decorative credits, and missing webhook lifecycle handling — while keeping
requests fast.

## Decisions (user-approved)

- **GitHub auth:** keep the shared `GITHUB_TOKEN`, enforce public-repos-only
  via a strict `github.com`-only URL validator. No per-user OAuth (deferred).
- **Credits:** enforce the `credits` field on AI chat (atomic spend, 402 when
  exhausted).
- **Rate limiting:** Postgres-backed sliding-window limiter on the existing
  Neon DB (new `rate_limits` table, no new dependency).

## Changes

### New shared modules

- `src/lib/guards.ts` — `assertProjectOwnership(projectId, userId)`: one query
  scoped by `owner_id`; throws `ProjectAccessError` (→ 404).
- `src/lib/rate-limit.ts` — `rateLimit(key, limit, windowSeconds)`: atomic
  upsert; increments within the window, resets when the window ages out.
- `db/schema.ts` — `rate_limits` table (`limit_key` PK, `window_start`,
  `count`). Migration `0006`.

### Route / router fixes

| File | Fix |
|---|---|
| `/api/project/getProjectCommits` | `auth()` + ownership; `count(*)` replaces full-row count |
| `/api/project/getProjectDetails` | `auth()` + ownership |
| `/api/project/getProjectFiles` | `auth()` + ownership (full-source leak closed) |
| `/api/project/createProject` | `projectCreateSchema.safeParse` (github.com-only); rate limit 10/hr |
| `/api/chat` | project ownership; rate limit 20/min; credit spend (atomic, 402); prompt-injection delimiter |
| `/api/embeddings` POST/GET/DELETE | ownership; POST rate limit 5/10min |
| `/api/embeddings/reset` | scoped to `owner_id` (was global) |
| tRPC `project.create` | rate limit 10/hr |
| tRPC `chat.create` | verifies project ownership before insert |
| `/api/webhooks/clerk` | `user.deleted` → cascade delete; DB ops in try/catch; returns 200 |

### Prompt-injection hardening

All system prompts now carry an untrusted-data delimiter: repository content
is treated as inert text; instructions embedded in it are ignored.

## Verified

- `tsc --noEmit` — no errors in changed files.
- `next build` — exit 0.
- Rate-limit upsert tested against the DB: 1→2→3 within window, resets to 1
  after expiry.
- `rate_limits` migration applied to the database.

## Out of scope / deferred

- Per-user GitHub OAuth (private repos) — requires a GitHub App; separate effort.
- Credit refund on failed streams (a message costs one credit once accepted).
- In-memory `activeGenerations` map in `/api/embeddings` is per-instance only;
  the DB status field already prevents duplicate work.
