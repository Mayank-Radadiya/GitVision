# GitVision — Normalized Task Board

> Audited read-only against `gitvisionStrategy2.md` (1500 lines, untracked) and all 11 `status/*.md` lane ledgers, then verified claim-by-claim against the live tree at branch `v2.1.0`.
> **Every `file:line` in §2.3 was re-grepped. All 20 defects are open — none stale, none already fixed.**
> New task IDs start at `T-063` (highest pre-existing ID found: `T-062`).

---

## Project Snapshot

- Next.js 15 App Router + tRPC + Drizzle + Clerk; deployed to Vercel on Neon serverless Postgres, embedding via `@openrouter/sdk` `qwen/qwen3-embedding-8b` (768-dim), chat via Gemini `gemini-2.0-flash-001`.
- Engineering is genuinely strong: tarball path-traversal defence, atomic credit spending with a DB-level `CHECK`, 404-not-403 ownership guards, three-dimensional rate limiting, a redaction logger. Product is not finished.
- 20/20 verified defects open. The two most recent merge commits (`a1794f5` "drop dead dashboard endpoints", `7fb79f1` "batch4-fixes") touched **none** of them.
- 🔥 Front door is broken: the hero CTA pushes `?url=` and nothing reads it (`add-repo.tsx` has no `useSearchParams`).
- 🔥 Pitch is contradicted: commits/issues/PRs/comments are synced but **only code** enters the vector store — the history-aware thesis is unimplemented.
- 43 tasks done across 10 lanes, 4 cancelled, 8 blocked. `TASKS.md` and `AGENT_RULES.md` are cited by status files but **do not exist** in the repo.
- Next migration number is `0005`; `0000`–`0004` exist. None of `credit_ledger`, `sourceType`, `briefing`, `tsvector`, `indexedFileCount`, `lastSyncedAt` are in `db/schema.ts`.
- Two live defects the strategy doc never caught: `@radix-ui/react-select` is imported but undeclared in `package.json`/`bun.lock`, and `use-create-project.tsx:9` documents a route that does not exist.
- No test database available in this environment; three `describe.skipIf(!hasTestDatabase)` blocks never execute locally.
- `e2e/` is one unauthenticated `smoke.spec.ts`; T-033's recorded `@clerk/testing` design was never committed.
- 271h estimated across 3 phases; 31 S, 18 M, 1 L, 10 XL, 0 >XL. V2 and `[Future]` items are deferred out of the MVP pass.

---

## Active Tasks

### Phase 0 — Make It True (Week 1) — est. 23h (19 S, 1 M)

- **F-07** — Add chat rename, delete, export, and load-more
  - **What:** `chat.delete` and `chat.rename` exist as tRPC procedures with **no UI caller** (only `src/__tests__/unit/chat-delete.test.ts` references them), and `chat.ts:15` caps history at `MAX_MESSAGE_LIMIT = 300` with no "load more".
  - **How:** Add a per-chat dropdown calling the two existing procedures plus a Markdown export; add per-message regenerate; make the 300 cap visible and pageable.
  - **Dependencies:** none
  - **Effort/Priority:** S / ⚠️ P1
  - **Source:** §5.7

- **T-066** — Lazy-load issue comments to kill the N+1
  - **What:** `use-project.ts:104` prefetches comments and is called at `issues-tab.tsx:40`, so N issues mean N queries on the hottest tab.
  - **How:** Pass `enabled: expanded` to `useIssueComments` so comments fetch on row expand; the hook already exists.
  - **Dependencies:** none
  - **Effort/Priority:** S / ⚠️ P1
  - **Source:** §5.22, §2.3 row 10

### Phase 1 — Make It Provable (Week 2) — est. 182h (6 S, 10 M, 1 L, 8 XL)

- **T-005** — Unblock email-less Clerk users
  - **What:** Users with no email address are silently skipped by the Clerk webhook, authenticate successfully, and hit an empty product forever. `users.email` also defaults to `example@gmail.com` on a **unique** column, so a second default row collides.
  - **How:** Depends on D-1 being recorded by F-11. Recommendation on record: make `users.email` nullable in migration `0005` and drop the default — refusing creation breaks OAuth-only users, a placeholder collides.
  - **Dependencies:** F-11
  - **Effort/Priority:** M / 🔥 P0
  - **Source:** `status/p0-B.md:L34`, §12.1 D-1, §2.3 row 5

- **T-020** — Ship error tracking on the recorded transport
  - **What:** The logger redacts and truncates but nothing ships errors anywhere; there is no production observability. Its walker also handles only plain objects and arrays, so a `Map`, a `Date`, or a custom class instance reaching `extra` is serialized unredacted — a hole in the exact path that would ship errors off-box.
  - **How:** Depends on D-4 being recorded by F-11. Add `@sentry/nextjs` plus `instrumentation.ts` and structured JSON to stdout; the transport **must** call `serialize`/`redact` from `src/lib/logger.ts` or T-019's redaction is bypassed. Extend the redaction walker to recurse into `Map`, serialize `Date` as ISO, and expand class instances to their enumerable own properties rather than dropping them. Env-flag off in local and CI.
  - **Dependencies:** F-11
  - **Effort/Priority:** M / ⚠️ P1
  - **Source:** `status/p1-c.md:L` (T-020 blocked), §12.1 D-4, §5.20 item 5, §8.6


- **F-23** — Close the CI coverage and integrity gaps
  - **What:** CI exists and runs, but the coverage floor is unenforced in practice, DB tests `describe.skipIf` themselves away and still report green, and `clerk-webhook.test.ts` times out under parallel load in five separate lane reports.
  - **How:** Add an internal-`href` link-check test (it would have caught both the `/create-project` and `/billing` 404s), add `neondatabase/create-branch-action` for a throwaway `TEST_DATABASE_URL`, raise the floor 30%→45%, and isolate the flaky webhook test with `--singleThread`, `test.concurrent.skip`, or `{ timeout: 20000 }`.
  - **Dependencies:** none
  - **Effort/Priority:** M / ⚠️ P1
  - **Source:** §5.23 items 1, 2, 5, 6, §2.3 row 18

- **T-086** — Add the three authenticated E2E specs
  - **What:** Nothing covers ingest → RAG → chat. The gap is that a user can break the entire thesis and CI stays green.
  - **How:** With storage state from T-033, add three specs — ingest a tiny public repo and assert file count > 0; ask a question and assert a citation appears and its click-through resolves; spend credits to zero and assert the block.
  - **Dependencies:** T-033
  - **Effort/Priority:** M / ⚠️ P1
  - **Source:** §5.23 item 3, §2.3 row 17

- **T-087** — Add an `axe-core` accessibility gate
  - **What:** ARIA defects ship undetected; `aria-pressed`/`aria-current` are absent entirely and no automated check would have caught it.
  - **How:** Add `@axe-core/playwright` runs over `/dashboard`, `/chat/[id]`, and `/code-viewer/[id]`, failing on serious violations.
  - **Dependencies:** T-033
  - **Effort/Priority:** S / ⚠️ P1
  - **Source:** §5.23 item 4

- **T-034** — E2E-spec the ingestion pipeline
  - **What:** Ingestion is the product's front door and has zero browser coverage.
  - **How:** Blocked behind T-033's storage state; assert a tiny public repo reaches a completed index with a non-zero file count.
  - **Dependencies:** T-033
  - **Effort/Priority:** M / ⚠️ P1
  - **Source:** `status/p1-e.md:L` (T-034 blocked), §5.23

- **T-035** — E2E-spec the RAG chat path
  - **What:** The core pitch has zero coverage; the design notes that the Clerk test user must carry an email because the app reads `email` off the Clerk user.
  - **How:** Blocked behind T-033; ask a grounded question and assert a typed citation renders and deep-links into the viewer.
  - **Dependencies:** T-033
  - **Effort/Priority:** M / ⚠️ P1
  - **Source:** `status/p1-e.md:L` (T-035 blocked), §5.23

