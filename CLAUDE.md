# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

GitVision — Next.js 15 App Router app that indexes GitHub repositories and answers questions about them (RAG). Read `@docs/architecture.md` before changing layering, `@docs/SECURITY.md` before touching auth/tenancy/credits, and `@docs/DECISIONS.md` before changing an architectural decision — that file is authoritative: where a decision imposes an invariant, all later tasks and PRs must respect it.

## Commands

`bun` is the package manager (`packageManager: "bun@1.4.0"`). Do not use npm/pnpm/yarn.

```bash
bun run typecheck   # tsc --noEmit
bun run lint        # eslint .  (flat config; baseline is 0 errors / 4 pre-existing warnings)
bun run test        # vitest run
bun run test:coverage  # vitest --coverage — THE ONLY command that enforces thresholds
bun run build       # next build (ANALYZE=true for the bundle analyzer)
bun run dev         # turbopack dev
bun run db:push     # reconcile schema from drizzle schema (local)
bun run db:migrate  # replay committed SQL (shared environments)
```

Non-obvious ones:

- **`test:coverage` is the gate.** Global thresholds are 35/28/27/36 (stmts/branches/funcs/lines), with higher floors for `src/lib/**` (54/49/59/55) and `app/api/**` (41/37/31/41). `bun run test` does *not* check them. Coverage is a target that rises ~5 points per sprint.
- **E2E is `bun run test:e2e`** (Playwright). It boots its own dev server. `CLERK_SECRET_KEY` must be a `sk_test_` key or `e2e/global-setup.ts` refuses; override the fixture identity with `CLERK_E2E_USER_EMAIL` / `CLERK_E2E_USER_PASSWORD`. It is not run in CI. `e2e/.auth/user.json` is a live credential — gitignored, never commit it.
- **`bun run inngest` must be running in a second terminal** or background jobs silently never execute.
- **`bun run eval:retrieval` reads the production `DATABASE_URL`** and embeds three real repos. Manual only — never as part of a PR check.
- **`bun run db:backup` refuses to write inside the repo**; `BACKUP_DIR` must point outside the tree.
- Single test: `bunx vitest run src/__tests__/unit/budget.test.ts`, or `-t 'test name'`.

CI runs, in order: audit → typecheck → lint → test → coverage → build. A change is done when all six pass locally.

## Testing

- Tests live **only** under `src/__tests__/{unit,integration,helpers}/`. The Vitest `include` is `src/__tests__/**/*.test.{ts,tsx}`, so a test written anywhere else is silently never run.
- `src/__tests__/setup.ts` sets a placeholder `DATABASE_URL` when unset because `db/index.ts` constructs the Neon client at module scope — without it, any suite importing a tRPC router dies at import. Keep that line.
- DB-touching suites gate on `hasTestDatabase` (`TEST_DATABASE_URL`, via `src/__tests__/helpers/db.ts`) and skip silently when unset. Point it at an **empty** database — the tests apply migrations themselves.
- Before declaring anything done, run `typecheck` + `lint` + `test` and report actual counts. Do not claim a check passed that you did not run.

## Environment

`.env.example` is heavily commented and every name in it is read by code. Required: `DATABASE_URL` (read at import time — the build fails without a syntactically valid one), `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `GITHUB_TOKEN`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`. Leave Sentry/PostHog/Neon vars empty locally and in CI; they are all no-ops when unset.

## Architecture invariants

Layering is `app → features → lib → db`, with exactly three documented exceptions (the tRPC `_app.ts` composition root, `inngest/functions.ts`, and `github/services/files.ts` reusing `computeHash`). Don't add a fourth.

- **No transactions.** The `neon-http` driver is stateless (D-11). Multi-step operations use explicit compensating writes or latched refunds — never reach for `db.transaction()`.
- **No RLS.** Tenant isolation is application-level. Ownership guards return **404, not 403**, so existence isn't leaked. Preserve that.
- **Two ownership primitives** exist; read `docs/architecture.md` before touching either.
- **`src/lib/github/index.ts` is the only intended entry point** into the GitHub layer, and it deliberately does not export the `octokit` singleton. This is convention, not enforcement — ESLint's import ban covers `services/**` only, not `features/**`.
- **Routes are private by default** (`proxy.ts`). A new public route must be added to `PUBLIC_ROUTE_PATTERNS`. Never wildcard `/api/trpc`.
- **CSP is enforcing**, not report-only, with per-request nonces minted by Clerk. `stripUnsafeScriptDirectives` in `proxy.ts` is the only place the policy can be post-processed.
- `next.config.ts` keeps `log` alongside `error`/`warn` in production (`removeConsole`) because INFO lines carry Inngest pipeline progress. Removing them breaks stuck-job diagnosis.
- Logging must go through `src/lib/logger.ts` (nine keys redacted). Sentry auto-capture bypasses redaction unless handled explicitly.
- `src/lib/rag/rag.config.ts` (`RAG_CONFIG`) is the single source for retrieval thresholds — don't reintroduce module-local constants.
- Credit spend is atomic via single data-modifying CTEs with a DB-level `CHECK`. `refundCredits(userId, cost, reason, refId?)` takes four parameters — three required, plus an optional `refId` that is the idempotency key. Most call sites pass three and let it default; the claim's absence would silently drop the key where a claim-flow refund needs it.
- Migrations in `db/migrations/` are paired `.sql` + `.notes.md` files.
- `@tanstack/react-query` and `@trpc/tanstack-react-query` are both installed. Check which one a file uses before copying a pattern.

## Code style

ESLint enforces project-specific bans in `src/lib/github/services/**`: no `axios` import (go through `src/lib/github/client.ts`), and no `Bearer` string/template literal (use `getGitHubAuthHeader()`). These are F-20 fix-referenced — don't work around them.

Prettier is configured (`.prettierrc` sets only the Tailwind plugin, so Prettier defaults apply) but **not enforced** — there is no `format` script and no format check in CI. Match surrounding style rather than reformatting.

## Workflow

**Plan first.** For anything beyond a small fix, present an approach and wait for a go-ahead before writing code.

**Branch naming:** `lane/pN-x` for a work lane (each lane owns specific paths — see `status/pN-x.md`), `fix/T-0NN-<slug>`, `feat/<slug>`, `verify/<phase>`.

**Commits are task-ID-first and mandatory:** `[F-22] Land performance fixes...`. ID namespaces: `T-0NN` tasks, `F-NN` feature workstreams, `D-NN` architecture decisions, `V-NN` deferred V2. Bodies are long-form and normative — state what shipped, why, dependencies, what was deliberately left undone, and end with a `Verified:` line carrying real numbers.

**Every fix closes in three steps:** implement → record the commit hash in `task.md`'s `## DONE` lane ledger → flip the matching `Defect Coverage` row. A code commit without the two bookkeeping edits is incomplete by house convention. Use `/close-task` for steps 2 and 3.

`task.md` is the authoritative task and defect board, not a scratch file. Phases are gated: Phase 0 has a standing rule that no new surface may be added until its exit criteria are met. Read `task.md` before starting any `T-NNN`/`F-NN` work.

Note: `gitvisionStrategy2.md`, `TASKS.md`, and `AGENT_RULES.md` are cited throughout `task.md` but do not exist in this repo — every `§` citation can only be checked against live code. Don't go looking for them.

## Not project source

`.agents/skills/` (942 gitignored vendored skill dirs) and `.opencode/` (a separate OpenCode plugin with its own lockfile) are third-party and gitignored. Don't read, maintain, or copy patterns from them.
