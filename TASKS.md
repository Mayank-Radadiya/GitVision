# GitVision Remediation Plan
_Source: `audit.md` (repo root) · Generated: 2026-09-29 · Verified against commit: `1e577d4`_

> `docs/AUDIT.md` does not exist; the audit is `audit.md` at the repo root.
> `1e577d4` is the exact commit the audit was written against, so every finding was re-checked at HEAD and **all of them still reproduce**. Nothing in the audit is already fixed.
> Five audit details are wrong and are corrected inline below: M18 preload count (4, not 6), L16 line numbers (98/110, not 95/108), M10 escape count (one `as any` + one `<any>` generic), L5 (`createCallerFactory` is test infrastructure, not dead code), L2 (`req.json()` *is* inside the `try`, but `SyntaxError` still precedes `safeParse`).

## Summary
- **Total tasks: 64** (P0: 11, P1: 25, P2: 28)
- **Estimated effort:** P0 ~8 h, P1 ~25 h, P2 ~19 h — total ~52 h
- **Already resolved since audit:** none
- **Unverified:** none — every finding was confirmed against `1e577d4` with an exact file:line
- **Blocked on a human decision:** D-1 → T-005, D-12 → T-001, D-3 → T-013, D-4 → T-020, D-5 → T-021, D-6 → T-023, D-7 → T-058, D-8 → T-038, D-9 → T-041, D-11 → T-045, D-2 → T-025

### Phase map (audit §16 order, plus H5 which §16 omits)
§16 lists 8 P0 items; H5 (module-load `GITHUB_TOKEN` throw) is a Section-5 High that §16 never scheduled, so it is pulled into P0 here. §16 lists 10 P1 and 12 P2 items; M17 and M24 (both real, both in Section 6) are also unscheduled, so they join P1. Everything else is §16 item-for-item.

## Decisions made
- D-2: remove triage (T-028), keep columns
- D-3: partial-index badge (T-013 as written)
- D-5: report-only CSP first
- D-6: fix the doc (T-024), skip T-023
- D-9: HTTPS-only docstring fix
- D-11: stay on neon-http
- D-12: S3, private bucket, 14-day lifecycle

---

## Phase P0 — Before taking real money