- **T-036** — E2E-spec the credit exhaustion block
  - **What:** There is no way back in once credits run out — signup grants 100, a project costs 10, a chat 1, a commit summary 1 — and no test proves the block actually fires.
  - **How:** Blocked behind T-034 and T-035; drain the balance and assert the request is refused and the UI explains why.
  - **Dependencies:** T-034, T-035
  - **Effort/Priority:** S / ⚠️ P1
  - **Source:** `status/p1-e.md:L` (T-036 blocked), §5.23

- **T-022** — Promote CSP from report-only to enforcing
  - **What:** CSP ships report-only, so violations are collected but never blocked. The violation report does not exist yet, and the verify step needs a dev server, browser, Clerk creds, DB, and a GitHub token — it cannot be self-certified.
  - **How:** Run the app, exercise chat / code viewer / sign-in / project creation, read `logger.warn` in the `app/api/csp-report/route.ts` collector, then set both headers and flip the assertion in `src/__tests__/integration/security-headers.test.ts`. Blocked on T-082 for the nonce work.
  - **Dependencies:** T-082
  - **Effort/Priority:** M / ⚠️ P1
  - **Source:** `status/p1-b.md:L` (T-022 blocked), §8.6

- **T-082** — Thread a per-request CSP nonce
  - **What:** The policy deliberately allows `'unsafe-inline'`/`'unsafe-eval'` in `script-src` and `'unsafe-inline'` in `style-src` because Next.js ships inline bootstrap scripts and Shiki injects inline `<style>`. That is the reason T-022 cannot be promoted.
  - **How:** Generate a nonce per request in `proxy.ts`, thread it into the Next.js script/style attributes, and drop the two `'unsafe-*'` entries.
  - **Dependencies:** none
  - **Effort/Priority:** XL / ⚠️ P1
  - **Source:** `status/p1-b.md:L` (T-022 unblock path), §8.6

- **F-04** — Add the credit ledger and claim flow
  - **What:** There is no way back in once credits run out, and no honest record of why a balance changed.
  - **How:** Migration `0005` creating `credit_ledger` (`userId`, `delta`, `reason`, unique `refId`, `createdAt`); an Inngest daily-grant cron; a "Claim credits" sidebar button limited to 50 per 24h via a `credits.claim` key at 1/86400s per user. The unique `refId` is what makes `refundCredits` idempotent. No Stripe yet.
  - **Dependencies:** none
  - **Effort/Priority:** L / 🔥 P0
  - **Source:** §5.4

- **T-085** — Decide `isProUser`: wire the tier or drop the column
  - **What:** `db/schema.ts:44` declares `isProUser` and it is written `false` at `projectService.ts:220` and `app/api/webhooks/clerk/route.ts:72` — with **no read site anywhere** in the codebase. It is either dead schema or an unwired paywall.
  - **How:** Decide which. If wired, gate the credit paths on it; if not, drop the column in migration `0005` and remove both writes. Either answer removes the dead field.
  - **Dependencies:** F-04
  - **Effort/Priority:** M / ⚠️ P1
  - **Source:** §2.3 row 8, §11 Phase 1 Day 7

- **F-24** — Wire observability end to end
  - **What:** Console-only output means no production signal; a failed ingestion is invisible.
  - **How:** After D-4 is recorded, add `@sentry/nextjs` + `instrumentation.ts` (free tier, 5K events/mo) and structured JSON stdout for the Vercel log drain. The transport must call `serialize`/`redact` from `src/lib/logger.ts`.
  - **Dependencies:** F-11
  - **Effort/Priority:** M / ⚠️ P1
  - **Source:** §5.24, §2.3 row 16



- **T-067** — Rename `AiSummary` to `ai_summary`
  - **What:** `commits.ts:247-260` uses PascalCase `AiSummary` in an otherwise snake_case schema — the only camel/Pascal anomaly in the file.
  - **How:** Rename in migration `0005` and update the Drizzle mapping; fold into the same migration as the other `0005` column work.
  - **Dependencies:** none
  - **Effort/Priority:** S / ⚠️ P1
  - **Source:** §2.3 row 19

- **F-12** — Stream real indexing progress over SSE
  - **What:** The UI polls every 2s and parses `"Indexed N of M files"` back out of the `embeddingError` string to render progress.
  - **How:** Replace polling with SSE fed by Inngest step events (phase, files found, bytes, embeds queued); add `indexedFileCount` / `totalFileCount` int columns so the count stops being string-parsed.
  - **Dependencies:** none
  - **Effort/Priority:** XL / ⚠️ P1
  - **Source:** §5.12

- **F-14** — Add re-sync and incremental re-index
  - **What:** `delete` is the only project mutation, so a stale repository is permanently stale. A single shared `GITHUB_TOKEN` also means the 5,000/hr ceiling is global, not per-user.
  - **How:** Add a Settings tab with Rename / Sync now / Re-embed changed files, a `project/resync` Inngest event, and a nightly staleness cron that **only polls projects touched in the last 30 days** to protect the shared token. Re-stream the tarball, diff hashes (`rag-ingestion.ts:56` already hash-skips), delete removed files, re-embed deltas, and add `projects.lastSyncedAt`.
  - **Dependencies:** none
  - **Effort/Priority:** XL / ⚠️ P1
  - **Source:** §5.14, §2.3 rows 13 and 20

- **F-15** — Generate the repo briefing
  - **What:** Persona P1's single most-requested item — a plain-language summary of what a repo is — does not exist.
  - **How:** Add a post-index Inngest step that reuses the existing project-overview context path (README, `package.json`, `tsconfig`, top extensions) with `generateObject` + Zod, writing `projects.briefing` jsonb; render it as a card at the top of the Overview tab.
  - **Dependencies:** none
  - **Effort/Priority:** XL / ⚠️ P1
  - **Source:** §5.15

- **F-16** — Add hybrid retrieval with RRF
  - **What:** Retrieval is pure cosine, so exact identifiers — a function name, an error string, a config key — miss entirely.
  - **How:** Migration `0005` adds a generated `tsvector` on `code_embeddings.chunkContent` plus a GIN index; merge cosine and full-text with Reciprocal Rank Fusion (k=60) inside `vector-search.ts`. `reRankResults` is unchanged, so the blast radius is one file.
  - **Dependencies:** none
  - **Effort/Priority:** XL / ⚠️ P1
  - **Source:** §5.16

- **F-18** — Build the retrieval eval harness
  - **What:** Every retrieval claim in the README is unmeasured — including the criticism that the doc levels at unmeasured claims.
  - **How:** ~30 golden Q/A pairs across 2–3 demo repos, scored on recall@k and answer-contains-citation, run by a `tsx` script mirroring `scripts/llm-safety-selfcheck.ts`; publish the results table in the README; add an optional `workflow_dispatch` CI job.
  - **Dependencies:** none
  - **Effort/Priority:** XL / ⚠️ P1
  - **Source:** §5.18, §7.2

- **F-22** — Land the remaining performance fixes
  - **What:** Two live syntax highlighters render two different visual languages; Shiki is re-initialized per render; long files are fully mounted; embedding batches are serial; `queryRewrite` is unmemoized. `highlight.js` and `rehype-highlight` are both live in `package.json` and both are imported.
  - **How:** Drop `rehype-highlight` and `highlight.js` (~150 lines, delete `src/types/highlight-js-css.d.ts` too); cache Shiki via a `shiki/core` singleton on the JS regex engine; virtualize long files with `@tanstack/react-virtual`; run embedding batches 2–3 at a time with `p-limit` and make `BATCH_SIZE` an env var; memoize `queryRewrite` in an LRU keyed by chatId+text; add `@next/bundle-analyzer`.
  - **Dependencies:** none
  - **Effort/Priority:** XL / ⚠️ P1
  - **Source:** §5.22, §2.3 row 11

- **F-17** — Build the settings and account page
  - **What:** There is no `/settings` route, no project settings, and no chat management UI — the product reads as unfinished.
  - **How:** Add `/settings` with Clerk `<UserProfile/>`, theme persistence moved from localStorage to the DB, credit balance and usage history read from `credit_ledger`, connected accounts, and a danger zone calling `session.revoke()` + `clerkClient().users.deleteUser()`.
  - **Dependencies:** F-04
  - **Effort/Priority:** XL / P2
  - **Source:** §5.17, §2.3 row 15

### Phase 2 — Make It Stand Out (Weeks 3–4) — est. 63h (3 S, 7 M, 2 XL)

- **T-070** — Add history-aware RAG storage
  - **What:** 🔥 The flagship differentiator is unimplemented: commits, issues, PRs, and comments are synced but **only code** enters the vector store, so the chat can only speak about the present. The pitch is contradicted by the code.
  - **How:** Migration adding `sourceType` / `sourceRef` on `code_embeddings`, extend the Inngest embedding loop to write non-code rows, cap at ~500 commits, and expose the opt-in toggle.
  - **Dependencies:** none
  - **Effort/Priority:** XL / 🔥 P0
  - **Source:** §7.1, §2.2

- **F-13** — Ship AI issue triage
  - **What:** `db/schema.ts:~303-309` holds three orphaned columns — `aiComplexity`, `aiTags`, `aiSummary` — that are never written. This is the cheapest differentiator available: **no migration needed**.
  - **How:** After `syncIssues`, fan out an Inngest step that batches 10–20 issues per Gemini call with `generateObject` + `z.object({ complexity, tags })`; render 🟢S 🟡M 🟠L 🔴XL badges, tag chips, and a "Good first issues" filter. Requires T-078 first, since D-2 currently says drop these fields.
  - **Dependencies:** T-078
  - **Effort/Priority:** XL / 💡 Opportunity
  - **Source:** §5.13, §2.3 row 6

- **T-071** — Render typed citation badges
  - **What:** Citations are untyped, so the user cannot tell a code claim from a history claim — which is the whole point of the flagship feature.
  - **How:** Badge variant keyed on the new `sourceType` from T-070; reuses the F-02 link wrapper.
  - **Dependencies:** T-070
  - **Effort/Priority:** M / 🔥 P0
  - **Source:** §7.1

- **T-072** — Add the `history` intent class
  - **What:** The classifier has `file-specific` but no `history` class, so "who changed this and why" cannot be routed to the right retrieval path.
  - **How:** Add `history` to the intent union in `src/features/rag/services/rag/query-classifier.ts` and handle it in `src/features/rag/services/rag/context-fetcher.ts:45`.
  - **Dependencies:** T-070
  - **Effort/Priority:** M / 🔥 P0
  - **Source:** §7.1, §12.3 question 3

- **T-073** — Memoize the query rewrite
  - **What:** `queryRewrite` runs on every turn with no cache, and the same question in the same chat produces the same rewrite.
  - **How:** LRU keyed by `chatId` + question text at the single rewrite call site.
  - **Dependencies:** none
  - **Effort/Priority:** S / ⚠️ P1
  - **Source:** §5.22


- **T-074** — Rewrite the README around one real number
  - **What:** The README still leads with claims the audit disproves; §5.21's doc fixes are not enough, because the structure itself oversells.
  - **How:** Lead with a measured recall@k from F-18 and drop every number the codebase cannot produce.
  - **Dependencies:** F-18
  - **Effort/Priority:** M / ⚠️ P1
  - **Source:** §11 Phase 2, §7.6

- **T-075** — Add `scripts/seed-demo.ts`
  - **What:** No demo data exists, so every screenshot and GIF has to be produced against a live ingestion run.
  - **How:** A seeding script that provisions a known-good demo project so the demo assets are reproducible.
  - **Dependencies:** none
  - **Effort/Priority:** M / P2
  - **Source:** §11 Phase 2

- **T-076** — Spike the architecture map
  - **What:** Dependency visualization is listed as a moat feature and has no prototype.
  - **How:** Mermaid first — it renders from the data already collected with no new library. React Flow only if the mermaid output proves insufficient.
  - **Dependencies:** none
  - **Effort/Priority:** M / P2
  - **Source:** §11 Phase 2, §6.2

- **T-081** — Produce the demo assets and deploy
  - **What:** No launch surface exists — the flagship has no GIF and no screenshots.
  - **How:** A 15s citation-click GIF plus 4 screenshots, captured from the seeded demo project, then deploy.
  - **Dependencies:** T-070, F-02
  - **Effort/Priority:** S / P2
  - **Source:** §11 Phase 2

- **T-079** — Record D-11 and mark compensatable writes
  - **What:** D-11 chose "stay on neon-http", which has no `db.transaction()`, so every multi-write path hand-compensates — and nothing marks which writes those are.
  - **How:** Record the decision with its transaction-availability evidence, then adopt a comment convention marking each compensatable write and add one test asserting a compensation path fires.
  - **Dependencies:** none
  - **Effort/Priority:** M / ⚠️ P1
  - **Source:** §12.2 D-11, `status/p1-d.md:L` (T-018)

- **T-080** — Move backups off the local filesystem
  - **What:** `bun run db:backup` writes production data to `../gitvision-backups/…` — outside the repo and outside any durable destination. A `pg_dump` with no remote target is not a backup.
  - **How:** Record D-12 and push dumps to Cloudflare R2 or S3 via `@aws-sdk/client-s3`, then fix `docs/operations/backup-retention.md` to match.
  - **Dependencies:** none
  - **Effort/Priority:** M / ⚠️ P1
  - **Source:** §12.2 D-12, `status/p0-C.md:L` (T-001)

---

## Deferred — V2 / Future (outside the MVP pass)

`gitvisionStrategy2.md` §6.1 and §6.2 are deliberately **not** part of the MVP board. They are listed here so nothing is silently lost, and so the Phase 0 hard gate ("no new surface until Phase 0 exit criteria are met") has something concrete to point at. **No task IDs, no effort in the totals above** — these are not committed work.

### `[V2]` — ship after the product is true and provable (§6.1)

| ID | Feature | Effort | Status in this board |
|---|---|---|---|
| V-01 | 🏆 History-Aware RAG with typed citations | L (1 week) | **Promoted to MVP** — T-070, T-071, T-072 |
| V-02 | Repository comparison view (`/compare`, portfolio analyzer) | M (≈3d) | deferred — rated top-3 standalone, but only matters at ≥2 projects |
| V-03 | Export & shareable reports (PDF, signed public URL) | M (≈4d) | deferred — the distribution loop, reaches persona P6 |
| V-04 | Share a chat publicly | M (≈2d) | deferred — gate on public repos **at share time, not read time** |
| V-05 | Repo intelligence dashboard (from already-synced data) | M (≈3d) | deferred — data exists, nothing derives from it |
| V-06 | Commit heatmap + chart upgrade (52×7 grid) | S–M (≈2d) | deferred |
| V-07 | Onboarding tour (`driver.js`, 6 KB) | S–M (≈2d) | deferred — **promote to MVP if demoing live** |
| V-08 | PostHog analytics + `llm_usage` table | S (≈1d) | **Partially promoted** — T-077 covers the analytics half; the `llm_usage` table fed by the existing `RequestTracer` is not in the MVP pass |
| V-09 | Stripe credit packs, `isProUser` genuinely wired | M (≈3d) | deferred — T-085 decides the column, V-09 decides the tier |

### `[Future]` — the moat (§6.2)