### T-001 · Schedule the database backup
- [ ] **Status:** todo
- **Audit ref:** C1 (§4, §13, §15 #1)
- **Severity:** Critical
- **Effort:** M (30-90m)
- **Depends on:** D-12 (backup destination) — T-001 can start once D-12 lands
- **Files:** `.github/workflows/backup.yml` (new), `scripts/db-backup.ts:68`, `package.json:16`, `docs/operations/backup-retention.md:18,25-28,53`
- **Problem:** `scripts/db-backup.ts` is correct and well-guarded (it runs `pg_dump`, validates REQUIRED_MARKERS, rejects sub-1KB output, warns that a dump is every customer's source code) but **nothing ever runs it**. `backup-retention.md` admits it: *"Cadence: nobody runs this automatically. There is no cron and no CI step that takes a dump."* The database holds complete customer source code and embeddings; `syncIssues` DELETEs before re-pulling and `user.deleted` is an irreversible hard cascade, so a lost DB is unrecoverable customer data. PITR is Neon-side and unverifiable from this repository.
- **What to do:**
  1. Per D-12, add `.github/workflows/backup.yml` with `on: schedule: - cron: '17 3 * * *'` (off-the-hour to avoid the GitHub Actions scheduling stampede) plus `workflow_dispatch`.
  2. Give the job `DATABASE_URL` from a repository secret, not from the environment — do not reuse the CI workflow's placeholder.
  3. Run `bun install --frozen-lockfile` then `bun run db:backup`; upload the dump with `actions/upload-artifact` at the retention decided in D-12.
  4. Fail the job loudly if `db-backup.ts` exits non-zero — a silently-skipped backup is worse than a failed one, because the failure never pages anyone.
  5. Update `backup-retention.md:18,28,53` from `npm run db:backup` to `bun run db:backup` and replace the "nobody runs this" sentence with the actual schedule. (Line 28 currently contradicts line 18 in the same file.)
- **Acceptance criteria:**
  - [ ] A scheduled workflow exists whose only job is the dump, and it runs on a real cron.
  - [ ] The workflow fails (non-zero) if `bun run db:backup` fails.
  - [ ] Retention on the artifact matches the D-12 decision, and the doc states the same number.
  - [ ] `backup-retention.md` no longer says `npm run`, and no longer claims the dump is manual.
  - [ ] Test added: none required — this is CI/ops configuration. Manual check is the acceptance gate.
- **How to verify:** `gh workflow view backup.yml`; then `gh workflow run backup.yml` and confirm `gh run list --workflow backup.yml` shows a green run with an uploaded artifact. Locally: `bun run db:backup` exits 0.
- **Notes/risks:** A GitHub Actions artifact is capped at 90 days and is awkward for a 7-day SQL-dump cadence (D-12) — if S3 or a Neon branch is chosen instead, the workflow shape changes but the job body does not. Consider a second weekly restore-drill job; a backup that has never been restored is a hypothesis.

### T-002 · Make `/api/health` publicly reachable and test it through the middleware
- [x] **Status:** done
- **Audit ref:** H3 (§5, §13, §15 #2)
- **Severity:** High
- **Effort:** M (30-90m)
- **Depends on:** none
- **Files:** `proxy.ts:12-24`, `src/__tests__/integration/health-endpoint.test.ts:69,81,93,104,112,123,138`, `src/__tests__/integration/proxy-allowlist.test.ts:54-65,68-81`, `app/api/health/route.ts:15`
- **Problem:** `proxy.ts` allowlists `"/"`, `"/sign-in(.*)"`, `"/sign-up(.*)"`, `"/forgot-password(.*)"`, `"/legal(.*)"`, `"/sso-callback"`, `"/api/webhooks/clerk"`, `"/api/inngest(.*)"` — and **not** `"/api/health"`. The matcher `"/(api|trpc)(.*)"` then sends it to `auth.protect()`. The route itself is excellent (force-dynamic, DB probe, reports projects wedged in `embeddingStatus='processing'` for >15 min) but **no uptime monitor or pager can read it**. The problem is worse than it looks because a test currently gives false confidence: `health-endpoint.test.ts:69` does `await import("@/app/api/health/route")` and calls the exported `GET()` directly six times, never through `proxy.ts`. The suite passes while the endpoint is unreachable in production.
- **What to do:**
  1. Add `"/api/health"` to the `PUBLIC_ROUTES` array in `proxy.ts` (matcher `/api/health` exactly, or `"/api/health(.*)"` if you intend sub-paths).
  2. Add `/api/health` to the `PUBLIC` list in `proxy-allowlist.test.ts` so the allowlist itself is covered by a test, not just the route body.
  3. Rewrite `health-endpoint.test.ts` so at least one case goes through the real middleware: import the default export from `@/proxy`, call it with a `NextRequest` for `/api/health`, and assert it reaches the handler rather than redirecting to sign-in. Keep the existing direct-`GET()` cases for the degraded-state logic — they are valid for what they cover; add the middleware case rather than deleting them.
  4. Stop the unauthenticated response leaking customer data: the degraded list includes `projectName` for each wedged project. Drop the name, or gate the name behind an auth/admin check.
  5. Confirm no other endpoint got widened by the regex.
- **Acceptance criteria:**
  - [x] An unauthenticated `GET /api/health` from outside Clerk returns 200 (or 503 when degraded) instead of a sign-in redirect.
  - [x] A test asserts the middleware path specifically; deleting the allowlist entry now makes a test fail.
  - [x] The unauthenticated JSON body contains no customer project names.
  - [x] Test updated: `src/__tests__/integration/health-endpoint.test.ts` and `src/__tests__/integration/proxy-allowlist.test.ts`.
- **How to verify:** `bun run test -- src/__tests__/integration/health-endpoint.test.ts src/__tests__/integration/proxy-allowlist.test.ts`; then `bun run dev` and `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/health` from a logged-out client.
- **Notes/risks:** This is a public, unauthenticated endpoint that runs a DB query. Keep it read-only, keep the response body small, and do not add project identifiers. Rate-limit it or accept the cost — the query is a single indexed lookup, but the decision is D-5-adjacent.
- **Note:** Read "do not add project identifiers" as *no names* — `id` is kept in the degraded list, since it is what an operator needs to act and the acceptance criterion forbids project names specifically. The `db.select` mock in `health-endpoint.test.ts` now honours the column projection; without that it would have returned whole rows and reported a leak whether or not the route asked for `projectName`. Verified live: 404 before the change, 503 after (a project really is wedged in this database), body carries `id` and no name.

### T-003 · Fix the two dead dashboard hrefs
- [ ] **Status:** todo
- **Audit ref:** H1 (§5, §15 #3)
- **Severity:** High
- **Effort:** S (<30m)
- **Depends on:** none
- **Files:** `src/features/dashboard/server/router/services/projectService.ts:663-665,680`
- **Problem:** The "Pick up where you left off" cards link to `/projects/...`, but **no `/projects/**` route exists in the app**. The real routes are `app/(main)/dashboard/user-project/[projectId]/page.tsx` and `app/(main)/chat/[chatId]/page.tsx`. Repo-wide `rg '"/projects'` finds exactly two hits and both are here; every other `/projects` match is a `@/features/projects/…` import path. Two of these three cards are dead on the primary dashboard.
- **What to do:**
  1. `:663-665` is a ternary — `c.projectId ? \`/projects/${c.projectId}/chat/${c.id}\` : \`/chat/${c.id}\``. The general-chat fallback is already correct; the project branch is the dead one. Remove the ternary and always link to `/chat/${c.id}`.
  2. `:680` `href: \`/projects/${cm.projectId}\`` is unconditionally dead. Change it to `/dashboard/user-project/${cm.projectId}` — the exact pattern already in use at `src/features/dashboard/components/project-list/project-card.tsx:108`.
  3. Add a test that asserts every href returned by `getPickUpWhereYouLeftOff` starts with a real route prefix, so the next path rename cannot silently resurrect this.
- **Acceptance criteria:**
  - [ ] All three cards navigate to an existing route; no 404s from the dashboard.
  - [ ] A test fails if either href is reverted to a `/projects/` prefix.
  - [ ] Test added: `src/__tests__/unit/dashboard-pickup-links.test.ts` (new).
- **How to verify:** `bun run test -- src/__tests__/unit/dashboard-pickup-links.test.ts`; manual — `bun run dev`, load `/dashboard`, click every "Pick up where you left off" card.
- **Notes/risks:** Neither the project page nor the chat page needs a new param. Do **not** add a `/projects` redirect route to paper over this — that hides the next one.

### T-004 · Handle the gunzip error in the tarball ingestion path
- [ ] **Status:** todo
- **Audit ref:** H4 (§5, §15 #4)
- **Severity:** High
- **Effort:** S (<30m)
- **Depends on:** none
- **Files:** `src/lib/github/services/files.ts:14,231,233`
- **Problem:** `:233` is `stream.pipe(createGunzip()).pipe(extract);`. `extract` gets an `error` handler at `:231` and each `entryStream` gets one, but the gunzip stream created inline in the pipe chain **does not**. A corrupt or truncated 200 response emits `error` on a stream with no listener → uncaught exception → process crash, not a clean Inngest retry. This is the highest-risk code in the repository and the only `.on("error"` in the whole file is the one at `:231`.
- **What to do:**
  1. Assign the gunzip stream to a variable instead of inlining it in the pipe chain.
  2. Attach `.on("error", reject)` to it, matching the pattern already used for `extract` at `:231`.
  3. Add a test that feeds a truncated/corrupt gzip stream into the extract helper and asserts the returned promise **rejects** (does not throw synchronously, does not hang, does not crash the process). There is currently no test anywhere for the tarball path — this is the first one.
- **Acceptance criteria:**
  - [ ] A corrupt gzip payload causes a rejected promise, not an uncaught exception.
  - [ ] The rejection message identifies the corruption so the Inngest retry log is readable.
  - [ ] A new test covers the tar/gunzip path for the first time.
  - [ ] Test added: `src/__tests__/unit/github-tarball-stream.test.ts` (new).
- **How to verify:** `bun run test -- src/__tests__/unit/github-tarball-stream.test.ts`; `bun run typecheck`.
- **Notes/risks:** Check that the fix does not double-`reject` when both `extract` and `gunzip` fire — wrap in a settle-once guard if the test surfaces it.

### T-005 · Reconcile user creation when Clerk has no email address
- [ ] **Status:** todo
- **Audit ref:** M4 (§6, §15 #6)
- **Severity:** Medium (High under contention)
- **Effort:** M (30-90m)
- **Depends on:** D-1
- **Files:** `src/features/dashboard/server/router/services/projectService.ts:93,101-110`, `app/api/webhooks/clerk/route.ts:55,59`
- **Problem:** `createProject` does `clerkUser.emailAddresses[0]?.emailAddress ?? ""` and then inserts `{ id: userId, email: "", … }` with `onConflictDoNothing()`. `users.email` is UNIQUE, so the empty-string insert **silently no-ops** — both when the user row already exists (fine) and when a *different* user already holds `""` (the insert is dropped) — and the project ends up FK'd to a user row that was never created. The Clerk webhook deliberately **skips** the same case (`if (email)` at `:59`), so the two provisioning paths disagree about the same user.
- **What to do:** Implement the D-1 decision, which is one of: (a) synthesise a unique placeholder email (e.g. `${clerkUser.id}@users.noreply.invalid`) so the insert always lands and the FK always holds; (b) return a clear `TRPCError` and refuse project creation for no-email users; (c) make `users.email` nullable with a partial unique index — that needs a migration and a snapshot.
  1. Read the current `users` table insert and remove the `?? ""` silent-failure path either way.
  2. If (c) is chosen, add a Drizzle migration + `.notes.md` alongside the existing three in `db/migrations/`, matching their convention.
  3. Make `createProject` fail loudly rather than proceeding with a missing user row.
  4. Add a test: a Clerk user with zero email addresses must either produce a persisted user row (option a) or a clean typed error (option b).
- **Acceptance criteria:**
  - [ ] No code path inserts an empty-string email.
  - [ ] A no-email user can never end up with a project row pointing at a nonexistent user.
  - [ ] The Clerk webhook and `createProject` agree on the behaviour.
  - [ ] Test added or updated: `src/__tests__/unit/use-create-project.test.tsx` or a new `src/__tests__/integration/create-project-user-provisioning.test.ts`.
- **How to verify:** `bun run test` and `bun run typecheck`; `bun run db:generate` produces no unexpected diff (unless option (c) was chosen, in which case the new migration is expected and must be committed).
- **Notes/risks:** Do not "fix" this by loosening the unique constraint without the migration path — that trades a silent FK failure for silent duplicate users.

### T-006 · Refund the credit when chat retrieval fails
- [ ] **Status:** todo
- **Audit ref:** M2 (§6, §15 #7)
- **Severity:** High (money)
- **Effort:** S (<30m)
- **Depends on:** none
- **Files:** `app/api/chat/route.ts:395,440,562-567`
- **Problem:** The credit is spent at `:395` (`spendCredits(userId, CHAT_TURN_COST)`). The RAG retrieval block catches its own failure at `:562-567` (`logger.error("[RAG] Retrieval error, falling back to general mode", ragError)`) and answers anyway. `refundOnce` (defined at `:440`) is called at `:453`, `:456`, `:592` — **not** in that catch. The user is billed for an answer that contains **zero project context** while looking like a normal project-scoped answer.
- **What to do:**
  1. Call `refundOnce()` in the retrieval-failure catch, or — better — fail the request with a typed error instead of silently degrading to a context-free answer, and let the existing generic catch at `:644` handle it (it already refunds for the paths that reach it).
  2. Pick one; do not both refund and return a degraded answer, or the user gets a free answer that lies about its grounding.
  3. Add a test that forces retrieval to throw and asserts either a refund or a 5xx — mirroring `src/__tests__/integration/chat-credit-refund.test.ts`, which already covers the other refund paths.
- **Acceptance criteria:**
  - [ ] A retrieval failure never leaves a credit spent without a delivered project-grounded answer.
  - [ ] The response either refunds or errors; it never returns an ungrounded answer as if grounded.
  - [ ] Test added: `src/__tests__/integration/chat-credit-refund.test.ts` (new case).
- **How to verify:** `bun run test -- src/__tests__/integration/chat-credit-refund.test.ts` and `src/__tests__/integration/chat-route-ordering.test.ts`.
- **Notes/risks:** `refundOnce` is idempotent by construction — confirm that before relying on it, because a double refund is worse than a missing one.

### T-007 · Refund the credit when the commit-summary LLM call fails
- [ ] **Status:** todo
- **Audit ref:** M3 (§6, §15 #7)
- **Severity:** High (money)
- **Effort:** S (<30m)
- **Depends on:** none
- **Files:** `src/features/dashboard/server/router/services/projectService.ts:602-615`, `src/lib/github/services/commits.ts:245,274`, `src/lib/credits.ts:58`
- **Problem:** `generateAiSummary` spends `COMMIT_SUMMARY_COST` at `:602` and then returns `getAiSummaryOfCommit(...)` at `:610` with no try/catch and no refund. `commits.ts:245` swallows LLM errors and returns an emoji fallback string (`:274`), so **the credit is kept even when the model call failed outright**. `credits.ts`'s own docstring says the refund helper was extracted "so a second metered path has a correct version to call" — the second path was added without the refund half.
- **What to do:**
  1. Detect the failure in `aISummariesCommit` and propagate it (or return a discriminated result) instead of returning a sentinel emoji string that is indistinguishable from a real summary.
  2. In `generateAiSummary`, wrap the call and refund on failure using the same helper the chat route uses.
  3. Do not refund when the model succeeds but returns a short/odd summary — only on failure.
  4. Add a unit test: provider throws → no credit spent, or spent-and-refunded; net balance unchanged.
- **Acceptance criteria:**
  - [ ] A failed summary call costs the user nothing.
  - [ ] A successful call costs exactly `COMMIT_SUMMARY_COST`.
  - [ ] The emoji fallback is gone or is clearly distinguishable and not billed as a success.
  - [ ] Test added: `src/__tests__/unit/credits-procedure.test.tsx` (extend) or a new `commit-summary-refund.test.ts`.
- **How to verify:** `bun run test -- src/__tests__/unit/credits-procedure.test.tsx src/__tests__/integration/chat-credit-refund.test.ts`; `bun run typecheck`.
- **Notes/risks:** T-006 and T-007 are separate PRs on purpose — they are different code paths and different tests. Do not bundle them.

### T-008 · Pin the bun version in CI from `packageManager`
- [ ] **Status:** todo
- **Audit ref:** M13 (§6, §13, §15 honourable)
- **Severity:** Low (build reproducibility)
- **Effort:** S (<30m)
- **Depends on:** none
- **Files:** `.github/workflows/ci.yml:58`, `package.json:100`
- **Problem:** CI runs `oven-sh/setup-bun@v2` with `bun-version: latest` while `package.json:100` pins `"packageManager": "bun@1.2.2"`. The pin is a comment. Builds are not reproducible, and a bun release can break CI without any commit to blame.
- **What to do:**
  1. Change `bun-version` to read from `package.json`. `oven-sh/setup-bun` supports `bun-version-file: package.json`; if the exact behaviour is uncertain, set the literal `1.2.2` and add a comment pointing at the `packageManager` field.
  2. If using `bun-version-file: package.json`, confirm it parses the `packageManager` field and not something else — verify with a real CI run, do not assume.
  3. Nothing else in the workflow changes.
- **Acceptance criteria:**
  - [ ] CI uses the version in `package.json:100`; bumping that field changes what CI installs.
  - [ ] No `latest` remains anywhere in the workflow.
  - [ ] Test added: none (CI config).
- **How to verify:** `git grep -n 'bun-version' .github/workflows/ci.yml`; then push a branch and read the setup-bun log line in the run.
- **Notes/risks:** The lockfile gate `--frozen-lockfile` is already correct — leave it alone.

### T-009 · Delete the two dead project API routes
- [ ] **Status:** todo
- **Audit ref:** M6 (§6, §15 #9)
- **Severity:** Medium (attack surface)
- **Effort:** S (<30m)
- **Depends on:** none
- **Files:** `app/api/project/getProjectCommits/route.ts`, `app/api/project/getProjectDetails/route.ts`, `src/__tests__/integration/proxy-allowlist.test.ts:79,80`, `docs/superpowers/specs/2026-08-05-auth-security-hardening-design.md:37,38`
- **Problem:** Both routes under `app/api/project/` have **zero production callers** — the only string hits are a test and a historical design doc. Neither imports `rate-limit.ts` (`rg "rateLimit|keys\." app/api/project/` returns nothing), so they are authenticated-but-unrated live attack surface duplicating tRPC procedures that already exist. `getProjectCommits` additionally uses the OFFSET pagination (`const offset = (page - 1) * limit;` at `:39`, `.limit(limit).offset(offset)` at `:49`) that keyset pagination replaced; `getProjectDetails` has no pagination at all.
- **What to do:**
  1. Delete both route files and the now-empty `app/api/project/` directory.
  2. Remove the two paths from the `PRIVATE` list in `proxy-allowlist.test.ts:79,80`, which is the only test that references them.
  3. Add a one-line note in the historical design doc pointing at the removal — do **not** rewrite history in `docs/superpowers/specs/`, just annotate.
  4. Do not replace them with redirects; the tRPC procedures are the supported surface.
- **Acceptance criteria:**
  - [ ] `app/api/project/` no longer exists; both paths 404.
  - [ ] No test references the deleted paths.
  - [ ] `proxy-allowlist.test.ts` still passes.
  - [ ] Test updated: `src/__tests__/integration/proxy-allowlist.test.ts`.
- **How to verify:** `bun run test -- src/__tests__/integration/proxy-allowlist.test.ts`; `bun run build`; `rg 'getProjectCommits/route|getProjectDetails/route' app src` returns nothing.
- **Notes/risks:** `getProjectCommits` is also the *name* of a live tRPC procedure (`projectService.ts:278`, router `project.ts:71`). Only the HTTP route is being deleted — do not touch the service method.

### T-010 · Defer the `GITHUB_TOKEN` requirement to first use
- [ ] **Status:** todo
- **Audit ref:** H5 (§5)
- **Severity:** High
- **Effort:** S (<30m)
- **Depends on:** none
- **Files:** `src/lib/github/client.ts:18-24`
- **Problem:** `client.ts:18-20` throws at **module evaluation** if `GITHUB_TOKEN` is unset, then `:22-24` exports a module-scope `octokit`. Because `projectService.ts` imports through `src/lib/github/index.ts`, the throw cascades to the project router and `_app.ts` — so a missing token 500s **every** tRPC call including chat, and can break `next build`. The fail-fast intent is right; module-load placement is wrong. `embeddings.ts` already models the correct shape by deferring into `getOpenRouterClient()`. CI papers over this with a placeholder token and an honest comment at `ci.yml:45-50` — known and worked around, not fixed.
- **What to do:**
  1. Remove the module-top-level `throw` and the module-scope `new Octokit`.
  2. Replace with a lazily-memoised factory that constructs the client on first call and throws a clear, actionable error there (same shape as `getOpenRouterClient`).
  3. Update the export so the single existing import surface (`github/index.ts` — note the audit's own praise that the Octokit client is deliberately **not** exported outside the barrel) keeps working.
  4. Update the now-inaccurate CI comment at `ci.yml:45-50`, and reconsider whether the placeholder token is still needed for build/test.
  5. Add a test: importing the module with no `GITHUB_TOKEN` does not throw; calling the accessor does, with a message naming the variable.
- **Acceptance criteria:**
  - [ ] `import "@/lib/github/client"` with no `GITHUB_TOKEN` succeeds.
  - [ ] Any GitHub call with no `GITHUB_TOKEN` fails with a named-variable error, not a 500 from an unrelated module.
  - [ ] The `github/index.ts` barrel remains the only import path for the rest of the app.
  - [ ] Test added: `src/__tests__/unit/github-client-lazy.test.ts` (new).
- **How to verify:** `bun run test -- src/__tests__/unit/github-client-lazy.test.ts`; `bun run typecheck`; `bun run build` with `GITHUB_TOKEN` unset (should still succeed).
- **Notes/risks:** Keep the fail-fast behaviour — the bug is *where* it fails, not *that* it fails. A lazy error that surfaces as a 500 in a tRPC procedure still needs mapping to a typed error; check the router's `errorFormatter` covers it.

### T-011 · Remove dead imports and the unused `baseProcedure` export
- [ ] **Status:** todo
- **Audit ref:** L4, L6 (§7, §16.8)
- **Severity:** Low
- **Effort:** S (<30m)
- **Depends on:** none
- **Files:** `app/api/chat/route.ts:11-12`, `src/lib/trpc/init.ts:61`
- **Problem:** Three imports in the chat route are dead: `usersTable` (grep count 1 — the import line itself), `gte` (count 1) and `sql` (count 1), while `eq` (6) and `and` (15) are live. Separately, `init.ts:61` exports `baseProcedure = t.procedure`, imported only by `init.ts:82` itself — zero external consumers. **Note:** the audit's L5 (`createCallerFactory`) is **not** in scope — it is imported by four test files and is legitimate test infrastructure, not dead code.
- **What to do:**
  1. Remove `usersTable`, `gte`, `sql` from the two import lines at `route.ts:11-12`.
  2. Remove the `baseProcedure` export at `init.ts:61` and point `init.ts:82` at `t.procedure` directly.
  3. Run lint to confirm no new unused-import warnings.
- **Acceptance criteria:**
  - [ ] `rg -c 'usersTable' app/api/chat/route.ts` returns 0 or the only remaining hit is a genuine use; same for `gte` and `sql`.
  - [ ] `bun run lint` is clean.
  - [ ] `bun run typecheck` passes.
  - [ ] Test added: none — deletion only; the existing 36-test suite covers the route.
- **How to verify:** `bun run lint && bun run typecheck && bun run test`.
- **Notes/risks:** Do not reformat these files beyond the deletions — `route.ts` is 675 lines and a reformat would bury the diff.

---

## Phase P1 — Before scaling

### T-012 · Record indexed-vs-total file counts during embedding finalize
- [ ] **Status:** todo
- **Audit ref:** M1 (part 1 of 2) (§6, §15 #8)
- **Severity:** Medium
- **Effort:** M (30-90m)
- **Depends on:** none
- **Files:** `src/lib/inngest/functions.ts:17,158-160,265,297`
- **Problem:** `MAX_EMBEDDING_FILES = 500` (`:17`) and the Prepare query orders `asc(length(code))` (`:158-160`) before limiting, so the **smallest 500 files win** and the largest are silently dropped. Finalize checks only `actualCount === 0` (`:265`) and `errors.length > 0` (`:297`) — it never compares the embedded count against the total `project_files` count. A repository where 5,000 of 8,000 files were indexed reports a green "completed" badge.
- **What to do:**
  1. In the Prepare step, `count(*)` the full `project_files` set for the project and carry both numbers (`total` and `selected`) into the Finalize step's event data.
  2. In Finalize, compute and store the truncation state. Add whatever the project status needs to express "indexed N of M" — this is schema work, so confirm the D-3 shape before writing columns.
  3. Keep the existing `actualCount === 0` and `errors.length > 0` branches; they are correct and must not regress.
  4. Do **not** change the ordering heuristic in this task — that is a D-3 decision, tracked in T-013 and the decision list.
  5. Add a test: a project with more files than the cap finishes with a truncation flag, not a "completed" status.
- **Acceptance criteria:**
  - [ ] A project whose file count exceeds `MAX_EMBEDDING_FILES` cannot finish with an unqualified "completed" status.
  - [ ] The finalize event carries the total and the embedded count.
  - [ ] Existing `inngest-embeddings.test.ts` cases still pass unchanged.
  - [ ] Test updated: `src/__tests__/unit/inngest-embeddings.test.ts`.
- **How to verify:** `bun run test -- src/__tests__/unit/inngest-embeddings.test.ts src/__tests__/unit/repo-size-limit.test.ts`; `bun run typecheck`.
- **Notes/risks:** T-012 is the data half and T-013 is the presentation half. They can land in either order; T-012 alone already removes the lie from the data layer.

### T-013 · Surface indexing truncation in the project UI
- [ ] **Status:** todo
- **Audit ref:** M1 (part 2 of 2) (§6, §15 #8)
- **Severity:** Medium
- **Effort:** S (<30m)
- **Depends on:** T-012, D-3
- **Files:** project detail page / indexing status component, `src/features/projects/`
- **Problem:** Even with T-012 recording the truth, the UI must tell the user. Today a partially-indexed repository shows the same "completed" affordance as a fully-indexed one, so users form false confidence in RAG answers that cannot see most of the codebase.
- **What to do:**
  1. Render the "indexed N of M files" state wherever the indexing status is displayed, using the values T-012 records.
  2. Per D-3, choose the presentation: a partial-index badge/warning, a hard failure, or a raised cap.
  3. Add a component test asserting the truncated state is distinguishable from the complete state — mirror the style of `file-tree-aria.test.tsx` / `project-tabs-aria.test.tsx`, which already defend UI invariants this way.
- **Acceptance criteria:**
  - [ ] A partially-indexed project is visually distinguishable from a fully-indexed one.
  - [ ] The user-facing copy does not claim completeness when files were dropped.
  - [ ] Test added: `src/__tests__/unit/embedding-status-truncation.test.tsx` (new).
- **How to verify:** `bun run test -- src/__tests__/unit/embedding-status-truncation.test.tsx`; manual — create a project against a repo with >500 files and inspect the status.
- **Notes/risks:** If D-3 lands on option (c) (raise/remove the cap), this task shrinks to nothing — check D-3 first.

### T-014 · Add `onFailure` handlers to `projectCreated` and `cleanupStaleData`
- [ ] **Status:** todo
- **Audit ref:** M16 (+ newly noticed: `cleanupStaleData`) (§6, §16.11)
- **Severity:** Medium
- **Effort:** S (<30m)
- **Depends on:** none
- **Files:** `src/lib/inngest/functions.ts:24-29,89-106,353-356`
- **Problem:** `projectCreated` (`:24`) has no `onFailure`. A permanent file-import failure leaves the project stranded at `embeddingStatus: 'pending'` forever — no error, no user-facing explanation, no retry signal. `generateEmbeddings` already does this correctly at `:89-106` and is the template. **`cleanupStaleData` (`:353`) has the same gap** — the audit only flagged `projectCreated`.
- **What to do:**
  1. Copy the `onFailure` handler from `generateEmbeddings` (`:89-106`) onto `projectCreated`, and make sure it sets the project's status to `failed` with the error recorded.
  2. Add the same shape to `cleanupStaleData` so a failed retention sweep alerts instead of silently not running — this is exactly the class of failure C1 and M15 are about.
  3. Add a test per function: an event that exhausts retries flips the status.
- **Acceptance criteria:**
  - [ ] A permanently failing `projectCreated` moves the project out of `pending` into `failed` with a recorded reason.
  - [ ] A failing `cleanupStaleData` produces an observable error.
  - [ ] Test updated: `src/__tests__/unit/inngest-embeddings.test.ts` (add cases for both).
- **How to verify:** `bun run test -- src/__tests__/unit/inngest-embeddings.test.ts`; `bun run typecheck`.
- **Notes/risks:** Use the existing handler verbatim rather than inventing a second error-reporting path.

### T-015 · Sanitise tar entry names
- [ ] **Status:** todo
- **Audit ref:** M24 (§6, §15 top-10 adjacent)
- **Severity:** Medium
- **Effort:** S (<30m)
- **Depends on:** T-004
- **Files:** `src/lib/github/services/files.ts:142,185`
- **Problem:** `:142` computes `const cleanPath = header.name.split("/").slice(1).join("/")` and `:185` stores it as `fileName`. Stripping one leading segment is not sanitisation: `..` segments survive. There is no filesystem write, so this is **not** a traversal *write*, but traversal-looking names are persisted, rendered in the file tree, and re-emitted as RAG citations — where an attacker-controlled repo can put text into the AI's context.
- **What to do:**
  1. After the existing `split("/").slice(1)`, resolve and validate the remaining path: reject or drop any entry that still contains a `..` segment.
  2. Consider skipping symlink/hardlink entry types too — the current guard is only `header.type !== "file"`, so confirm what the tar parser actually exposes and guard on what is available.
  3. Add a test in the tarball test file created by T-004: a `../` entry name is dropped, not stored.
- **Acceptance criteria:**
  - [ ] No stored `fileName` contains a `..` segment.
  - [ ] A malicious tar entry is skipped and counted as an error rather than persisted.
  - [ ] Test added: `src/__tests__/unit/github-tarball-stream.test.ts` (extend T-004's file).
- **How to verify:** `bun run test -- src/__tests__/unit/github-tarball-stream.test.ts`; `bun run typecheck`.
- **Notes/risks:** Depends on T-004 only for file access, not logic — if T-004 has not landed, create the test file here and let both merge into it.

### T-016 · Add secret-file patterns to the ingestion ignore list
- [ ] **Status:** todo
- **Audit ref:** M23 (§6, §16.17)
- **Severity:** High
- **Effort:** S (<30m)
- **Depends on:** none
- **Files:** `src/lib/github/constants.ts:84-116`
- **Problem:** `IGNORED_FILE_PATTERNS` has 32 entries and correctly skips `.env*` (`:105`), `node_modules/`, fonts and `.pyc`. But `.pem`, `.key`, `.p12`, `id_rsa`, `.npmrc`, `.netrc`, `credentials`, `*.tfvars` are **not** skipped. A repository with committed secrets gets them ingested into the Postgres database *and* into the embedding vector store, where they are retrievable through RAG and reproducible as citations.
- **What to do:**
  1. Add patterns for: `.pem`, `.key`, `.p12`/`.pfx`, `id_rsa`/`id_dsa`/`id_ecdsa`/`id_ed25519`, `.npmrc`, `.netrc`, `credentials`, `*.tfvars`, and `.git/`.
  2. Keep them as regexes in the existing array, matching the file's style and comment conventions.
  3. Add a test with a representative filename list asserting each is ignored — `rag-ingestion.test.ts` is the natural home.
- **Acceptance criteria:**
  - [ ] Every listed secret-bearing filename is excluded from ingestion.
  - [ ] `.env*` and the existing 32 patterns still behave identically.
  - [ ] Test added or updated: `src/__tests__/unit/rag-ingestion.test.ts`.
- **How to verify:** `bun run test -- src/__tests__/unit/rag-ingestion.test.ts`; `bun run typecheck`.
- **Notes/risks:** This is defence-in-depth, not a substitute for a secret scanner. Do not add `*.key` style patterns so broad that legitimate source files get dropped — e.g. `something.keyboard.ts` must survive.

### T-017 · Pin the Gemini model instead of the floating alias
- [ ] **Status:** todo
- **Audit ref:** §16.18 (Reliability — not in the numbered findings)
- **Severity:** Medium
- **Effort:** S (<30m)
- **Depends on:** none
- **Files:** `src/lib/gemini.ts` (`LLM_SETTINGS` model field), `src/lib/github/services/commits.ts:245`
- **Problem:** The model is referenced through the floating `gemini-flash-latest` alias. Behaviour can change under you with no deploy, no commit, and no changelog entry — a prompt tweak or a new safety filter lands in production overnight.
- **What to do:**
  1. Pin a concrete model id in `LLM_SETTINGS` (e.g. an explicit `-001`/dated snapshot) rather than the `-latest` alias.
  2. Record the reason in a comment, matching how `vector-search.ts` and `embeddings.ts` document their measured choices.
  3. If you want an upgrade path, note in the comment which alias to switch back to when re-validating.
- **Acceptance criteria:**
  - [ ] No `-latest` model alias remains in the LLM call path.
  - [ ] The pinned id is documented in a comment with its reason.
  - [ ] Test added: none (a constant change); existing LLM-path tests must pass.
- **How to verify:** `rg 'gemini.*-latest' src/` returns nothing; `bun run test`.
- **Notes/risks:** Pinning means no automatic upstream improvements. That is the point — schedule a deliberate re-validation, and do not let the alias creep back in.

### T-018 · Enqueue the Inngest event after the credit spend
- [ ] **Status:** todo
- **Audit ref:** M17 (§6 — not scheduled in §16)
- **Severity:** Medium
- **Effort:** S (<30m)
- **Depends on:** D-11
- **Files:** `src/features/dashboard/server/router/services/projectService.ts:113-120,123,137-146,161`
- **Problem:** The order inside `createProject` is inverted: the Inngest `project/created` event is sent at `:137-146` **before** the atomic `spendCredits(userId, PROJECT_CREATION_COST)` at `:161`, and before the `currentCredits < 10` FORBIDDEN check at `:113-120` has any effect. A worker can pick up an event for a project row that a failed charge then invalidates.
- **What to do:**
  1. Move `inngest.send({ name: "project/created", … })` to **after** the `spendCredits` call succeeds.
  2. Re-examine what a failure between the project INSERT (`:123` → `github/services/project.ts:111`) and the enqueue now leaves behind, and make that state explicit rather than silent. Under D-11 option (a) (`neon-http`, no transactions) there is no atomic option — a compensating delete or a documented "pending" state is the answer.
  3. Add a test: when the credit spend fails, no Inngest event is enqueued.
- **Acceptance criteria:**
  - [ ] `inngest.send` is unreachable when `spendCredits` throws.
  - [ ] A failed creation leaves no orphaned project row and no orphaned event.
  - [ ] Test added or updated: `src/__tests__/unit/use-create-project.test.tsx` or a new `create-project-ordering.test.ts`.
- **How to verify:** `bun run test -- src/__tests__/unit/use-create-project.test.tsx`; `bun run typecheck`.
- **Notes/risks:** D-11 decides whether this is a two-line reorder or a compensating-transaction design. Resolve D-11 first — under a pooled driver the correct fix is a real transaction and the rest of the task disappears.

### T-019 · Add redaction to the logger
- [ ] **Status:** todo
- **Audit ref:** M20 (part 1 of 2) (§6, §16.14)
- **Severity:** High
- **Effort:** M (30-90m)
- **Depends on:** none
- **Files:** `src/lib/logger.ts:11-61,34,41-43`, `src/__tests__/unit/logger.test.ts`
- **Problem:** The logger is console-only structured JSON with **no redaction of any kind**. `error(message, error?, context?)` at `:34` serialises `{ name, message, stack }` verbatim at `:41-43`. A call like `logger.error("Chat API error", error)` therefore prints whatever the upstream provider returned — which can include prompt content, repository file names, and provider error bodies containing user data. There is no transport yet (T-020), so today this only leaks into platform logs; the moment an aggregator is attached, it leaks into a third-party index.
- **What to do:**
  1. Add a redaction pass inside `logger` (not at call sites) that scrubs a denylist of keys — `token`, `secret`, `password`, `authorization`, `cookie`, `api_key`, `email` — and truncates over-long `message`/`stack` fields.
  2. Apply it on **all** four levels (`log`, `warn`, `error`, `debug`), not just `error`.
  3. Make redaction deep enough to walk the `context` object, which is where request-shaped data tends to land.
  4. Add tests to the existing `logger.test.ts` covering: a denylisted key is masked, a long string is truncated, nested context is scrubbed, and a normal message is untouched (do not redact everything into uselessness).
- **Acceptance criteria:**
  - [ ] No denylisted key's value appears in any logger output.
  - [ ] Redaction applies to `context` and to errors, at every level.
  - [ ] Non-sensitive messages pass through unmodified.
  - [ ] Test updated: `src/__tests__/unit/logger.test.ts`.
- **How to verify:** `bun run test -- src/__tests__/unit/logger.test.ts`; `bun run typecheck`.
- **Notes/risks:** Keep the denylist a named constant with a comment explaining the threat — this file's value depends on being self-explanatory, like the rest of the codebase's comments.

### T-020 · Add an error-tracking transport
- [ ] **Status:** todo
- **Audit ref:** M20 (part 2 of 2) (§6, §13, §16.14)
- **Severity:** High
- **Effort:** M (30-90m)
- **Depends on:** D-4, T-019
- **Files:** `src/lib/logger.ts:11-61`
- **Problem:** `logger` writes to the console and nothing else. There is no error tracking, so nothing aggregates, alerts, groups, or retains. The `RequestTracer` records per-stage latencies and logs them, but **nothing reads them** — APM is traced and discarded. This is one of the three ❌ marks in the audit's production-readiness table.
- **What to do:**
  1. Implement the D-4 transport behind an environment flag so local development and CI keep console-only output.
  2. Route `logger.error` (and `warn`, per the D-4 decision) to the transport; keep `log`/`debug` console-only unless the decision says otherwise.
  3. Ship release/environment tagging and source-map upload so stack traces are readable.
  4. Add a trace-aggregation surface for the `RequestTracer` output, or explicitly document why not.
- **Acceptance criteria:**
  - [ ] Errors reach a queryable, alerting destination in production.
  - [ ] With the transport disabled (local/CI), behaviour is exactly as today.
  - [ ] T-019's redaction is applied on the transport path, not bypassed by it.
  - [ ] Test added or updated: `src/__tests__/unit/logger.test.ts` (transport-disabled behaviour stays covered).
- **How to verify:** `bun run test -- src/__tests__/unit/logger.test.ts`; deploy to a preview and trigger a logged error, then confirm it appears in the aggregator with a readable stack.
- **Notes/risks:** This introduces a data processor and possibly a vendor. Review the D-4 choice against the retention policy in `docs/operations/backup-retention.md` — a second place where prompt/customer data can accumulate.

### T-021 · Ship a Content-Security-Policy in report-only mode
- [ ] **Status:** todo
- **Audit ref:** M19 (part 1 of 2) (§6, §16.15)
- **Severity:** Medium
- **Effort:** M (30-90m)
- **Depends on:** D-5
- **Files:** `next.config.ts:45-77`
- **Problem:** `next.config.ts` sets exactly six security headers (`X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Strict-Transport-Security`, `Permissions-Policy`) and **no CSP**. The XSS surface itself is verified closed (Shiki + explicit `escapeHtml()` at `code-panel.tsx:257`; `chat-message.tsx` uses `ReactMarkdown` **without** `rehype-raw`), so a CSP is defence-in-depth, not a patch for a live hole.
- **What to do:**
  1. Per D-5, write the policy with the chosen nonce/hash strategy and the enumerated third-party origins (Clerk, OpenRouter, Inngest, Vercel).
  2. Ship it as `Content-Security-Policy-Report-Only` first, with a `report-to`/`report-uri` endpoint.
  3. Add a minimal report-collector route so violations are observable rather than invisible.
- **Acceptance criteria:**
  - [ ] A report-only CSP is served on all routes.
  - [ ] Violations are collected somewhere queryable.
  - [ ] No pre-existing feature is broken by the policy (verify chat streaming, Shiki highlighting, Clerk widgets, Inngest dev server).
  - [ ] Test added: `src/__tests__/integration/security-headers.test.ts` (extend).
- **How to verify:** `bun run test -- src/__tests__/integration/security-headers.test.ts`; `curl -sI http://localhost:3000 | rg -i content-security-policy`; exercise the app and read the violation log.
- **Notes/risks:** `X-XSS-Protection` (T-052) is obsolete and can be dropped in the same PR — one header block, one review.

### T-022 · Enforce the Content-Security-Policy
- [ ] **Status:** todo
- **Audit ref:** M19 (part 2 of 2) (§6, §16.15)
- **Severity:** Medium
- **Effort:** S (<30m)
- **Depends on:** T-021
- **Files:** `next.config.ts:45-77`
- **Problem:** Report-only catches nothing until it is enforced. A report-only CSP that is never promoted is documentation, not a control.
- **What to do:**
  1. Review the T-021 violation report and close every legitimate gap.
  2. Switch the header to enforcing `Content-Security-Policy`.
  3. Keep the report-only header alongside it (a second, relaxed policy) so new violations stay visible without breaking users.
  4. Update the `security-headers.test.ts` assertion to check the enforcing header.
- **Acceptance criteria:**
  - [ ] `Content-Security-Policy` (enforcing) is present; `Content-Security-Policy-Report-Only` also remains.
  - [ ] Zero known-blocking violations remain.
  - [ ] Test updated: `src/__tests__/integration/security-headers.test.ts`.
- **How to verify:** `bun run test -- src/__tests__/integration/security-headers.test.ts`; manual pass over chat streaming, code viewer, sign-in, project creation.
- **Notes/risks:** Do not skip this task. A report-only policy left in place indefinitely is the same as no policy plus extra config.

### T-023 · Implement the orphan-embedding retention sweep
- [ ] **Status:** todo
- **Audit ref:** M15 (option a) (§6, §16.16/28)
- **Severity:** Medium
- **Effort:** M (30-90m)
- **Depends on:** D-6 (choose this over T-024)
- **Files:** `src/lib/inngest/functions.ts:353-356`
- **Problem:** `docs/operations/backup-retention.md:37` promises `| **Orphan Code Embeddings** | 30 Days | Inngest RAG Pipeline | Deleted upon project re-indexing or manual project deletion |`. The only cron is `cleanupStaleData` (`"0 3 * * *"` at `:356`) and it purges **only** `rate_limits`. The documented policy is not implemented.
- **What to do:**
  1. Extend `cleanupStaleData` (or add a second cron in the same file) to delete embedding rows whose parent project or parent `project_files` row is gone, older than 30 days.
  2. Add the `onFailure` handler that T-014 adds, so a failed sweep is visible.
  3. Add a test that seeds an orphan row and asserts the sweep removes it while leaving a live row intact.
  4. Re-read `backup-retention.md:37` and make sure the row now describes what actually runs.
- **Acceptance criteria:**
  - [ ] Orphan embeddings older than 30 days are deleted by a scheduled job.
  - [ ] Live embeddings are never deleted.
  - [ ] A failing sweep is observable.
  - [ ] Test added: `src/__tests__/unit/inngest-embeddings.test.ts` (or a new `retention-sweep.test.ts`).
- **How to verify:** `bun run test`; manual — `bun run inngest` dev server, trigger the cron, confirm the row count drops.
- **Notes/risks:** Run this **or** T-024, never both. Deleting rows is irreversible; verify the join condition deletes only genuine orphans and re-read the query twice before shipping.

### T-024 · Correct the retention doc to match what runs
- [ ] **Status:** todo
- **Audit ref:** M15 (option b) (§6, §16.16/28)
- **Severity:** Low
- **Effort:** S (<30m)
- **Depends on:** D-6 (choose this over T-023)
- **Files:** `docs/operations/backup-retention.md:37`
- **Problem:** Same root cause as T-023: the doc claims a 30-day orphan-embedding sweep by the "Inngest RAG Pipeline" that does not exist. If D-6 chooses not to build the sweep, the doc must stop claiming it. A retention policy that describes unimplemented behaviour is worse than no policy — it makes an auditor believe a control exists.
- **What to do:**
  1. Edit the retention table row to describe actual behaviour: embeddings are removed on project deletion and on re-index, and there is no time-based orphan sweep.
  2. If time-based cleanup is wanted later, leave a short note pointing at the decision, not a promise.
  3. Nothing else in the doc changes (the `npm`→`bun` fix is T-001's job).
- **Acceptance criteria:**
  - [ ] Every row in the retention table corresponds to code that exists.
  - [ ] No row describes an unimplemented sweep.
  - [ ] Test added: none (documentation).
- **How to verify:** read `docs/operations/backup-retention.md` against `src/lib/inngest/functions.ts` and confirm each row.
- **Notes/risks:** Run this **or** T-023. T-060 also touches this file — sequence them, do not open both PRs at once.

### T-025 · Add the AI issue-triage Inngest function
- [ ] **Status:** todo
- **Audit ref:** H2 (part 1 of 3) (§5, §15 #5)
- **Severity:** High
- **Effort:** M (30-90m)
- **Depends on:** D-2 (option a)
- **Files:** `src/lib/inngest/functions.ts`, `app/api/inngest/route.ts:11`
- **Problem:** `db/schema.ts` defines `issues.aiSummary`/`aiComplexity`/`aiTags`, and the UI reads them (`projectService.ts:775-776` `// ← new: severity badge`, `:826-828` `// ← new: chip labels`). The **only** writer in the repository is `src/lib/github/services/issues.ts:65-67`, writing literal `null as …` under `// ── AI Triage (deferred — a Gemini background job fills these in) ──`. That job was never written. So the issues UI advertises a capability that can never render a value. The commit-summary path proves the pattern works: `commits.ts:245-258` calls the LLM and persists `AiSummary`.
- **What to do:**
  1. Add a `triageIssues` Inngest function, modelled on `generateEmbeddings` (`functions.ts:68`) for batching, concurrency and `onFailure` shape.
  2. It takes `issueId` (or a batch), reads the issue title/body/comments, and calls the LLM to produce `aiSummary`, `aiComplexity` (a fixed enum — define it) and `aiTags`.
  3. Register it in `app/api/inngest/route.ts:11`, which currently serves only `projectCreated`, `generateEmbeddings`, `cleanupStaleData`.
  4. Persist the results; the columns already exist, so **no migration is needed**.
  5. Reuse the existing LLM client accessor (the same one T-010/T-017 touch) and the `LLM_SETTINGS` model that T-017 pins.
- **Acceptance criteria:**
  - [ ] An issue row can acquire non-null `aiSummary`, `aiComplexity` and `aiTags` from the function.
  - [ ] The function is registered with the Inngest handler.
  - [ ] A failing triage is observable (add the T-014 `onFailure` shape).
  - [ ] `aiComplexity` values come from a closed, typed set, not free text.
  - [ ] Test added: `src/__tests__/unit/inngest-issues-triage.test.ts` (new).
- **How to verify:** `bun run test -- src/__tests__/unit/inngest-issues-triage.test.ts`; `bun run inngest` dev server and send a `issues/triage` event; `bun run typecheck`.
- **Notes/risks:** This is a metered LLM path — decide the credit cost and the `onFailure` behaviour before writing it, and reuse the refund discipline from T-007. T-026 and T-027 depend on this.

### T-026 · Trigger triage on issue sync and confirm persistence
- [ ] **Status:** todo
- **Audit ref:** H2 (part 2 of 3) (§5, §15 #5)
- **Severity:** High
- **Effort:** S (<30m)
- **Depends on:** T-025
- **Files:** `src/lib/github/services/issues.ts:49-99`, `src/features/dashboard/server/router/services/projectService.ts:242-276`
- **Problem:** Even with T-025 in place, nothing would call it. `syncIssues` (`projectService.ts:242`) deletes all issues (`:258`) and the batched insert loop at `services/issues.ts:49-99` writes `null as …` for the three AI columns (`:65-67`). Without a trigger, the function sits idle and the columns stay null forever.
- **What to do:**
  1. Emit `issues/triage` per newly-inserted issue, or one batch event per sync, from the insert path in `services/issues.ts`.
  2. Prefer a single batch event over per-issue events — 2,000 issues is the cap, and per-issue events would be 2,000 Inngest runs.
  3. Decide what happens to the `null as` casts in the insert: either they stay (triage fills them later) or they go (triage owns the write). Do not leave two writers.
  4. Add a test: after a sync, triage events are enqueued for the inserted issues.
- **Acceptance criteria:**
  - [ ] A completed `syncIssues` enqueues triage for every inserted issue.
  - [ ] Exactly one writer owns each AI column.
  - [ ] Test added: `src/__tests__/unit/inngest-issues-triage.test.ts` (extend T-025's file).
- **How to verify:** `bun run test -- src/__tests__/unit/inngest-issues-triage.test.ts`; manual — sync a repo in the Inngest dev server and watch the event stream.
- **Notes/risks:** Watch the 2,000 issue/PR cap (M5) — a batch event payload above the Inngest event-size limit will fail. Chunk the batch.

### T-027 · Render the triage result in the issues UI
- [ ] **Status:** todo
- **Audit ref:** H2 (part 3 of 3) (§5, §15 #5)
- **Severity:** Medium
- **Effort:** S (<30m)
- **Depends on:** T-026
- **Files:** `src/features/dashboard/` issue components, `src/features/dashboard/server/router/project.ts:140,152`
- **Problem:** The readers exist and are already exposed through tRPC (`project.ts:140` `getNeedsAttention`, `:152` `getProjectIssues`), but the values were always null, so whatever badge/chip rendering was built for them was never exercised against real data. T-026 alone does not make the feature visible.
- **What to do:**
  1. Confirm the severity badge and tag chips actually render from `aiComplexity`/`aiTags`, and handle the null case (a pending triage) distinctly from "no AI data" — the project may simply not be triaged yet.
  2. Add `complexity` to the `aiComplexity` enum a designer can actually distinguish (the D-2 call includes how many levels).
  3. Add a component test with a triaged issue, an untriaged issue, and a null issue.
- **Acceptance criteria:**
  - [ ] A triaged issue shows its summary/complexity/tags in the UI.
  - [ ] An untriaged issue shows a neutral state, not an empty badge.
  - [ ] Test added: `src/__tests__/unit/issue-triage-ui.test.tsx` (new).
- **How to verify:** `bun run test -- src/__tests__/unit/issue-triage-ui.test.tsx`; manual — sync a repo with open issues and inspect the issues panel.
- **Notes/risks:** This is the step that makes the audit's "honesty bug" honest in the other direction. If the rendering was never finished, this task is larger than S — re-estimate after T-026 lands.

### T-028 · Remove the AI issue-triage affordance (alternative to T-025→T-027)
- [ ] **Status:** todo
- **Audit ref:** H2 (alternative) (§5, §15 #5)
- **Severity:** High
- **Effort:** M (30-90m)
- **Depends on:** D-2 (option b) — **mutually exclusive with T-025, T-026, T-027**
- **Files:** `src/features/dashboard/server/router/services/projectService.ts:775-776,826-828`, `src/features/dashboard/server/router/project.ts:140,152`, `src/features/dashboard/` issue components, `src/lib/github/services/issues.ts:65-67`, `db/schema.ts:279-283`
- **Problem:** The alternative to building the feature: stop claiming it. The UI reads three columns that can never be non-null, and the insert writes a `null as` cast under a comment describing a job that does not exist. The audit is explicit that leaving it as-is is the worst option.
- **What to do:**
  1. Remove the severity badge and the chip-label reads from `projectService.ts:775-776` and `:826-828`, and from the tRPC output types in `project.ts:140,152`.
  2. Remove the `null as` casts and the misleading comment in `services/issues.ts:65-67`.
  3. Remove the rendering components if they only exist for this.
  4. Decide on the columns: dropping `aiSummary`/`aiComplexity`/`aiTags` from `db/schema.ts` requires a migration + `.notes.md` following the convention of the existing three. **Leaving the columns in place is acceptable** — unused nullable columns cost nothing, and a migration is real risk for zero user-visible gain. Recommend leaving them.
  5. Add a test asserting the tRPC issue payloads no longer contain the AI fields.
- **Acceptance criteria:**
  - [ ] No UI affordance advertises AI triage.
  - [ ] The `null as` casts and the deferred-job comment are gone.
  - [ ] No lying comment remains in the insert path.
  - [ ] Test added or updated: `src/__tests__/unit/issue-comments-ownership.test.ts` is unrelated — add `src/__tests__/unit/project-issues-shape.test.ts` (new).
- **How to verify:** `bun run test`; `rg 'aiSummary|aiComplexity|aiTags' src/features src/lib` shows no UI reads; `bun run typecheck`.
- **Notes/risks:** Pick T-025 or T-028, not both, and not neither. If you pick T-028, T-025/T-026/T-027 stay `cancelled`.

### T-029 · Baseline and inventory the dashboard's seven Neon round-trips
- [ ] **Status:** todo
- **Audit ref:** §10.1 (Performance — §16.12) (§16.12)
- **Severity:** Medium
- **Effort:** S (<30m)
- **Depends on:** none
- **Files:** `src/features/dashboard/server/router/services/projectService.ts:500-529` (`getDashboardData`, `Promise.all` at `:509`)
- **Problem:** `getDashboardData` fans out to **7 independent service calls** via `Promise.all` at `:509`. On the `neon-http` driver every `db.select()` is a separate stateless HTTP request, so that is 7 network hops per dashboard load — the single largest remaining structural cost in the app. Before merging queries you need to know which of the seven actually cost anything, and the fix is too big for one PR without that.
- **What to do:**
  1. Add temporary per-call timing (reuse the existing `RequestTracer` if it fits) around each of the seven calls, and capture a real dashboard load.
  2. Record the numbers in a comment block at `projectService.ts:500` — the same "measured, not assumed" convention `vector-search.ts` already uses.
  3. Group the seven calls by the table(s) each one touches, so T-030 knows which are mergeable into a single query and which are not.
  4. Remove or gate the instrumentation before merging if it would be noisy in production; a debug-only flag is fine.
- **Acceptance criteria:**
  - [ ] Each of the seven calls has a measured round-trip figure recorded in a code comment.
  - [ ] The calls are grouped by table with a note on which are mergeable.
  - [ ] No behaviour change.
  - [ ] Test added: none (measurement only).
- **How to verify:** `bun run dev`, load `/dashboard`, read the trace output; `bun run test` to confirm no regression.
- **Notes/risks:** Do not skip this. `getAllProjects`/`getDashboardInfo` already carry `PERF FIX` comments from prior work ("10,000 row reads → 10 row reads") — follow that precedent rather than merging blind.

### T-030 · Consolidate the dashboard queries to at most three round-trips
- [ ] **Status:** todo
- **Audit ref:** §10.1 (Performance — §16.12) (§16.12)
- **Severity:** Medium
- **Effort:** M (30-90m)
- **Depends on:** T-029
- **Files:** `src/features/dashboard/server/router/services/projectService.ts:500-529`
- **Problem:** Even with measurements in hand, the seven `Promise.all` calls are 7 round-trips per dashboard load. T-029 identifies which are mergeable.
- **What to do:**
  1. Merge the mergeable calls from T-029's inventory into wide queries (one `select` with joins where a single row-shape serves several consumers).
  2. Target ≤3 round-trips for the whole dashboard, matching T-029's measurement so the improvement is provable, not asserted.
  3. Preserve the existing `PERF FIX` invariants: `getAllProjects` and `getDashboardInfo` must not regress into unbounded reads, and `getProjectFiles` must keep returning only `{id, fileName}` (the comment says it prevents 10MB+ payloads).
  4. Add/extend a test asserting the returned shape is unchanged — this is a pure refactor and the payload is the contract.
- **Acceptance criteria:**
  - [ ] Dashboard load makes ≤3 Neon round-trips (measured, and recorded in a comment).
  - [ ] The tRPC dashboard payload is byte-for-byte shape-compatible.
  - [ ] `bun run typecheck` passes with no new `any`.
  - [ ] Test updated: `src/__tests__/unit/dashboard-project-list.test.tsx`.
- **How to verify:** `bun run test -- src/__tests__/unit/dashboard-project-list.test.tsx`; re-run the T-029 instrumentation and compare the numbers in the comment.
- **Notes/risks:** Under D-11 option (a) (`neon-http`) round-trips are the real cost. If D-11 lands on a pooled driver, re-measure before doing this work — the bottleneck may move.

### T-031 · Remove the per-load commit-chart scan
- [ ] **Status:** todo
- **Audit ref:** §10.2 (Performance) (§16.12 adjacent)
- **Severity:** Medium
- **Effort:** M (30-90m)
- **Depends on:** none
- **Files:** `src/features/dashboard/server/router/services/projectService.ts:551-574` (`getCommitChart`)
- **Problem:** `getCommitChart` groups with `date_trunc('day', authorDate)::date::text … GROUP BY`. **No index can serve a grouping on an expression**, so every dashboard load scans the user's commits rather than reading a narrow slice. Second-largest remaining dashboard cost after the round-trips.
- **What to do:**
  1. Pick one: (a) add a generated/stored `authorDate::date` column and index it, then group on that; or (b) precompute a daily rollup table maintained on commit insert.
  2. Option (a) is a migration (follow the `db/migrations/*.notes.md` convention); option (b) is new write-path work. Recommend (a) for a codebase this size.
  3. Add an index that actually serves the chosen grouping, and verify with `EXPLAIN` that the scan is gone.
  4. Add a regression test that would catch a return to a full scan — the codebase's convention is to document the measurement.
- **Acceptance criteria:**
  - [ ] The dashboard chart no longer scans all of a user's commits; `EXPLAIN` output is recorded in a comment.
  - [ ] Chart output is unchanged for existing data.
  - [ ] Test added: extend `src/__tests__/integration/credits-check-and-indexes.test.ts` (it already runs against a real pgvector container, so index assertions are real there).
- **How to verify:** `bun run test -- src/__tests__/integration/credits-check-and-indexes.test.ts`; run the `EXPLAIN ANALYZE` in the test Postgres and paste the result into the code comment.
- **Notes/risks:** This one is not in the audit's numbered findings — it is §10's second bottleneck and belongs with §16.12. Grouping correctness matters more than speed here: a wrong chart is worse than a slow one, so assert on output in the test.

### T-032 · Add a `webServer` block to the Playwright config
- [ ] **Status:** todo
- **Audit ref:** M14 (part 1 of 5) (§6, §12, §16.13)
- **Severity:** Medium
- **Effort:** S (<30m)
- **Depends on:** none
- **Files:** `playwright.config.ts:3-20`
- **Problem:** The config sets `baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || "http://localhost:3000"` and has **no `webServer` block**, so `bun run test:e2e` assumes something is already running. It is not self-contained: a fresh clone runs `bun run test:e2e` and gets connection-refused, which is how an E2E suite quietly stops being run at all.
- **What to do:**
  1. Add a `webServer` block that runs `bun run dev` (or `bun run start` after a build — decide which, and say why in a comment) on the baseURL port, with `reuseExistingServer` set for local iterations.
  2. Ensure the app has the env it needs to boot without a real GitHub token — note T-010 makes the missing token non-fatal at module load, which this task depends on.
  3. Verify `bun run test:e2e` works from a cold start with no server running.
- **Acceptance criteria:**
  - [ ] `bun run test:e2e` from a cold start boots the app and passes with no manual setup.
  - [ ] The existing `e2e/smoke.spec.ts` title test still passes.
  - [ ] Test added: none — the existing smoke test is the check.
- **How to verify:** kill any dev server, then `bun run test:e2e`.
- **Notes/risks:** `dev` is slow to boot but catches more problems; `start` needs a prior `bun run build`. If T-010 has not landed, the server will not boot without a placeholder token — sequence after T-010.

### T-033 · Add Clerk authentication state for E2E
- [ ] **Status:** todo
- **Audit ref:** M14 (part 2 of 5) (§6, §12, §16.13)
- **Severity:** Medium
- **Effort:** M (30-90m)
- **Depends on:** T-032
- **Files:** `e2e/` (new setup file), `playwright.config.ts`
- **Problem:** The entire product sits behind Clerk. There is **no** authenticated E2E test at all — nothing covers sign-in → create project → chat round-trip → embedding polling. Without a reusable auth fixture, the authenticated tests in T-034 and T-035 cannot be written.
- **What to do:**
  1. Create a Playwright global-setup that produces a `storageState` JSON for a dedicated test user, so the session is created once rather than per test.
  2. Wire it into `playwright.config.ts` via `globalSetup` + `use.storageState`.
  3. Use a test-only Clerk user and keep its credentials in CI secrets, not in the repo. Do not add a bypass header or a dev-only auth escape hatch to the app to make this easier — that would create a permanent authentication hole for a test convenience.
  4. Document the required secret in the README env list (which T-061 also touches — sequence them).
- **Acceptance criteria:**
  - [ ] A single `globalSetup` produces reusable auth state for authenticated specs.
  - [ ] No authentication bypass exists in application code.
  - [ ] The test user is provisioned from secrets, not committed.
  - [ ] Test added: a spec that asserts an authenticated page loads with `storageState` and redirects to sign-in without it.
- **How to verify:** `bun run test:e2e` locally with a real test user; then unset the storage state and confirm the redirect.
- **Notes/risks:** **Security:** the temptation to add a `NODE_ENV=test` auth bypass in `proxy.ts` is the one thing that must not happen here. If Clerk cannot be made to work in CI, the answer is a dedicated test instance, not a hole in the middleware.

### T-034 · Add an authenticated dashboard E2E test
- [ ] **Status:** todo
- **Audit ref:** M14 (part 3 of 5) (§6, §15 #10, §16.13)
- **Severity:** High
- **Effort:** M (30-90m)
- **Depends on:** T-033
- **Files:** `e2e/dashboard.spec.ts` (new)
- **Problem:** This is the test that would have caught H1. The dashboard's "Pick up where you left off" cards linked to `/projects/...` for months and 36 unit/integration tests never noticed, because the card hrefs were never followed.
- **What to do:**
  1. Seed a project and a chat for the test user, then load `/dashboard` and **follow every card** — assert each lands on a real page, not a 404.
  2. Assert the dead-href regression specifically: no anchor on the dashboard may point at `/projects/`.
  3. Keep the assertions structural (route exists, expected content present) rather than snapshot-based, so they do not churn.
- **Acceptance criteria:**
  - [ ] Every "Pick up where you left off" card navigates successfully.
  - [ ] Reverting T-003 makes this test fail.
  - [ ] Test added: `e2e/dashboard.spec.ts` (new).
- **How to verify:** `bun run test:e2e`; then temporarily revert T-003 and confirm the test goes red.
- **Notes/risks:** The revert-check is the whole point of this task. A test that passes on the broken code is worse than no test.

### T-035 · Add a project-creation and chat round-trip E2E test
- [ ] **Status:** todo
- **Audit ref:** M14 (part 4 of 5) (§6, §12, §16.13)
- **Severity:** High
- **Effort:** L (>90m — split if it does not fit one session)
- **Depends on:** T-033
- **Files:** `e2e/project-chat.spec.ts` (new)
- **Problem:** The core user journey has no end-to-end coverage: create a project, watch the embedding status resolve, ask a chat question, get an answer. The pieces are all unit-tested in isolation; the seam between them is not. This seam is exactly where M2 (a billed answer with no project context) and M3 (an unrefunded failed summary) live — both were invisible to the current suite.
- **What to do:**
  1. Create a project against a small fixture repository, poll the embedding status until it settles (or fails), open a chat, and assert a streamed answer arrives.
  2. Assert the answer is project-grounded, not the general-mode fallback — this is the M2 regression guard at the layer where it actually matters.
  3. Assert credit balance behaviour on the round trip (ties to T-006/T-007).
  4. **If this does not fit one session, split it:** T-035a project creation + embedding status, T-035b chat round-trip + credit assertions. Do not ship a truncated journey test.
- **Acceptance criteria:**
  - [ ] A full create-project → chat round trip passes against a fixture repository.
  - [ ] The test fails if the RAG retrieval path is bypassed.
  - [ ] Test added: `e2e/project-chat.spec.ts` (new).
- **How to verify:** `bun run test:e2e`; deliberately break the retrieval block and confirm the test catches it.
- **Notes/risks:** Needs a deterministic fixture repository — do not point this at a live third-party repo, or it becomes a flaky test that everyone learns to ignore. Note that M4/T-005 affects project creation, so a no-email test user would fail here; use an email-bearing test user.

### T-036 · Run `test:e2e` in CI
- [ ] **Status:** todo
- **Audit ref:** M14 (part 5 of 5) (§6, §12, §16.13)
- **Severity:** High
- **Effort:** M (30-90m)
- **Depends on:** T-034, T-035
- **Files:** `.github/workflows/ci.yml:53-79`
- **Problem:** CI runs checkout → setup-bun → install → typecheck → lint → test → build. `rg 'test:e2e|playwright' .github/workflows/ci.yml` returns **nothing**. The E2E suite exists but has never run in the pipeline, which is why M14 is a live problem and not a solved one. Untested-in-CI tests rot within a sprint.
- **What to do:**
  1. Add an E2E job that installs Playwright's browser dependencies and runs `bun run test:e2e`.
  2. Supply the Clerk test-user secret and any env the E2E server needs.
  3. Reuse the `pgvector/pgvector:pg17` service pattern the existing CI already uses, so the E2E DB is the same engine as the integration tests.
  4. Upload the Playwright report and traces as artifacts on failure — a failing E2E with no trace is a 20-minute investigation.
  5. Gate the merge on it, or at minimum on `main`/pre-release, so it cannot silently rot again.
- **Acceptance criteria:**
  - [ ] CI runs `bun run test:e2e` and fails the build when a spec fails.
  - [ ] Playwright report and traces are attached on failure.
  - [ ] The job is required (not `continue-on-error`).
  - [ ] Test added: the CI job itself; verified by pushing a deliberately failing spec on a branch and observing a red build.
- **How to verify:** push a branch with a failing E2E spec, confirm the run goes red and the artifact is downloadable.
- **Notes/risks:** E2E in CI is slow and occasionally flaky. Track the first few runs before adding retries — a retry that hides a real failure is worse than a red build.

## Phase P2 — Engineering health

### T-037 · Collapse the two project-ownership primitives into one
- [ ] **Status:** todo
- **Audit ref:** M12 (§16.19)
- **Severity:** Medium
- **Effort:** M
- **Depends on:** none
- **Files:** `src/lib/guards.ts:15,26,43`, `src/features/dashboard/server/router/services/projectService.ts:47,61-64` + 12 call sites (L213…L811)
- **Problem:** Two implementations of the same check with two different error types. `assertProjectOwnership` throws `ProjectAccessError`; `verifyOwnership` throws `TRPCError` with a different message. A security fix applied to one leaves the other unfixed.
- **What to do:**
  1. Make `src/lib/guards.ts` the single implementation, throwing the error shape the routers need. Keep `ProjectAccessError` only if the chat route must distinguish "no access" from "server error"; otherwise drop the class and its catch block.
  2. Delete `projectService.ts:47` `verifyOwnership` and point all 12 internal call sites at the guard.
  3. Confirm a request for a foreign `projectId` still returns 404 rather than 500.
  4. Leave a comment on the guard naming the security property so the next reader does not inline a cheaper check.
- **Acceptance criteria:**
  - [ ] `verifyOwnership` no longer exists; exactly one ownership check remains repo-wide
  - [ ] A foreign project id returns 404, not 500
  - [ ] The chat route's `ProjectAccessError` branch still returns 404, or is deleted with the class
  - [ ] test added or updated: `src/__tests__/unit/guards.test.ts`
- **How to verify:** `rg -n 'verifyOwnership' src/` (expect none) · `bun run typecheck` · `bun run lint` · `bun run test src/__tests__/unit/guards.test.ts`
- **Notes/risks:** The 12 call sites live in one file so the diff is mechanical; the real risk is dropping one call site and leaving a method unowned. Grep before finishing.

### T-038 · Move the tRPC client to `@trpc/tanstack-react-query`
- [ ] **Status:** todo
- **Audit ref:** M9 (§16.20)
- **Severity:** Medium
- **Effort:** L
- **Depends on:** D-8
- **Files:** `src/lib/trpc/client.ts:3,10`, `src/lib/trpc/server.tsx:20-23`, every consumer of the client provider
- **Problem:** The client uses the deprecated `@trpc/react-query` adapter while the server already uses `@trpc/tanstack-react-query`. Two generations coexist, so cache and invalidation semantics can disagree between server and client.
- **What to do:**
  1. Confirm D-8 first — this is a multi-day migration, not a single PR.
  2. Swap the import in `client.ts` for the tanstack adapter and update the provider wiring.
  3. Fix each consumer whose hook names or signatures changed.
  4. Drop `@trpc/react-query` from `package.json`.
- **Acceptance criteria:**
  - [ ] `@trpc/react-query` is absent from `package.json`
  - [ ] Every dashboard, project and chat route renders with no console errors
  - [ ] test added or updated: `src/__tests__/unit/project-prefetch.test.ts`
- **How to verify:** `bun run typecheck` · `bun run lint` · `bun run test` · `bun run build`
- **Notes/risks:** Marked L deliberately. If one session cannot hold it, split into "provider plus one route" PRs. Do not start T-039 until this lands.

### T-039 · Stop sniffing tRPC's internal query key in `prefetch`
- [ ] **Status:** todo
- **Audit ref:** M10 (§16.20)
- **Severity:** Medium
- **Effort:** S
- **Depends on:** T-038
- **Files:** `src/lib/trpc/server.tsx:79,85,87`
- **Problem:** `prefetch` decides infinite-vs-regular by reading `queryOptions.queryKey[1]?.type === "infinite"` — an undocumented internal — behind one `as any` cast and one `<any>` generic. Change the shape upstream and prefetch silently stops prefetching.
- **What to do:**
  1. Replace the key inspection with the public infinite-prefetch entry point the tanstack adapter exposes.
  2. Remove the `as any` at `:87` and narrow the `<any>` generic at `:79` to the real option type.
  3. If no public discriminator exists, make the caller pass an explicit flag defaulting to false. Do not re-add the key sniff.
- **Acceptance criteria:**
  - [ ] Zero `as any` casts in `server.tsx`
  - [ ] Infinite queries are still prefetched, proven by a test rather than by inspection
  - [ ] test added or updated: `src/__tests__/unit/project-prefetch.test.ts`
- **How to verify:** `bun run typecheck` · `bun run test src/__tests__/unit/project-prefetch.test.ts`
- **Notes/risks:** Test first — the current failure mode is silent, so a test that asserts a real prefetch happened is the only thing that proves the fix.

### T-040 · Correct the `caller` docstring about background-job use
- [ ] **Status:** todo
- **Audit ref:** M11 (§16.21)
- **Severity:** Medium
- **Effort:** S
- **Depends on:** none
- **Files:** `src/lib/trpc/server.tsx:59-69,70`, `src/lib/trpc/init.ts:11-12`
- **Problem:** The docstring invites calling procedures "from server actions, background jobs, or inside React Server Components". `createTRPCContext` calls Clerk `auth()`, which needs a live request, so every `protectedProcedure` fails inside an Inngest job. The comment is an active trap.
- **What to do:**
  1. Rewrite the docstring to state the real constraint: `caller` works only where a Clerk request context exists.
  2. Document the supported background-job path — call the service layer directly, which is what the Inngest functions already do.
  3. If a job-safe caller is genuinely wanted, note it as follow-up work rather than implying it exists.
- **Acceptance criteria:**
  - [ ] The docstring no longer claims background-job support
  - [ ] It names the service layer as the background-job path
  - [ ] No behaviour change
- **How to verify:** `bun run typecheck` · manual: read the docstring against `createTRPCContext`
- **Notes/risks:** Doc-only. If a reviewer prefers making the claim true, that is a separate scoped task.

### T-041 · Fix the two docstrings that contradict their own code
- [ ] **Status:** todo
- **Audit ref:** M7, M8, L24 (§16.23)
- **Severity:** Medium
- **Effort:** S
- **Depends on:** D-9
- **Files:** `src/lib/github/utils.ts:23,26-46`, `src/lib/github/services/project.ts:28-29,108-110`, `src/lib/validation/schemas.ts:22`
- **Problem:** `parseGitHubUrl` claims "Supports HTTPS, SSH, and shorthand formats"; the body only takes `owner/repo` from a `/`-split, so `git@github.com:owner/repo.git` yields owner `"git@github.com:owner"`. `createGitHubProject` claims transactional inserts at lines 28-29 and then states at 108-110 that neon-http has no transactions.
- **What to do:**
  1. Per D-9, either support SSH and GitHub Enterprise in `parseGitHubUrl` (handle `git@host:owner/repo.git` and non-`github.com` hosts) or narrow the docstring to exactly what is accepted.
  2. Update `validators.githubUrl` so the regex matches whichever way the decision goes.
  3. Fix the `createGitHubProject` header: state that neon-http has no transaction, that inserts are sequential, and that a mid-run failure leaves the project row with partial history recoverable by re-sync. Remove the atomicity claim at 28-29.
- **Acceptance criteria:**
  - [ ] `parseGitHubUrl` docstring matches its accepted formats exactly
  - [ ] `createGitHubProject` makes no atomicity claim it cannot honour
  - [ ] test added or updated: URL-parsing assertions in `src/__tests__/unit/rag-ingestion.test.ts`
- **How to verify:** `bun run typecheck` · `bun run test src/__tests__/unit/rag-ingestion.test.ts`
- **Notes/risks:** Keeping claim and code in one PR is the point — a doc fix without the code change just moves the lie.

### T-042 · Add `bun audit` to CI
- [ ] **Status:** todo
- **Audit ref:** §13 (CI/CD), §9 (dependency risk)
- **Severity:** Low
- **Effort:** S
- **Depends on:** none
- **Files:** `.github/workflows/ci.yml:53-79`
- **Problem:** Dependency vulnerabilities are never checked in CI. `--frozen-lockfile` keeps the lockfile honest and the `postcss 8.5.25` override pins one transitive dep, but nothing catches a new advisory.
- **What to do:**
  1. Add an `Install dependencies` sibling step running `bun audit --fails-on-vulnerability` (or the equivalent for the pinned bun version).
  2. Place it before `Typecheck` so a bad dependency fails in seconds.
  3. Do not set it to `continue-on-error`; a dependency check that cannot fail is decoration.
  4. If advisories currently exist, fix or pin them in the same PR so the step goes green.
- **Acceptance criteria:**
  - [ ] CI fails on an introduced advisory
  - [ ] The step is not marked optional
  - [ ] `bun run build` is unaffected
- **How to verify:** `bun audit` locally · push a branch adding a vulnerable dep and confirm a red run
- **Notes/risks:** Advisory feeds change. If a transitive advisory lands outside your control, the honest response is a documented override entry, not a skipped step.

### T-043 · Route the remaining raw `console` calls through `logger`
- [ ] **Status:** todo
- **Audit ref:** L14 (§16.29)
- **Severity:** Low
- **Effort:** S
- **Depends on:** T-019
- **Files:** `src/lib/github/client.ts:63`, `src/lib/github/utils.ts:132,134,135`, `src/lib/gemini.ts:108,111,114,117`, `src/shared/lib/chat-history.ts:74`, `src/features/rag/services/embeddings.ts:171,175`, `src/features/rag/services/vector-search.ts:70,279,359`, `src/features/rag/services/rag/context-fetcher.ts:205`, `src/features/auth/components/sign-in/use-signIn.ts:41,66`, `src/features/auth/components/sign-up/useSignUp.ts:76`
- **Problem:** Ten files bypass the project's structured logger. The auth and RAG files are the worst: their output will not reach any aggregated sink once T-020 ships a transport.
- **What to do:**
  1. Replace each `console.*` with the matching `logger.*` call, keeping message text intact so existing log searches still work.
  2. Delete the private `log()` helper in `github/utils.ts` and use `logger`.
  3. Verify the client-side files can import `logger` without pulling server-only code into the browser bundle. If not, leave them on `console` with a one-line comment saying why.
- **Acceptance criteria:**
  - [ ] `rg 'console\.' src/` returns only intentional client-side uses, each with a comment
  - [ ] Log output stays structured JSON
  - [ ] test added or updated: `src/__tests__/unit/logger.test.ts`
- **How to verify:** `rg -n 'console\.' src/` · `bun run typecheck` · `bun run lint` · `bun run test src/__tests__/unit/logger.test.ts`
- **Notes/risks:** Do this after T-019 so the new redaction fields ride along on the first pass.

### T-044 · Rename the misnamed env key and validate env at startup
- [ ] **Status:** todo
- **Audit ref:** L25, H5 residual (§16.29)
- **Severity:** Medium
- **Effort:** S
- **Depends on:** T-010
- **Files:** `.env:18`, `db/index.ts` (`DATABASE_URL!` assertion), `README.md` env table
- **Problem:** `.env` holds a live OpenRouter key named `OPENAI_API_KEY` that nothing reads, while `db/index.ts` asserts `DATABASE_URL!` non-null so a missing value surfaces as an opaque runtime error instead of a named one.
- **What to do:**
  1. Rename the key to `OPENROUTER_API_KEY` in `.env` and the README env table. Confirm existing consumers already read the correct name.
  2. Add one env module that validates required variables at startup and fails naming the missing variable.
  3. Keep the list minimal: `DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`, `GITHUB_TOKEN`, `OPENROUTER_API_KEY`, `INNGEST_*`. Do not add config nothing reads.
- **Acceptance criteria:**
  - [ ] No `OPENAI_API_KEY` reference remains outside this task's own changelog entry
  - [ ] A missing `DATABASE_URL` fails with a message naming it, not `undefined`
  - [ ] `bun run build` still succeeds with only public env set
  - [ ] test added or updated: new `src/__tests__/unit/env.test.ts`
- **How to verify:** `rg 'OPENAI_API_KEY' -n .` (expect none) · `bun run typecheck` · `bun run test src/__tests__/unit/env.test.ts`
- **Notes/risks:** The env module must tolerate build-time absence of optional vars or `next build` breaks in environments that only set the public env.

### T-045 · Stop `syncIssues` from deleting issues it cannot replace
- [ ] **Status:** todo
- **Audit ref:** M5
- **Severity:** High
- **Effort:** M
- **Depends on:** D-11
- **Files:** `src/features/dashboard/server/router/services/projectService.ts:242,258`, `src/lib/github/services/issues.ts:49-99,82-84`
- **Problem:** `syncIssues` DELETEs every issue for the project then re-pulls from GitHub. neon-http has no `db.transaction()`, so any failure between the two — a GitHub 500, a rate limit, a dropped connection — leaves the project with zero issues and no way back.
- **What to do:**
  1. Pull everything from GitHub into memory before touching the database.
  2. Only after a complete successful pull, delete and re-insert. This makes the destructive step unreachable from a partial failure without a transaction.
  3. Fix the O(n²) `batch.find()` in the insert loop (`issues.ts:82-84`) while you are there — build the lookup once as a `Map`.
  4. Return the existing 2,000 issue/PR cap as an explicit `truncated: boolean` instead of silently stopping.
  5. If D-11 chooses the pooled driver, wrap delete and insert in `db.transaction()` instead of relying on ordering.
- **Acceptance criteria:**
  - [ ] A GitHub failure mid-sync leaves existing issues intact
  - [ ] A successful sync replaces them
  - [ ] The cap is reported as a flag rather than applied silently
  - [ ] test added or updated: `src/__tests__/unit/rag-ingestion.test.ts` (failure-injection case) plus a truncation-flag assertion in `src/__tests__/integration/issues-unique-constraint.test.ts`
- **How to verify:** `bun run typecheck` · `bun run test src/__tests__/unit/rag-ingestion.test.ts`
- **Notes/risks:** Ordering-based protection assumes the insert is not itself partially applied. If D-11 stays on neon-http and partial inserts remain possible, add a `syncedAt` marker and filter on it — do not leave a window where issues exist but are incomplete and unmarked.

### T-046 · Return 404/400 instead of 500 for chat router errors
- [ ] **Status:** todo
- **Audit ref:** L1
- **Severity:** Low
- **Effort:** S
- **Depends on:** none
- **Files:** `src/features/chat/server/router/chat.ts:28,142`
- **Problem:** `chat.create` and `chat.getById` throw bare `Error`, which tRPC maps to `INTERNAL_SERVER_ERROR`, and the error formatter then masks the message in production. A missing chat surfaces to the user as an opaque server error.
- **What to do:**
  1. Convert both throws to `TRPCError` with `BAD_REQUEST` (`:28`) and `NOT_FOUND` (`:142`), matching the pattern already used at `:36`.
  2. Leave the messages as they are — the production formatter masks them, and the dev messages are already useful.
  3. Confirm no caller depends on the current `INTERNAL_SERVER_ERROR` code.
- **Acceptance criteria:**
  - [ ] A missing `projectId` returns `BAD_REQUEST`
  - [ ] An unknown `chatId` returns `NOT_FOUND`
  - [ ] Production responses leak no stack trace
  - [ ] test added or updated: new `src/__tests__/unit/chat-errors.test.ts`
- **How to verify:** `bun run typecheck` · `bun run test src/__tests__/unit/chat-errors.test.ts`
- **Notes/risks:** Check the `refundOnce` call sites in the chat route afterwards — an error path that now returns 400 still must not skip the refund.

### T-047 · Return 400 for a malformed request body
- [ ] **Status:** todo
- **Audit ref:** L2
- **Severity:** Low
- **Effort:** S
- **Depends on:** T-046
- **Files:** `app/api/chat/route.ts:286,319,644`
- **Problem:** `chatRequestSchema.safeParse(await req.json())` sits inside a `try`, but `req.json()` throws a `SyntaxError` for a malformed body before `safeParse` ever runs. The generic catch at `:644` turns a client bug into a 500.
- **What to do:**
  1. Read the body defensively: `let body: unknown; try { body = await req.json(); } catch { return 400 }`, then `safeParse(body)`.
  2. Return 400 with the existing validation-error shape so the client renders one consistent message.
  3. Confirm the early return happens before the credit spend, or that the refund path is preserved.
- **Acceptance criteria:**
  - [ ] Malformed JSON returns 400, not 500
  - [ ] A schema-invalid but well-formed body still returns 400 with the same shape
  - [ ] No credit is spent on either path
  - [ ] test added or updated: `src/__tests__/integration/chat-request-validation.test.ts`
- **How to verify:** `bun run typecheck` · `bun run test src/__tests__/integration/chat-request-validation.test.ts`
- **Notes/risks:** The exact line ordering matters here: the parse must complete before `spendCredits` at `route.ts:395`.

### T-048 · Stop overwriting a user-chosen chat title
- [ ] **Status:** todo
- **Audit ref:** L3
- **Severity:** Low
- **Effort:** S
- **Depends on:** none
- **Files:** `app/api/chat/route.ts:616-620`
- **Problem:** The auto-rename treats `"New Chat"`, `"General Chat"` and `"Project Chat"` as sentinel titles. A user who deliberately names a chat "New Chat" has it overwritten on their first turn.
- **What to do:**
  1. Prefer a signal that is not a string. Track "never renamed" explicitly — a flag on the row, or a sentinel value the UI never displays — and rename only on that.
  2. If a schema change is unwanted, narrow the match to the single placeholder string this codebase actually inserts, and drop the other two literals.
  3. Keep the rename non-destructive in either design: only overwrite an untouched sentinel, never a title the user changed.
- **Acceptance criteria:**
  - [ ] A chat the user named "New Chat" keeps that name
  - [ ] A freshly created chat still auto-names on its first turn
  - [ ] test added or updated: `src/__tests__/integration/chat-route-ordering.test.ts`
- **How to verify:** `bun run typecheck` · `bun run test src/__tests__/integration/chat-route-ordering.test.ts`
- **Notes/risks:** String matching is inherently ambiguous here. If option 2 feels fragile, the explicit flag is the correct fix even though it costs a migration.

### T-049 · Distinguish deleted from never-existed in `chat.delete`
- [ ] **Status:** todo
- **Audit ref:** L8
- **Severity:** Low
- **Effort:** S
- **Depends on:** none
- **Files:** `src/features/chat/server/router/chat.ts:164-172`
- **Problem:** The delete filters on `id` AND `userId`, then returns `{success: true}` unconditionally. A caller cannot tell "deleted" from "not yours" from "not there".
- **What to do:**
  1. Add `.returning({ id: projectChats.id })` to the delete.
  2. Return `{ success: true, deleted: rows.length > 0 }` or throw `NOT_FOUND` when nothing matched. Pick one and update the client in the same PR.
  3. Do not split not-found from not-owned in the response. The audit deliberately folds them to avoid an existence oracle.
- **Acceptance criteria:**
  - [ ] The response reflects whether a row was actually deleted
  - [ ] Not-owned and not-found stay indistinguishable to the caller
  - [ ] test added or updated: new `src/__tests__/unit/chat-delete.test.ts`
- **How to verify:** `bun run typecheck` · `bun run test src/__tests__/unit/chat-delete.test.ts`
- **Notes/risks:** If the UI depends on the flat `{success}` shape, widen this PR to include the component.

### T-050 · Make issue and comment pagination honest
- [ ] **Status:** todo
- **Audit ref:** L12, L13
- **Severity:** Low
- **Effort:** S
- **Depends on:** none
- **Files:** `src/features/dashboard/server/router/services/projectService.ts:809,837-838,875-876`, `src/features/dashboard/server/router/project.ts:148`
- **Problem:** `getIssueComments` truncates at 50 with no `hasMore`. `getProjectIssues` is limit-only (max 100) with no cursor, so a long issue list cannot be paged past 100 at all.
- **What to do:**
  1. Over-fetch by one in both, derive `hasMore` from the overflow, then slice.
  2. Add a cursor to comments on `(github_created_at, id)` so long threads are fully reachable.
  3. Replace the issues limit-only paging with a keyset cursor on `github_updated_at, id`, matching the compound-cursor discipline T-056 applies to commits.
  4. Keep ownership folded into each lookup so neither response becomes an existence oracle.
- **Acceptance criteria:**
  - [ ] Both endpoints report whether more rows exist
  - [ ] A 60-comment thread is fully reachable
  - [ ] Issues beyond the first 100 are reachable
  - [ ] test added or updated: `src/__tests__/integration/issue-comments-ownership.test.ts` (extend) plus `src/__tests__/unit/project-issues-shape.test.ts`
- **How to verify:** `bun run typecheck` · `bun run test src/__tests__/integration/issue-comments-ownership.test.ts`
- **Notes/risks:** Two response shapes change. The client components must move in the same PR or typecheck will fail — that is fine, just do not split it.

### T-051 · Validate `getFileContent` input and type the GitHub commit boundary
- [ ] **Status:** todo
- **Audit ref:** L11, L20
- **Severity:** Low
- **Effort:** S
- **Depends on:** none
- **Files:** `src/features/dashboard/server/router/project.ts:80,146,161`, `src/lib/github/utils.ts:53-54`
- **Problem:** `getFileContent` accepts bare `z.string()` while its siblings use `.uuid()`, so a malformed id reaches the database as a value that cannot match. `createCommitData(commit: any, …)` types an unvalidated GitHub REST payload as `any` behind an eslint-disable, so a field rename surfaces as a runtime `undefined` rather than a type error.
- **What to do:**
  1. Change `getFileContent` input to `z.string().uuid()` to match `:146` and `:161`.
  2. Give `createCommitData` a narrow parameter type covering the fields it actually reads, and drop the eslint-disable. If the payload is genuinely loose, parse it at the boundary with a schema instead.
- **Acceptance criteria:**
  - [ ] `getFileContent` rejects a non-uuid id with a validation error
  - [ ] `createCommitData` no longer takes `any` and carries no eslint-disable
  - [ ] test added or updated: new `src/__tests__/unit/file-content-input.test.ts`
- **How to verify:** `bun run typecheck` · `bun run lint` · `bun run test src/__tests__/unit/file-content-input.test.ts`
- **Notes/risks:** Adding a uuid check can reject ids the client currently sends if any caller stores a non-uuid. Check the call sites before enforcing.

### T-052 · Stop duplicating security headers in the tRPC route
- [ ] **Status:** todo
- **Audit ref:** L15, L21
- **Severity:** Low
- **Effort:** S
- **Depends on:** T-022
- **Files:** `app/api/trpc/[trpc]/route.ts:24-27`, `next.config.ts:58-61`
- **Problem:** The tRPC route re-sets four headers already set globally in `next.config.ts` — a drift risk, since a future change to one will silently miss the other — and omits `x-request-id` on responses even though the chat route sets it. It also re-sets `X-XSS-Protection`, which modern browsers ignore.
- **What to do:**
  1. Remove the four duplicated header assignments and rely on `next.config.ts` as the single source.
  2. Add `x-request-id` to the tRPC response headers, generating one per request if absent, matching `app/api/chat/route.ts:642`.
  3. Delete the obsolete `X-XSS-Protection` from both `next.config.ts` and the route.
- **Acceptance criteria:**
  - [ ] tRPC responses carry `x-request-id`
  - [ ] No header is set in two places
  - [ ] `X-XSS-Protection` is gone
  - [ ] test added or updated: `src/__tests__/integration/security-headers.test.ts` and `src/__tests__/integration/trpc-request-id.test.ts`
- **How to verify:** `bun run typecheck` · `bun run test src/__tests__/integration/trpc-request-id.test.ts`
- **Notes/risks:** Sequence after T-022 so the CSP change lands once rather than twice.

### T-053 · Finish the Zod 4 migration
- [ ] **Status:** todo
- **Audit ref:** L22
- **Severity:** Low
- **Effort:** S
- **Depends on:** none
- **Files:** `src/features/auth/schemas/sign-up.schema.ts:5`, `src/lib/validation/schemas.ts:8,12,20,45,122`, `src/features/dashboard/server/router/project.ts:146,161`, `src/features/chat/server/router/chat.ts:22,109,162`
- **Problem:** Three deprecated calls (`z.string().email()`, `z.string().url()`) plus eight `z.string().uuid()` still use the Zod 3 chain form while the rest of the file is Zod 4.
- **What to do:**
  1. Replace `z.string().email()` with `z.email()`, `z.string().url()` with `z.url()`, and `z.string().uuid()` with `z.uuid()` at the eleven call sites.
  2. Preserve every custom message. `sign-up.schema.ts:5` chains `.nonempty({ message: "Email is required" })` onto the email check — keep that message attached to the new form.
  3. Run the auth and validation suites; Zod 4 changed some inference behaviour.
- **Acceptance criteria:**
  - [ ] Zero `z.string().email()` / `.url()` / `.uuid()` occurrences remain
  - [ ] All custom messages survive
  - [ ] test added or updated: existing sign-up and validation suites pass unchanged
- **How to verify:** `rg -n 'z\.string\(\)\.(email|url|uuid)' src/` (expect none) · `bun run typecheck` · `bun run test`
- **Notes/risks:** Purely mechanical, but do not batch it with a behaviour change — the point is that the diff is provably behaviour-free.

### T-054 · Fix the front-end asset and font weight
- [ ] **Status:** todo
- **Audit ref:** M18, L16, L17, L19 (§16.24)
- **Severity:** Low
- **Effort:** S
- **Depends on:** none
- **Files:** `app/layout.tsx:15,22,30,39,49,57,65,98,110,123`, `src/lib/github/constants.ts:75`, `next.config.ts:15-32`, `public/hero2.jpg`, `public/og-image.png` (missing)
- **Problem:** Seven Google font families load on a landing page, four of them preloaded, which fights the browser's own prioritisation. `og-image.png` is referenced in the OG metadata but does not exist. The default avatar points at `via.placeholder.com`, a deprecated service not in `remotePatterns`. `hero2.jpg` is 2.73 MB.
- **What to do:**
  1. Cut to two or three families — keep the code face and one sans — and remove `preload: true` from everything but the primary family. Update the CSS vars applied at `:123`.
  2. Create `public/og-image.png` at 1200×630 so the OG tags at `:98` and `:110` resolve.
  3. Point `DEFAULTS.avatar` at a host already in `next.config.ts:15-32` (or add the new host there) instead of `via.placeholder.com`.
  4. Recompress `hero2.jpg` to a web-appropriate size. It renders through `next/image`, so this is repo size and cold-build time, not user-facing LCP.
- **Acceptance criteria:**
  - [ ] At most three font families load, at most one preloaded
  - [ ] `public/og-image.png` exists and the OG URL resolves
  - [ ] The default avatar host is in `remotePatterns`
  - [ ] `hero2.jpg` is under 400 KB with no visible quality loss
  - [ ] test added or updated: `src/__tests__/unit/hero-content-lcp.test.ts`
- **How to verify:** `bun run build` · `ls -l public/` · `bun run test src/__tests__/unit/hero-content-lcp.test.ts`
- **Notes/risks:** Dropping fonts changes the visual design. Check the landing page at desktop and mobile widths before merging — this is a design change wearing a perf label.

### T-055 · Add the missing composite and language indexes
- [ ] **Status:** todo
- **Audit ref:** L9, §10.3 (§16.25)
- **Severity:** Medium
- **Effort:** S
- **Depends on:** none
- **Files:** `db/schema.ts:216-218`, new migration in `db/migrations/`
- **Problem:** `project_chats` has only single-column indexes, yet `getAll` orders by `updatedAt DESC` with a keyset cursor, so each page pays a per-page sort. `project_files.language` is used with `selectDistinct` and has no index at all.
- **What to do:**
  1. Add a migration creating `index("chats_user_id_updated_at_idx").on(project_chats.user_id, project_chats.updated_at)`.
  2. Add an index on `project_files.language` for the `selectDistinct` in `getLanguageBreakdown`.
  3. Generate the migration with the project's own tooling so schema and snapshots stay in agreement.
  4. Write `.notes.md` alongside the migration, matching the three that already ship.
- **Acceptance criteria:**
  - [ ] Both indexes exist in the schema and in a generated migration
  - [ ] Snapshots and migrations agree — no drift
  - [ ] `bun run test` passes, including the pgvector container
  - [ ] test added or updated: `src/__tests__/integration/credits-check-and-indexes.test.ts` (real-DB index assertions belong here)
- **How to verify:** `bun run db:generate` · `bun run typecheck` · `bun run test src/__tests__/integration/credits-check-and-indexes.test.ts`
- **Notes/risks:** The `chats_user_id_updated_at_idx` name must match what the `db:migrate` step expects on an existing database. Check for a name collision with the two existing chat indexes first.

### T-056 · Make the commit cursor compound
- [ ] **Status:** todo
- **Audit ref:** L10 (§16.25)
- **Severity:** Medium
- **Effort:** S
- **Depends on:** T-055
- **Files:** `src/features/dashboard/server/router/services/projectService.ts:306,314,319`
- **Problem:** The keyset comparison is on `authorDate`, which is not unique, while the returned cursor token is the unique `id`. Commits sharing an `authorDate` are skipped or duplicated depending on which side of the tie the page boundary falls.
- **What to do:**
  1. Order by `(authorDate DESC, id DESC)` and make the cursor carry both values.
  2. Compare with the row-value form so the comparison is strictly less-than on the pair: `(authorDate, id) < (cursorDate, cursorId)`.
  3. Backward compatibility: the cursor may arrive without an id. Reject it with `BAD_REQUEST` rather than silently producing wrong pages.
  4. Any cursor stored client-side resets on deploy; that is acceptable and expected.
- **Acceptance criteria:**
  - [ ] Paging through a batch of commits with identical `authorDate` returns each commit exactly once
  - [ ] A malformed cursor returns a validation error, not wrong results
  - [ ] test added or updated: `src/__tests__/unit/chat-pagination.test.ts` pattern applied to commits — add `src/__tests__/unit/project-commits-cursor.test.ts`
- **How to verify:** `bun run typecheck` · `bun run test src/__tests__/unit/project-commits-cursor.test.ts`
- **Notes/risks:** This is a response-shape change. Update the component that builds the cursor in the same PR.

### T-057 · Add an IP-based rate-limit dimension
- [ ] **Status:** todo
- **Audit ref:** M21
- **Severity:** Medium
- **Effort:** M
- **Depends on:** none
- **Files:** `src/lib/rate-limit.ts:51-57`
- **Problem:** All five rate-limit keys derive from `userId`. A fresh Clerk account resets the entire budget, so signup-churn can drive unlimited usage against the metered endpoints.
- **What to do:**
  1. Add an IP-scoped key alongside the user-scoped one, deriving the address from `x-forwarded-for` (first hop) with the platform's own IP header as fallback. Never trust a client-supplied `x-forwarded-for` without the platform proxy in front — it is already on Vercel, so confirm the header count before parsing.
  2. Enforce both limits: user-scoped for fairness, IP-scoped as a cost ceiling. Keep the Postgres-backed store so this stays correct across serverless instances.
  3. Raise the IP limits above the per-user limits so a shared office IP is not punished.
  4. Add a global daily ceiling for the metered endpoints as a backstop.
- **Acceptance criteria:**
  - [ ] Each metered procedure enforces both a user and an IP limit
  - [ ] IP limits are looser than user limits
  - [ ] A global daily ceiling exists for metered endpoints
  - [ ] test added or updated: `src/__tests__/integration/project-router-rate-limits.test.ts`
- **How to verify:** `bun run typecheck` · `bun run test src/__tests__/integration/project-router-rate-limits.test.ts`
- **Notes/risks:** On Vercel, `x-forwarded-for` is client-appendable. Use `x-vercel-forwarded-for` or `req.ip` where available — a spoofable IP limit is theatre.

### T-058 · Make the embedding rate limiter cross-instance
- [ ] **Status:** todo
- **Audit ref:** M22
- **Severity:** Low
- **Effort:** M
- **Depends on:** D-7
- **Files:** `src/features/rag/services/embeddings.ts:48,51,72,80`
- **Problem:** `let lastRequestTime` plus a promise chain serialises requests within one process but does nothing across concurrent serverless lambdas. Real protection today is only `concurrency: 2` plus the provider's own quota.
- **What to do:**
  1. Per D-7, move the inter-request spacing into a shared store — Upstash Redis or a Neon-backed counter — so the delay holds across instances.
  2. Keep the in-process promise chain: it is what prevents a single warm instance from bursting, and it costs nothing.
  3. On failure to reach the store, fail open (proceed) rather than stalling ingestion. Log the degraded state.
  4. If D-7 chooses to accept the current state, this task closes as documented rather than implemented.
- **Acceptance criteria:**
  - [ ] Spacing holds across two concurrent instances, proven by a test
  - [ ] A store outage degrades to proceeding, not to a hang
  - [ ] test added or updated: `src/__tests__/unit/embeddings.test.ts`
- **How to verify:** `bun run typecheck` · `bun run test src/__tests__/unit/embeddings.test.ts`
- **Notes/risks:** Adding a Redis dependency is a real cost decision. D-7 should weigh it against the provider quota, which may already be sufficient at current volume.

### T-059 · Add coverage thresholds to the Vitest config
- [ ] **Status:** todo
- **Audit ref:** §12 (testing)
- **Severity:** Low
- **Effort:** S
- **Depends on:** none
- **Files:** `vitest.config.ts`, `package.json` (`test:coverage` script exists)
- **Problem:** The repo has 36 purposeful test files and a working `test:coverage` script, but no thresholds, so coverage can fall silently.
- **What to do:**
  1. Measure the current baseline first and set thresholds slightly below it, not at some aspirational number.
  2. Configure thresholds for lines, functions, statements and branches, plus a per-glob floor for the security-sensitive directories (`src/lib`, `src/app/api`).
  3. Add the coverage step to CI as reporting. Do not make it a hard gate in the same PR — let the numbers settle first.
  4. Note the exclusions (`*.config.ts`, `db/schema.ts`, test setup) so the numbers mean something.
- **Acceptance criteria:**
  - [ ] `bun run test:coverage` prints a threshold summary and exits non-zero when unmet
  - [ ] Thresholds are at or just below the measured baseline
  - [ ] The new files from T-001…T-056 are included in the measurement
- **How to verify:** `bun run test:coverage` · lower a threshold deliberately and confirm the run fails
- **Notes/risks:** Setting a threshold above today's real number blocks every subsequent PR. Measure, then set.

### T-060 · Fix the operations docs and document the recovery scripts
- [ ] **Status:** todo
- **Audit ref:** L18, L23, M15 (doc half), §14
- **Severity:** Low
- **Effort:** S
- **Depends on:** T-001, T-024
- **Files:** `docs/operations/backup-retention.md:18,28,53`, `README.md`, `package.json`
- **Problem:** The runbook says `npm run db:backup` while the project is bun-pinned, and contradicts itself on the same page. `scripts/reset-stuck-embeddings.ts` and `scripts/llm-safety-selfcheck.ts` are undocumented — and until T-002 lands, the repair script is the only way to find a wedged pipeline. The retention table still describes a sweep that does not exist.
- **What to do:**
  1. Replace every `npm run` with `bun run` and resolve the self-contradiction at `:28`.
  2. Add a runbook section: how to detect a wedged pipeline, how to run `reset-stuck-embeddings.ts`, and what state a project lands in afterwards.
  3. Add a `package.json` script for the repair script so it is discoverable.
  4. Point the retention table at whichever of T-023 or T-024 shipped.
- **Acceptance criteria:**
  - [ ] No `npm run` remains in the docs
  - [ ] The wedged-pipeline procedure is documented end to end
  - [ ] The retention table matches reality
  - [ ] test added or updated: none — documentation only
- **How to verify:** `rg -n 'npm run' docs/ README.md` (expect none) · follow the runbook on a clean checkout
- **Notes/risks:** Sequence after T-001 and T-024 so the doc describes the scheduler and the retention decision that actually shipped.

### T-061 · Correct the README and the stale schema comment
- [ ] **Status:** todo
- **Audit ref:** §14, L7, L25
- **Severity:** Low
- **Effort:** S
- **Depends on:** T-044
- **Files:** `README.md:141,171-181,205,213`, `db/schema.ts:138`, `src/features/projects/types/project.types.ts:30`
- **Problem:** The README claims "24 of 24 tRPC procedures" (there are 23, all protected — the security claim still holds). It documents one of 18 package scripts. `db/schema.ts:138` says "Gemini embedding-004 = 768 dims" while the code uses `qwen/qwen3-embedding-8b` via OpenRouter, also 768 dims. `commits.AiSummary` is PascalCase where `issues.aiSummary` is camelCase, and the PascalCase leaks into the client type.
- **What to do:**
  1. Fix the procedure count to 23 and state that all of them are protected.
  2. Correct the schema comment to name the real model, and keep the 768-dimension figure since it is accurate.
  3. Document the remaining scripts: `test`, `typecheck`, `lint`, `test:e2e`, `test:coverage`, `db:backup`, `db:init`, `db:migrate`, and the `INNGEST_*` variables.
  4. Rename `commits.AiSummary` to `aiSummary` for consistency with the issues table. The SQL column is already `ai_summary` in all three migrations and all three snapshots, so this is a TypeScript-only rename with no migration.
  5. Update `project.types.ts:30` in the same PR.
- **Acceptance criteria:**
  - [ ] The README's procedure count matches the router
  - [ ] Every `package.json` script is documented
  - [ ] No stale model name remains in `db/schema.ts`
  - [ ] `AiSummary` appears nowhere in TypeScript
  - [ ] test added or updated: `bun run typecheck` plus the existing project-type consumers compile unchanged
- **How to verify:** `rg -n 'AiSummary|Gemini embedding-004|24 of 24' src/ db/schema.ts README.md` (expect none) · `bun run typecheck` · `bun run test`
- **Notes/risks:** The rename touches every reader of `commits.AiSummary`. Let `typecheck` enumerate them rather than hunting by hand.

### T-062 · Add a LICENSE and an architecture document
- [ ] **Status:** todo
- **Audit ref:** §14, §8 (§16.27)
- **Severity:** Low
- **Effort:** M
- **Depends on:** none
- **Files:** new `LICENSE`, new `docs/architecture.md`, `README.md`
- **Problem:** The README has a license section with no `LICENSE` file at the root. There is no architecture document, no data-flow diagram and no ERD — the least urgent gap in the audit, and the code comments currently carry that load on their own.
- **What to do:**
  1. Add the `LICENSE` file. **Choosing the license is a human decision** — it is not an engineering call.
  2. Write `docs/architecture.md` covering: the `features/* / lib/* / shared/* / db/*` layering, the `src/lib/github` encapsulation rule, the RAG ingestion → embedding → retrieval → chat flow, and the three known structural tensions (no transactions on neon-http, application-level tenant isolation with no RLS, two ownership primitives).
  3. Include a data-flow diagram for the chat path and the ingestion path. Mermaid, since it renders in the repo's Markdown viewers.
  4. Add a pointer to it from the README.
- **Acceptance criteria:**
  - [ ] `LICENSE` exists at the repo root and matches the README's license section
  - [ ] `docs/architecture.md` describes both main flows
  - [ ] The neon-http and RLS trade-offs are written down, not just implied
  - [ ] test added or updated: none — documentation only
- **How to verify:** read both documents end to end and confirm each claim against the code
- **Notes/risks:** Lowest priority in the plan. The value is in honesty about the trade-offs, not in diagram volume.

### T-063 · Add a soft-delete window to account deletion
- [ ] **Status:** todo
- **Audit ref:** §16.30, §9 (GDPR)
- **Severity:** Medium
- **Effort:** L
- **Depends on:** D-10
- **Files:** `app/api/webhooks/clerk/route.ts` (`user.deleted` handler), `db/schema.ts`, new migration
- **Problem:** `user.deleted` is an irreversible hard cascade. There is no grace period and no recovery path, so a compromised or mistaken Clerk deletion destroys every project, chat and embedding for that user with no recourse.
- **What to do:**
  1. Per D-10, add a soft-delete column with a scheduled purge.
  2. On `user.deleted`, set the flag and a `deleted_at` timestamp instead of cascading. Stop serving the account; keep the rows.
  3. Add a retention window to `cleanupStaleData` that purges soft-deleted accounts and everything they own after it expires.
  4. If D-10 opts for a full export, do T-064 first — export must run before purge.
- **Acceptance criteria:**
  - [ ] A Clerk user deletion leaves data recoverable inside the window
  - [ ] The soft-deleted account can no longer sign in or make requests
  - [ ] Data is purged after the window, verified against a real cascade
  - [ ] test added or updated: `src/__tests__/integration/clerk-webhook.test.ts` (extend with the user.deleted case)
- **How to verify:** `bun run typecheck` · `bun run test src/__tests__/integration/clerk-webhook.test.ts`
- **Notes/risks:** This is the largest task in the plan and it changes the deletion contract. It is P2 because it is a GDPR-hardening item, not a data-loss risk today — but the absence of any grace period is the reason it is on the list at all.

### T-064 · Add a self-serve data export path
- [ ] **Status:** todo
- **Audit ref:** §16.30, §9 (GDPR)
- **Severity:** Low
- **Effort:** M
- **Depends on:** T-063
- **Files:** `app/api/user/export/route.ts` (new), `src/features/dashboard/server/router/user.ts` or equivalent
- **Problem:** A user cannot obtain their own data. Combined with the hard delete, a user who wants out has no way to take their projects with them.
- **What to do:**
  1. Per D-10, add a rate-limited authenticated export endpoint returning the user's projects, chats, messages and file metadata.
  2. Keep it in the same ownership pattern as every other route: verify the user id from the Clerk session, never from the request body.
  3. Exclude embeddings and code contents from the default payload, or include them only behind an explicit flag, so the response stays a reasonable size.
  4. Rate-limit it, reusing the existing Postgres-backed limiter.
- **Acceptance criteria:**
  - [ ] An authenticated user can export their own data
  - [ ] One user cannot export another's data
  - [ ] The endpoint is rate-limited
  - [ ] test added or updated: new `src/__tests__/integration/user-export-ownership.test.ts`
- **How to verify:** `bun run typecheck` · `bun run test src/__tests__/integration/user-export-ownership.test.ts`
- **Notes/risks**: Run before the purge in T-063 or it exports nothing. Ownership test matters more than the format here — a leak is the failure that counts.

## Already resolved / Not reproducible

None. The audit was written against `1e577d4` and HEAD is `1e577d4`, so every finding was re-checked in the working tree and every one still reproduces. No task is marked `[UNVERIFIED]`.

Five audit details were found inaccurate during verification. Each is reflected in the task text rather than repeated here:

| Audit ID | Audit says | Verified reality |
|---|---|---|
| M18 | 6 fonts preloaded | 4 preloaded (`app/layout.tsx:15,22,30,39`); 7 families, 3 unpreloaded |
| L16 | og-image at `layout.tsx:95,108` | `:98,110` |
| M10 | two `as any` casts | one `as any` (`server.tsx:87`) plus one `<any>` generic (`:79`) |
| L5 | `createCallerFactory` is dead code | false — imported by 4 test files; it is test infrastructure, not a defect. No task. |
| L2 | `req.json()` is unwrapped | it is inside the `try` at `route.ts:286`, but `SyntaxError` precedes `safeParse`, so the 500 outcome is the same. T-047 fixes the cause. |

H1 is also slightly misdescribed: the audit calls it "two string edits". The chat href at `projectService.ts:663-665` is a ternary whose `/chat/${c.id}` fallback is already correct — only the project branch is dead. T-003 accounts for this.

## Needs a human decision

Each item below is a product or architecture choice. The dependent task is written so it can start the moment the decision lands; the task body states what changes under each option.

**D-1 — No-email Clerk users (M4) · blocks T-005**
- (a) Synthesise a unique placeholder email (e.g. `user-<clerkId>@users.invalid`) so the `users.email` UNIQUE constraint holds and the FK survives. Zero user-facing impact; adds fake data.
- (b) Reject project creation with a clear "add an email address to your account" error. Honest, but blocks a legitimate user.
- (c) Make `users.email` nullable with a partial unique index, and migrate. Most correct, most work: a migration plus a review of every reader that assumes a string.

**D-2 — AI issue triage (H2) · blocks T-025 or T-028**
- (a) Ship the job (T-025 → T-026 → T-027). Delivers the feature the UI already implies.
- (b) Remove the affordance (T-028): drop the badges, the chip labels and the three columns. Cheapest, and the audit's "honesty bug" framing points here.
- (c) Leave as-is. The audit calls this the worst option: the UI advertises a capability that can never render a value.

**D-3 — Indexing truncation (M1) · blocks T-013**
- (a) Partial index plus an "N of M files" badge. Informative; users still get incomplete search.
- (b) Hard-fail above 500 files with a clear message. Honest, but rejects repos the product otherwise handles.
- (c) Raise or remove the cap and accept the cost. Note the `asc(length(code))` ordering means the *smallest* files win, so raising it changes which files get indexed.

**D-4 — Error tracking (M20) · blocks T-020**
- Sentry. Fastest to value, hosted, costs money per event.
- OpenTelemetry Collector. Vendor-neutral, needs a collector to run and a backend to receive.
- Keep console and ship logs to a place that aggregates them. Cheapest, least structure.

**D-5 — Content-Security-Policy (M19) · blocks T-021**
- Report-only first, then enforce (T-021 → T-022). Recommended: a landing page with Clerk, Google Fonts, OpenRouter and Inngest has enough third-party surface that enforcing blind will break something.
- Also: nonce-based or hash-based, and which origins must be allowlisted (Clerk, OpenRouter, Inngest, Vercel, Google Fonts).

**D-6 — Retention policy (M15) · blocks T-023 or T-024**
- (a) Implement the orphan-embedding sweep (T-023). Makes the doc true; adds a real delete job with its own failure modes.
- (b) Correct the doc (T-024). Honest, one hour, and stops the false promise. The retention policy is a promise to users, so this is a product call, not an engineering one.

**D-7 — Embedding rate limiter (M22) · blocks T-058**
- Upstash Redis or a Neon-backed counter. Real cross-instance protection, adds a dependency and a cost.
- Accept `concurrency: 2` plus the provider quota and document the ceiling. Do nothing; the audit's own reading is that the current protection is probably adequate at this volume.

**D-8 — tRPC adapter (M9, M10) · blocks T-038**
- Migrate the client to `@trpc/tanstack-react-query` now. Correct long-term, weeks of churn, and T-039 depends on it.
- Keep the deprecated adapter and pin the version. The deprecated adapter is no longer receiving fixes.

**D-9 — GitHub remotes (M7, L24) · blocks T-041**
- Support SSH and GitHub Enterprise remotes. Real users hit this; it means a parser plus a validator change.
- Fix the docstring to say HTTPS-only. One hour; the current failure mode is an opaque 404 on an SSH URL.

**D-10 — Account deletion (GDPR, §16.30) · blocks T-063 and T-064**
- Soft-delete window length (7 days? 30 days?) and export format (JSON, archive, or emailed link). A window is a promise to users about how long their data survives.

**D-11 — neon-http vs the pooled driver · blocks T-045 and T-018**
- Stay on `neon-http`. No `db.transaction()` ever, so T-045 and T-018 use ordering and event-swap workarounds. Cheapest, and the workarounds are sound.
- Switch to the `neon` Pool for real transactions. Fixes M5 and M17 properly; a connection-pooling change touches every query path and the serverless connection budget.

**D-12 — Backup destination (C1) · blocks T-001**
- GitHub Actions artifact. Zero new infrastructure, but a 30-day cap and 7-day SQL dumps are an awkward fit, and a repo artifact is a weak place for every customer's source code.
- S3 (or equivalent). Correct long-term, needs credentials in CI and a lifecycle policy.
- Neon branch. Native, no dump at all, but a branch is a logical copy rather than a portable artifact.
- Independently: confirm the Neon PITR window and write it down. It is the real backstop and its configuration is currently unverifiable from this repository.

## Suggested execution order (first 10 tasks)

1. **T-003** — two dead hrefs on the primary dashboard. Smallest fix, highest visibility, and nothing depends on it.
2. **T-004** — gunzip error handler. One line, closes a process-crash class.
3. **T-002** — `/api/health` reachable, and the test rewritten to go through the middleware. This is what makes every other operational task observable.
4. **T-006** — refund on retrieval failure. Money, small, and the credit path already has a regression test to extend.
5. **T-007** — refund on commit-summary failure. Same shape as T-006, separate PR on purpose.
6. **T-008** — pin bun in CI. One line, and it makes every CI run reproducible.
7. **T-010** — defer the `GITHUB_TOKEN` throw. Unblocks T-032, which needs the app to boot without a token.
8. **T-009** — delete the two dead API routes. Removes unrated attack surface; also unblocks T-052's header cleanup.
9. **T-011** — dead imports and the unused `baseProcedure`. Pure deletion.
10. **T-014** — `onFailure` on `projectCreated` and `cleanupStaleData`. Copy the `generateEmbeddings` handler.

Then take the decision-blocked work as decisions land: **D-12** unblocks T-001 (the only unrecoverable risk in the audit), **D-1** unblocks T-005, and **D-11** unblocks T-018 and T-045. T-012 and T-013 are worth pulling forward once T-014 is in, because a half-indexed repo showing a green badge is a correctness problem, not a polish problem.

## Newly noticed

Found during verification. Not in the audit. Listed, not tasked — no task below is invented, and each is either folded into an existing task or left as a note.

- **`.env:18` holds a live OpenRouter key under the wrong name.** The value is `sk-or-v1-…`, an OpenRouter key, named `OPENAI_API_KEY`. Untracked and gitignored so it is not a leak, but it is a *misnamed live* secret, not the "dead secret" the audit calls it. Handled in T-044.
- **The README documents 1 of 18 `package.json` scripts.** Only `lint` appears. Handled in T-061.
- **`cleanupStaleData` also lacks an `onFailure` handler.** The audit flags only `projectCreated`; the cron function at `functions.ts:353` has the same gap. Folded into T-014.
- **`docs/operations/backup-retention.md` contradicts itself.** Line 18 says `npm run db:backup`, line 28 says `bun run db:backup`. Handled in T-060.
- **`T-042` is not from the audit's numbered list.** `bun audit` in CI appears in §13's CI/CD readiness line and §9's dependency-risk paragraph without a finding ID; it is scheduled here as its own task because it is a distinct, small, independent change.
- **The Clerk webhook throws a bare `Error` when `CLERK_WEBHOOK_SECRET` is missing.** The 500 body therefore contains a stack trace. This is §9's "Low" security note and is not scheduled separately. Fold it into T-046 (error-shape correctness) if you would rather not leave it.
- **The audit's own line references drift.** M18's preload count and L16's line numbers are both wrong (table above). Anything citing the audit by line number should cite this plan instead.