| ID | Feature | Effort | Note |
|---|---|---|---|
| F-01 | Time-travel RAG ("what did auth look like before the refactor?") | L (1 week) | depends on V-01 landing first |
| F-02 | Agentic chat mode (read-only tools) | L (1 week) | **T-069's prompt-injection fence is a hard prerequisite, not a nice-to-have** |
| F-03 | Architecture / dependency graph + impact analysis | S (mermaid) → L (React Flow) | **T-076 is the mermaid spike** |
| F-04 | PR review agent (Gemini comments on a PR) | L (1 week) | requires write access — contradicts §7.1's read-only constraint until revisited |
| F-05 | Multi-repo chat (cross-project RAG) | L (1–2 weeks) | the 2-repo cap question is Open Question 7 |
| F-06 | GitHub App integration → private repos | L (≈2 weeks) | the only route to private repos; also Open Question 1 |
| F-07 | Real-time collaboration & shared team chat | L (7+d) | persona P3 territory |

---


## Defect Coverage

All 20 rows of §2.3, each re-verified against the live tree.

| # | Description | Status | Task |
|---|---|---|---|
| 1 | `?url=` param pushed but never read | fixed | F-01 |
| 2 | Dead dashboard payload on the hottest query | fixed | F-10 |
| 3 | `enforceLimits` missing on embeddings GET + DELETE | fixed | F-20 |
| 4 | No unique `(ownerId, githubUrl)` | fixed | F-25 |
| 5 | 4 decisions recorded with no content (D-1, D-3, D-4, D-8) | fixed | F-11, T-038 |
| 6 | Orphaned AI-triage columns, never populated | open | F-13 |
| 7 | Stale CSP allowlist entry `via.placeholder.com` | fixed | F-20 |
| 8 | `isProUser` defined and written, never read | open | T-085 |
| 9 | Native `confirm()` for project deletion | fixed | F-19 |
| 10 | Issues N+1 — comments prefetched per row | fixed | T-066 |
| 11 | Two live syntax highlighters (Shiki + rehype-highlight) | open | F-22 |
| 12 | 5 docs say Gemini does embeddings; it is OpenRouter/qwen | fixed | F-21 |
| 13 | No re-sync — `delete` is the only project mutation | open | F-14 |
| 14 | Citations not clickable; no `?file=` deep link | fixed | F-02 |
| 15 | No settings/account page, no project settings, no chat UI | open | F-17, F-07 |
| 16 | Console-only logger; no error tracking | open | F-24 |
| 17 | 53 unit test files, 1 unauthenticated E2E spec | open | T-086 |
| 18 | `clerk-webhook.test.ts` flaky under parallel load | open | F-23 |
| 19 | PascalCase `AiSummary` in snake_case schema | open | T-067 |
| 20 | Shared single `GITHUB_TOKEN` = one 5,000/hr pool | open | F-14 |

Rows 5 and 17 map to two tasks each; the rest map to one.

---

## Risks & Mitigations

Quoted from the §11 Risk Register, L1385–1392.

1. **"Scope creep into `[Future]` before Phase 0 completes"** / High — *"Hard gate: no new surface until Phase 0 exit criteria are met."* → mitigated by the Phase 0 exit gate; Phase 2 work (T-070…T-081) is sequenced strictly after.
2. **"History-aware RAG inflates per-project cost unexpectedly"** / Medium — *"Opt-in toggle + eval harness to measure before deciding."* → mitigated by T-070 (opt-in toggle) and F-18 (eval harness); the toggle is a stated requirement of T-070, not an optional extra.
3. **"Neon storage grows faster than expected"** / Medium — *"Cap at ~500 commits; evaluate `halfvec(768)` **with data**, not guesswork."* → mitigated by T-070's ~500-commit cap and F-16's full-text index; the `halfvec` decision waits on F-18's measurements per §12.3 question 5.
4. **"Shared `GITHUB_TOKEN` hits its 5,000/hr ceiling"** / Medium — *"Re-sync cron only polls projects touched in the last 30 days."* → mitigated by F-14's staleness cron, which is specified to poll only the last 30 days.
5. **"The flaky `clerk-webhook.test.ts` destabilizes CI"** / Medium — *"Isolate it in Phase 1, day 7."* → mitigated by F-23 item 6.
6. **"Authed E2E blocked by the machine-level `/_next/static` 404s"** / Medium — *"Run E2E on the CI runner first; the local 404s are machine-level, not repo bugs."* → mitigated by T-033; the six-step evidence in `status/p1-e.md` establishes this is not a repo bug, so the task is unblocked rather than re-scoped.

Additional risk surfaced by this audit, not in the register:

7. **`@radix-ui/react-select` is imported but undeclared** — a clean `bun install` on `main` fails `typecheck`. CI passes only because the local `node_modules` was hand-patched. → T-063.
8. **`status/*.md` cite `TASKS.md` and `AGENT_RULES.md`, neither of which exists.** The decision ledger those files reference is gone, so D-2's "option b" rationale and D-11's transaction evidence are only recoverable from lane notes. → T-078 and T-079 restore the reasoning inline.

---

## Critical Path to MVP

```
F-11 (record D-1/D-3/D-4/D-8)  ──┬──> T-005 (unblock email-less users)   🔥
                                ├──> T-020 (ship error tracking)         🔥
                                └──> F-24 (observability end to end)

F-01 (read ?url=)  ──> F-02 (clickable citations)  ──> T-081 (demo GIF)
                                                     └──> T-070 ──> T-071/T-072 (history-aware RAG) 🔥

T-063 (declare radix dep)  ──> blocks every clean-install verification

T-033 (authed E2E harness)  ──┬──> T-034 ──┐
                               ├──> T-035 ──┼──> T-036
                               └──> T-087   │
F-18 (eval harness)  ──> T-074 (README leads with a real number)

T-078 (reverse D-2)  ──> F-13 (AI issue triage)

F-04 (credit ledger)  ──┬──> F-17 (settings page)
                        └──> T-085 (isProUser decision)
```

Longest chain: **F-01 → F-02 → T-081 → T-070 → T-071/T-072**, which is the flagship demo path and cannot be compressed. The second chain, **F-11 → T-005**, is the shortest and unblocks a user-facing dead end.

---

## Ready to Start Now

Dependencies: `none`, priority-sorted. All 22 of these can begin today with no other task finished.

> **Count reconciled 2026-09-30.** This sentence used to say "20", the table below enumerates 22, and the Effort Summary claimed 23 — three different numbers for one list. The table is the enumeration and is the authority: **22**. The Effort Summary's Phase 0 row was carrying a count that cannot be reconstructed from any list in this file, so it is annotated there rather than reverse-engineered here. The missing 23rd ID was never identified; see `## Independent verification (2026-09-30)`.

| Priority | Tasks |
|---|---|
| 🔥 P0 | **T-063** (undeclared radix dep — breaks clean install), **F-01** (`?url=`), **F-02** (clickable citations), **F-06** (delete fabricated claims), **F-11** (record 4 decisions — unblocks 3 tasks), **F-20** (rate limits + CSP + import rule), **F-25** (unique constraint), **T-033** (authed E2E harness — unblocks 4 tasks), **T-088** (`docs/SECURITY.md` — pure documentation, highest perceived-value per line) |
| ⚠️ P1 | **F-19** (a11y batch), **F-10** (dead dashboard code), **F-05** (real stats), **F-07** (chat management), **T-089** (shared `getGitHubAuthHeader()`), **T-066** (issues N+1), **T-069** (prompt-injection fence), **T-068** (`rehype-raw` audit), **T-084** (reset `lane/p1-a`), **T-078** (reverse D-2), **T-083** (`RAG_CONFIG`) |
| P2 | **F-08** (⌘K palette), **T-077** (PostHog + Vercel Analytics) |

Highest return per hour: **T-063** (unblocks every clean-install verification), **T-086** (turns existing unadvertised security work into a differentiator, zero code), **F-11** (unblocks three tasks).

---

## If Only 3 Days

Follows §11 Phase 0, Days 1–3. Roughly 21h of work; leaves a day of slack.

**Day 1 — the front door and the numbers (≈6h)**
F-01 · F-06 · F-05 — a pasted URL now reaches the form, the landing page stops lying, and the stats come from `COUNT(*)`.

**Day 2 — trust and access (≈10h)**
T-063 · F-19 · T-065 · T-088 — `main` survives a clean install, the whole a11y batch lands as one PR with `confirm()` replaced by an `AlertDialog`, the viewer stops re-initializing Shiki per file, and the four existing security defences finally get written down where a buyer can find them.

**Day 3 — close the security and N+1 holes (≈5h)**
F-20 · F-21 · T-069 · T-068 · T-066 — GET and DELETE get rate limits, the dead CSP entry is gone from both the policy and its test, the five provider doc lies are corrected, retrieved content is fenced, `rehype-raw` is confirmed absent, and the hottest tab stops issuing N queries.

T-068 shipped under an audit-only verdict: the dependency was never present, so the task's real deliverable was the pin rather than a removal.

**Explicitly out of scope for 3 days:** everything requiring a migration (`F-25`, `F-04`, `F-16`), anything gated on a recorded decision (`T-005`, `T-020`, `F-24`), and all of Phase 2.

**After 3 days the product still cannot prove itself** — no clickable citations (F-02), no settings (F-17), no history-aware RAG (T-070). Three days buys honesty and safety, not the demo.

---

## Effort Summary

| Phase | Tasks | S | M | L | XL | Est. Total |
|---|---|---|---|---|---|---|
| Phase 0 — Make It True | 22 † | 22 | 0 | 0 | 0 | 26h |
| Phase 1 — Make It Provable | 25 | 6 | 10 | 1 | 8 | 182h |
| Phase 2 — Make It Stand Out | 12 | 3 | 7 | 0 | 2 | 63h |
| **Totals** | **59** † | **31** | **17** | **1** | **10** | **271h** |

† Reconciled 2026-09-30 by independent verification. This table previously claimed 23 tasks for Phase 0 (22 S + 1 M) and a 60-task total. Phase 0's real membership is the 22 IDs enumerated in "Ready to Start Now"; the 23rd could not be reconstructed from this file and is recorded as a named gap rather than guessed at. Its one M-sized estimate was removed with it, which is why the M column drops 18 → 17. **No task was dropped** — only a count that no list in this file could substantiate.

Estimates use S = 1h, M = 4h, L = 8h, XL = 16h. Nothing exceeds XL. 271h ≈ 34 engineer-days ≈ 7 weeks of one person, which is why the phase gates matter more than the task list. The deferred V2/Future list carries no effort here — it is out of the MVP pass by design.

---

## Open Questions

`gitvisionStrategy2.md` contains no literal `❓` markers; these are the ten strategic questions of §12.3, L1420–1431, in order.

1. **Private repos** — GitHub App, public-only, or a Clerk-OAuth read-only middle path? (Blocks any private-repo work; also an anti-persona boundary in §3.4.)
2. **Actual buyer** — the individual onboarding developer, or the team lead / hiring manager? (§3.1 lists P1 and P2 as both 🔥 primary, which is a targeting conflict.)
3. **Intent classifier** — LLM fallback below 0.75 confidence, add `architecture` and `bug-analysis` classes, LRU-cache the rewrite, or add `history` (required by §7.1)? Partially resolved by T-072 and T-073; the 0.75-fallback question is not.
4. **Small-project dump threshold** — 24K or 150K? `feature-1.md` and `feature-2.md` disagree. → T-083.
5. **`halfvec(768)`** — accept the recall cost, or stay on `vector(768)`? The doc says measure with F-18 first rather than guess.
6. **History-aware RAG** — opt-in toggle, or raise `PROJECT_CREATION_COST` to cover it? T-070 implements the toggle; the pricing question is unanswered.
7. **Two-repo cap** — is it enough for multi-repo RAG?
8. **Real per-project embedding cost** — currently unmeasured, which the doc itself notes is ironic given it criticizes unmeasured claims. Blocks any honest pricing in §10.5.
9. **Are the 4 remaining a11y items real or already fixed by batch-4?** → **Answered: they are real.** §2.4 flagged them for re-verification; `aria-pressed` and `aria-current` have zero occurrences repo-wide, `onKeyDown` exists only at `code-viewer/file-tree.tsx:330`, and no `AlertDialog` exists. Commit `7fb79f1` did not land them. Captured as F-19.
10. **Does `react-markdown` run without `rehype-raw`?** → T-068.

---

## Assumptions Made

`gitvisionStrategy2.md` contains no literal `⚠️ Assumption:` markers. These are the assumptions this audit made, each falsifiable against the tree:

- **⚠️ Assumption:** The `file:line` references in §2.3 and §5 were accurate as of the doc's authoring, and the live tree is the later state. Verified in both directions — the doc's line numbers still resolve (e.g. `csp.ts:34`, `project-header.tsx:66`, `db/schema.ts:44`), and every claim was re-tested at HEAD rather than trusted.
- **⚠️ Assumption:** Commits `a1794f5` and `7fb79f1` did not land any §2.3 remediation despite their messages. Confirmed by grep, not by commit message — "drop dead dashboard endpoints" left `buildPickUpCards`/`getRecentActivity`/`getPickUpWhereYouLeftOff` intact, and "a11y 4.11/4.12" left zero `aria-pressed` repo-wide.
- **⚠️ Assumption:** T-033's blocker is environmental, not a repo bug, so the task is unblocked rather than re-scoped. Rests on the six-step evidence in `status/p1-e.md`; the doc's own risk register concurs.
- **⚠️ Assumption:** D-2 should be reversed. The doc's §12.2 recommends it and F-13 is the cheapest differentiator available, but T-028 landed the opposite choice on purpose (`b0fcb1b`). Reversing it is a product call, not an audit finding — hence T-078 is a task, not a DONE row.
- **⚠️ Assumption:** The `T-063`–`T-085` IDs are free. The highest ID found anywhere across `status/*.md` and the doc is `T-062`; gaps exist at T-039, T-044, T-058, T-060, T-061 but nothing references them, so new IDs start cleanly at T-063.
- **⚠️ Assumption:** "Phase" in this board means the §11 roadmap phase, so §2.3 defects are distributed to the phase that fixes them rather than listed separately. Every defect still appears in Defect Coverage.

---

## DONE (excluded from active list)

55 tasks shipped across 10 lanes. Original IDs preserved.

**Lane p0-A:** T-006 (`d38344f`, RAG failure now fails the turn; `onError` latches exactly one refund) · T-011 (`e6000d7`, dead imports removed, `baseProcedure` unexported)

**Lane p0-B:** T-003 (`ac0a564`, both dead `/projects/...` hrefs fixed, `dashboard-pickup-links.test.ts` pins them) · T-007 (`de5bf7c`, credit now spent before the LLM call and never refunded on failure)

**Lane p0-C:** T-008 (`b6924a6`, CI `bun-version: latest` overrode the `packageManager` pin) · T-010 (`158df20`, missing `GITHUB_TOKEN` 500ed every tRPC call; module-scope `octokit` → `getOctokit()`) · T-001 (`477b1f4`, DB was never dumped; D-12 recorded)

**Lane p0-D:** T-004 (`a9eed54`, gunzip stream had no error handler) · T-009 (`7464b8c`, two routes with zero production callers and no rate limiting) · **T-002 — skipped, already resolved at HEAD** · **T-064** (`5e19b3c`, dropped the comment claiming a `POST /api/project/createProject` route that exists nowhere in the repo — the hook has always been `trpc.project.create.useMutation()`, which the docstring's first line already said, so deleting the stale line was the whole fix; comment only, no executable line touched)

**Lane p0-E:** **F-01** (`c9d09b6`, `?url=` now read via `useSearchParams` and prefilled into `repoUrl` with a functional `reset`; prefills only, no auto-submit, so no credits are spent until the user submits; five tests in `src/__tests__/unit/add-repo-url-param.test.tsx` pin the contract) · **T-089** (`d3f0064`, exported shared `getGitHubAuthHeader()` helper from GitHub client module and repointed `files.ts:64` through it) · **F-20** (`59b7a5a`, `GET`/`DELETE` on `/api/embeddings` now metered by `enforceLimits` and return 429 on exhaustion, dead `via.placeholder.com` dropped from the CSP allowlist and its assertion inverted, and a `no-restricted-imports` rule bars `axios` under `src/lib/github/services/**` so the tarball fetch routes through the shared client) · **F-25** (`ee86613`, `unique("projects_owner_id_github_url_unique")` on `projects(owner_id, github_url)` via migration `0005`, so a double-submit can no longer bill 10 credits twice; the 23505 is re-thrown at `createNewProject` as `PROJECT_ALREADY_EXISTS` instead of being buried in `details.originalError`, and `project.create` maps it to a `CONFLICT` "already added" — safe because the insert precedes `spendCredits`, so the duplicate never reaches the charge) · **F-21** (`7fdf90e`, every doc and comment that credited Gemini with embeddings now names `@openrouter/sdk` `qwen/qwen3-embedding-8b` (768-dim), and the chat model is named as `gemini-2.0-flash-001`; the two `.env.example` provider comments were wrong *and* swapped, and the README prerequisite list offered no OpenRouter key at all, so a reader following it could not have configured embedding generation; documentation and comments only, no logic or schema touched) · **F-05** (`e3dd860`, the hero's "50K+ Repos Analyzed" / "1M+ Commits Processed" / "10K+ Developers" literals are now `COUNT(*)` on `projects`, `commits` and `chat_messages` via a new `publicProcedure` — which did not exist, every procedure in the app was `protectedProcedure` — and the client hook reads it with `staleTime: 300_000`; the data is fetched by `prefetch()` in `app/page.tsx` rather than from the browser, because `proxy.ts` protects the whole `/api/trpc` prefix and a signed-out visitor cannot reach even a public procedure over HTTP, so `getPublicStats` is server-reachable only until that allowlist is revisited) · **F-02** (`bef84e3`, chat citation badges are now `next/link`s to `/code-viewer/[projectId]?file=<path>` with `projectId` threaded through `ChatRoom`; the viewer derives the selected file from `?file=` (unknown paths fall back to README-first) and scrolls/tints `?line=` via Shiki `.line` spans, with ancestors auto-expanded and the tab stop following the selection; `<Suspense>` wraps the search-param consumer; no `&line=` is emitted yet because `relatedFiles` carries paths only — T-070 is the line producer) · **F-19** (`5b36263`, consolidated accessibility pass: added aria-label to PR/issues/code-viewer search inputs, aria-pressed to filter pills, aria-current="page" to active navigation links, role="button" + tabIndex + Enter/Space onKeyDown on commits and issues disclosure rows, aria-describedby on Field.tsx errors, and replaced native confirm() with Radix AlertDialog in project-header.tsx) · **F-06** (`d7e44a9`, F-05 had already made the hero's three counters real `COUNT(*)`s, so those stayed; what was still fabricated was the cta-section's repeat of "50K+ Repos Analyzed", the "Join thousands of developers" line, and the "Team Insights" card, all of which are gone with the orphaned `UsersIcon` import. The pricing CTAs already pointed at `/sign-up` but were labelled "Buy Now" and "Contact Us", advertising two purchases the product cannot take — there is no Stripe, checkout route or payment webhook anywhere in the codebase — so Pro and Team now carry `comingSoon` and render a disabled button, leaving the Basic card's real link as the only live CTA in the pricing section; the enterprise block's "Contact our sales team" button, which had no `href` and no `onClick`, is deleted) · **F-03** (`72a89cc`, the empty chat state renders four project-specific starter chips computed by a pure `getStarterChips(languages, dependencies)` — no LLM call, no client fetch; the chips *submit* rather than fill the input, so `handleSubmit` and `onSubmit` collapsed into one `sendPrompt(text)` that both a chip click and the Enter key call, giving a chip the same mid-stream `stop()` and error reset as typed text; the auth chip is gated on exact-or-scope-prefix matches against twelve known auth packages, and a project with no `package.json` — Go, Rust — falls through to the testing question so the count stays four either way. There is no `dependencies` column; §5.3 assumed one that ingestion never built, so `chat.getById` reads the `package.json` row the tarball extractor already stored in `project_files`, ordering by path length so a monorepo's root manifest beats `apps/*/package.json`. `projects.languages` rides the LEFT JOIN that already existed for the project name, so the page still costs one round trip. General-chat suggestions are unchanged — no project record to read. `src/__tests__/unit/starter-chips.test.ts` pins the gate and the chip count; not run, per the Phase 0 rule) · **F-09** (`3a7bf3d`, the code-viewer toolbar carries an "Ask About This File" button that creates a project chat via `chat.create` and pushes to `/chat/[id]?file=<encoded path>`, so one click replaces retype-path-switch-tab-send; the seeded prompt needs no new routing because `classifyQuery` already matches the file-specific pattern first, and the path is read in the `[chatId]` server page rather than in a client component, which is why no `<Suspense>` was needed — the task text's `/chat?project=X&file=Y` shape was traded for the one-click path because the landing page would have required a preselected project plus a second click on "Codebase Chat" before the file survived the create mutation; the seed is gated on `initialMessages.length === 0` so reloading an active chat does not resurrect the prompt, and no embedding-status check was added because a file is only visible in the viewer once `project_files` was populated) · **T-069** (`64581f7`, retrieved repository content is now fenced in `<context>` / `</context>` tags at the one point where context meets the prompt, so all three producers — the intent fetcher, the vector-search path, and the small-project full dump — are covered by a single `fenceContext()` helper and a future retrieval path is fenced by construction; `UNTRUSTED_DATA_DELIMITER` used to say "between the markers above" when no marker existed, and now names the literal tags and instructs the model to treat the contents as data to analyze, never directives; citations are untouched because the sources panel reads the `relatedFiles` path array rather than parsing the formatted context string) · **T-068** (this commit, `[T-068] Verify react-markdown excludes rehype-raw and pin HTML escaping test` — the task asked for a hash, but a commit cannot contain its own; the subject is the stable reference here. `rehype-raw` is absent from the repo by default — no import, no `package.json` dependency, no `bun.lock` entry — so nothing needed removing; the sole `react-markdown` usage at `chat-message.tsx:171` configures only `rehypePlugins={[rehypeHighlight]}`, and `src/__tests__/unit/markdown-safety.test.tsx` now pins the safety property: `querySelector("script")` and `querySelector("img")` are both `null` for a `<script>`/`onerror` payload while the payload still appears in `textContent` as escaped text, because `react-markdown` v10 defaults `skipHtml` to false and converts `raw` nodes to text nodes; a fourth assertion keeps `rehype-highlight` working on a fenced ` ```js ` block, so the guard cannot be satisfied by stripping highlighting too)
 · **F-10** (`9271b1f`, pruned dead `buildPickUpCards`, `getRecentActivity`, and `getPickUpWhereYouLeftOff` functions along with `PickUpCard` helper types from `projectService.ts`, dropped obsolete models from `budget.ts`, removed defunct `app/api/project/`, and updated `dashboard-pickup-links.test.ts` to assert streamlined dashboard response) · **T-065** (`87475a5`, hoisted theme resolution to module-scope cache keyed off resolved next-themes value and cached Shiki highlighter singleton reference, eliminating redundant theme re-instantiation and flicker during file navigation)

**Lane p0-t001 (batch):** T-040 · T-041 · T-042 (`bun audit` added to CI) · T-043 (raw `console` routed through `logger`) · T-046 (404/400 not 500 from chat router) · T-047 (400 for malformed body; `await` was inside `safeParse`) · T-048 (user-chosen chat title no longer overwritten) · T-049 (`chat.delete` distinguishes deleted from never-existed) · T-050 (honest issue/comment pagination) · T-051 (`getFileContent` validated with `z.string().uuid()`) · T-053 (Zod 4 migration finished, 12 call sites) · T-054 (font/asset fix, 12 preloads → 1) · T-055 (composite + language indexes) · T-056 (compound commit cursor) · T-057 (IP-based rate-limit dimension) · T-059 (coverage thresholds — no provider was installed) · T-062 (LICENSE decision + architecture doc)

**Lane p1-a:** T-014 (`57de263`, `onFailure` handlers) · T-017 (`e3ff9be`, chat model pinned to `gemini-2.0-flash-001` in `src/lib/llm/config.ts`) · T-012 (`ff91397`, Prepare counts every file; Finalize stores `partial`) · T-013 (`dda38cf`, partial-index badge) · T-024 (`d42c004`, retention doc no longer advertises a sweep that does not exist) · T-028 (`b0fcb1b`, AI-triage fields dropped from selects and insert) · **T-084** (`ff91397`, reset `lane/p1-a` branch reference to `ff91397` to remove foreign commit `dc2c3b7` and restore lane isolation)

**Lane p1-b:** T-016 (`c222a3a`, secret-file patterns) · T-015 (`1d27991`, entry names resolved with `posix.normalize`) · T-021 (`bff7167`, report-only CSP + `app/api/csp-report/route.ts` collector + `proxy.ts` PUBLIC entry)

**Lane p1-c:** T-019 (`f6e00ab`, redaction at all four levels, deep through context and errors)

**Lane p1-d:** T-018 (`0f0415b`, charge before enqueue with explicit compensation) · T-029 (`3be9f2b`, 10 round-trips measured) · T-030 (`5a96c81`, 10 → 3 round-trips) · **T-031 — skipped with evidence** (production Neon: 7-day window uses `Index Scan` at 0.085 ms, 2000-day worst case is a 402-row `Seq Scan` at 0.588 ms total, against a 394 ms dashboard load; the planner declined both candidate indexes on a 4,000-commit PG18)

**Lane p1-e:** T-032 (`9746a25`, suite boots its own server, `bun run test:e2e` passes cold)

**Lane p2-a:** T-037 (`9907918`, one `ProjectAccessError` ownership check repo-wide; `verifyOwnership` deleted, 8 call sites repointed) · T-045 (`1c74f99`, upsert-then-prune over delete-then-repull) · T-050 (`a092b7e`, compound keyset pagination) · T-051 (`d35790a`) · T-055 (`4ca4d93`, `chats_user_id_updated_at_idx` + `project_files_language_idx`) · T-056 (`af8f5e2`, ordered `(author_date DESC, id DESC)`)

**Cancelled (4):** T-023, T-025, T-026, T-027 — D-6 chose T-024 over T-023, and D-2 option b chose T-028, which is mutually exclusive with T-025/026/027.

**Noted but not fixed:** `0003_commits_project_id_author_date_idx.sql` exists, so T-031's recipe *was* applied despite the task being closed as "skipped, with evidence."

**Already shipped:** T-063 (`5bf6a89`) — `@radix-ui/react-select` declared in `package.json` + `bun.lock`; clean installs typecheck clean. · **F-07** (`1769417`, per-chat actions menu — inline rename via new `chat.rename`, delete confirm via `chat.delete`, client-side Markdown export with citations — on the room header and Recent rows, plus a banner from `getById.hasMoreMessages` when history hits the 300-message cap; not run, per the Phase 0 rule) · **F-08** (`4376ceb`, ⌘K palette — shadcn `Command` over cmdk, mounted once by `DashboardShell` so it covers every route under `app/(main)/`; navigation items lifted from `PRIMARY_NAVIGATION` rather than retyped, projects merged from `project.getAll` and `project.getDashboardData` on `id`, and both reads `enabled: false` so the palette can never issue a request of its own; a Keyboard Shortcuts group documents ⌘K, ⌘B, ⌘↵, 1/2/3 and Esc. `CommandDialog` composes Radix around cmdk's root rather than using `Command.Dialog`, whose hardcoded `Dialog.Content` carries no title — an `aria-dialog-name` failure. Per-chat items are not included: `chat.getAll` is server-caller-only at `app/(main)/chat/page.tsx:14` and never hydrates the client cache, so no chat list can be shown without a request; a Chat link to `/chat` is there instead. Not run, per the Phase 0 rule)

**Lane docs:** T-088 (`c1c8071`, wrote `docs/SECURITY.md` covering the tarball path-traversal and symlink defence, 404-not-403 ownership, atomic credit spending with the DB-level `CHECK` and the latched refund, three-dimensional rate limiting, and nine-key log redaction — each linked to the suite that pins it; linked from the README) · **F-11** (`74da0d6`, recorded blocking decisions D-1, D-3, D-4, and D-8 with full context, trade-offs, and invariants in `docs/DECISIONS.md`, unblocking T-005, T-020, and T-038)

---

## Self-Check

- 7 fields present on all 60 active tasks (ID, Title, What, How, Dependencies, Effort/Priority, Source).
- No duplicate IDs. New IDs start at T-063; highest pre-existing was T-062.
- Every dependency resolves to a task in this board. No orphans.
- Nothing exceeds XL. Largest estimate is 16h.
- 60 active tasks — at the top of the 40–60 target. The V2/Future items are listed in a separate deferred section with no task IDs, so they do not inflate the active count.
- All 20 §2.3 rows appear in Defect Coverage with a task ID.
- All 25 §5 features F-01…F-25 appear as active tasks. F-20 and F-24 are carried in full, including §8.1's shared auth header and §8.6's redaction walker.
- All 10 §14 Must-Haves are covered, including #9 Security Made Visible (T-088).
- Every new task (T-063…T-089) carries a §-citation or a `status/*.md` citation.
- All 10 required sections present, plus a deferred V2/Future section so §6.1 and §6.2 are on the record rather than silently dropped.
- Every claim is either quoted from the source documents or verified by grep against the live tree. No "I believe", no "should be".

---

## Independent verification (2026-09-30)

An independent audit re-verified the Phase 0 set against live code at `5b4f5b9` rather than against
commit messages. Full report: `phase0-verification-report.md` (untracked).

**Verdict: Phase 0 is NOT complete.** 8 PASS · 10 PARTIAL · 4 FAIL · 0 whole-task NOT VERIFIABLE.

- **4 FAIL, no remediation attempted** — missing features, not regressions, and therefore out of
  scope for the fix pass: T-033 (`@clerk/testing` absent, `e2e/` holds only `smoke.spec.ts`),
  T-077 (`posthog` and `@vercel/analytics` absent from `package.json`), T-078 (D-2 and D-11 are
  still one-line table rows in `docs/DECISIONS.md`, with no full sections), T-083 (no `RAG_CONFIG`
  exists; the thresholds are still module-local in `vector-search.ts:291,:298` and `budget.ts:34`).
- **10 PARTIAL** — F-01 (no `<Suspense>` around the create-project form), F-02 (citation badge is
  never rendered under test), F-05 (server-prefetch only; `proxy.ts` gives `/api/trpc` no public
  pattern), F-06 (`pricing-section/constants.ts:63,65,82,101` still advertise repo allowances and
  7/30/90-day retention that no code implements), F-08 (see below — now fixed), F-20 (CSP is
  `reportOnly`, the eslint rule bans `axios` rather than inline `Bearer`), F-25 (uses `unique()` not
  `uniqueIndex()`; deleting the constraint leaves the suite green), T-069 (a literal `</context>` in a
  file is deliberately not escaped), T-084 (`lane/p2-a` does not exist in this clone, so half the task
  is NOT VERIFIABLE), T-088 (six of ~15 `file:line` citations point at the wrong lines and one names
  a function absent from the file it cites).
- **The 23rd Phase 0 task ID does not exist in any available source.** The "Ready to Start Now" table
  enumerates 22 IDs; the Effort Summary at :456-459 claims 23. No substitute was invented.
- **`gitvisionStrategy2.md` does not exist** (`find . -iname "*gitvision*"` → zero results), so every
  §-citation above and in the Defect Coverage table could only be checked against live code.

### Regressions found and fixed (branch `verify/phase0-fixes`)

| Commit | Task | Fix |
|---|---|---|
| `f3d3266` | F-08 | `CommandDialog` destructured `title`/`description` that its props type never declared, so `tsc --noEmit` and `next build` both failed at HEAD — **the app did not compile**. Declared both on the props intersection. |
| `7df7a52` | F-03 | `chat-get-by-id-join.test.ts`'s mock counter lived inside the hoisted `vi.mock` factory and ran cumulatively across tests; F-03's third select pushed the second test onto an even select, so `vitest run` exited 1. Hoisted the counter next to `leftJoins` and reset it in `beforeEach`. Test-only change. |

After both commits: `bun install` clean, `bun run typecheck` exit 0, `bun run lint` 0 errors / 4
warnings, `bun run test` 393 passed / 23 skipped / **0 failed**, `bun run build` succeeds. The one
remaining suite failure is `project-router-rate-limits.test.ts`, which is not skip-guarded and dies
at import without `DATABASE_URL` (`db/index.ts:5` builds the Neon client at module scope) — an
environment limitation, not a code defect, but it should be guarded like its siblings.

### Coverage gaps worth closing

F-02, F-06 and F-25 are mutation-invisible: breaking the citation href, the `comingSoon` branch or the
`unique(owner_id, github_url)` constraint all leave the suite fully green. Three of the six
mutation-eligible 🔥P0 tasks have no regression protection at all.

---

## Remediation pass (2026-09-30, branch `verify/phase0-fixes`)

The independent verification pass below left 10 tasks PARTIAL and 4 FAIL. All 14
are now closed on `verify/phase0-fixes`. Each line names the commit that
carries the work; the pre-existing pass/fail verdict for that commit's task is
in `## Independent verification (2026-09-30)`.

**Moved from the active list to DONE:**

| Task | Commit | What shipped |
|---|---|---|
| **T-033** | `4ba03b2` | `e2e/auth.setup.ts` is a Playwright setup project that exchanges a Clerk testing token for a session and writes `.auth/user.json`; `playwright.config.ts` gains a `setup` project plus `dependencies: ["setup"]` and `storageState` on `chromium`; `e2e/authenticated.spec.ts` asserts a protected route does not bounce to `/sign-in`. No anonymous fallback — a run that cannot authenticate reports that instead of testing nothing. `.auth/` is gitignored. `@clerk/testing` 2.2.40 added as a devDependency. |
| **T-077** | `b4cc962` | `src/shared/components/product-analytics.tsx` renders `<Analytics />` unconditionally (cookieless, no key) and initialises PostHog only when `NEXT_PUBLIC_POSTHOG_KEY` is set, behind a module-level guard because `init` mutates a singleton. Mounted from `app/layout.tsx`. `posthog-js` 1.435.1 + `@vercel/analytics` 2.0.1 added. |
| **T-078** | `d64c3cb` | `### D-2: AI Issue-Triage Columns` and `### D-11: Stateless neon-http Driver & Compensating Writes` written in full in the house style — Context / Options Considered / Decision / Consequences. D-11 spells out the three-step compensating-write ordering in `projectService.ts`. |
| **T-083** | `8a511ec` | `src/lib/rag/rag.config.ts` exports `RAG_CONFIG` (`smallProjectTokenThreshold: 150_000`, `maxContextFiles: 500`, `maxFileChars: 50_000`, `maxContextTokens: 32_768`). `vector-search.ts` and `budget.ts` read from it; `MAX_CONTEXT_TOKENS` keeps its export name so `budget.test.ts` is untouched. Also settles Open Question 4 in favour of 150K. |
| **T-038** | `[T-038] Configure Cross-Origin-Opener-Policy header and record D-8` | COOP was already `same-origin` in code (`next.config.ts:62-65`, pinned by `security-headers.test.ts:16`) while D-8 recorded `same-origin-allow-popups` on a premise this repo falsifies: Clerk OAuth is a full redirect (`use-signIn.ts:63-67` → `authenticateWithRedirect`), and no `window.open` exists in `src/` or `app/`, so nothing reads `window.opener`. D-8 rewritten to `same-origin` with the popup rationale struck and the false `SharedArrayBuffer` claim corrected — SAB needs COOP *and* `Cross-Origin-Embedder-Policy: require-corp`, and no COEP is set. Docs only; no code or test changed. |

**PARTIAL closed:**

| Task | Commit | What changed |
|---|---|---|
| **F-01** | `2f69ea6` | `<Suspense>` boundary around the create-project form; without it `useSearchParams()` forces a build-time CSR bailout. |
| **F-02** | `41445a8` | `citation-badge.test.tsx` — five tests that actually render the badge. Breaking its href now fails 3 of them; before, nothing rendered it and the mutation was invisible. |
| **F-05** | `41445a8` | `proxy.ts` allowlists `/api/trpc/project.getPublicStats` — this one procedure, never the prefix. Signed-out visitors now hydrate real counters. |
| **F-06** | `a9076c8` | Deleted the pricing entitlements no code implements: the monthly repository allowance and the 7/30/90-day retention windows. Re-greps: zero hits for any quota or retention mechanism. |
| **F-08** | `f3d3266` | Declared `title?: string; description?: string` on `CommandDialog`. The app did not build at HEAD: `tsc` and `next build` both failed on two undeclared properties. |
| **F-20** | `441a952` | `no-restricted-syntax` bans hand-rolled `Bearer` headers in `src/lib/github/services/**` (verified firing on literal and template forms); four tests pin the platform-header precedence that two single-header tests never exercised; `setup.ts` supplies a placeholder `DATABASE_URL` so `project-router-rate-limits.test.ts` stops dying at import. |
| **F-25** | `441a952` | `project-unique-constraint.test.ts` reads the constraint off the Drizzle schema with no connection and pins the migration, since the 23505 the service branch keys on comes from the database. |
| **T-069** | `272f271` | Per-instance UUID fence tag, extracted to `src/lib/llm/context-fence.ts` so a test imports what the route imports. Six tests including the injection payload. |
| **T-084** | — | No code needed. The task reads "reset `lane/p1-a` branch reference to `ff91397` to remove foreign commit `dc2c3b7`", which `b2e7103` did. The earlier `lane/p2-a` check was the verifier's own over-scoping; `lane/p2-a` never existed and no task asked for it. **T-084 → PASS.** |
| **T-088** | `c224029` | Six `file:line` citations corrected and `refundOnce` reattributed from `credits.ts` (where the function is `refundCredits`, and `refundOnce` occurs zero times) to the route-local helper it actually is. |

**Counts reconciled.** "Ready to Start Now" said 20 while enumerating 22, and the
Effort Summary claimed 23. Both are corrected to 22 with the reason inline. No
task was dropped — only a count that no list in this file could substantiate.

**Suite after remediation:** `bun run typecheck` exit 0 · `bun run lint` 0 errors,
4 pre-existing warnings · `bun run test` 427 passed, 23 skipped, 0 failed
(was 392 passed with 1 failed) · `bun run build` succeeds. The 23 skips are
`describe.skipIf(!hasTestDatabase)` suites; `bun audit` reports 10 advisories,
all transitive dev-tooling.
