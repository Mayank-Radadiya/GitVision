# Architectural Decision Records (ADRs)

This document is the authoritative record of architectural and engineering decisions in GitVision. Each record documents the context, options evaluated, trade-offs accepted, and the rationale behind the chosen design.

Where a decision imposes an invariant, that invariant must be respected by all subsequent tasks and pull requests.

---

## Decision Ledger Summary

| ID | Title | Status | Blocks / Relates To | Summary |
|---|---|---|---|---|
| **D-1** | Email-less Clerk Users | **Accepted** | **T-005** | Make `users.email` nullable in migration `0005`; drop `example@gmail.com` default. |
| **D-2** | AI Issue-Triage Columns | Decided (Drop) | T-028 / F-13 | T-028 dropped triage affordances; F-13 recommendation on record proposes reviving them without migration. |
| **D-3** | Decision Ledger Reconciliation & Repo Indexing Caps | **Resolved / N/A** | T-012, T-013 | Bounded at 500 files prioritized by `asc(length(code))`; marks `indexingStatus: "partial"` with UI badge. Blank ledger entries reconciled. |
| **D-4** | Production Logging & Error Transport | **Accepted** | **T-020** | `@sentry/nextjs` via `instrumentation.ts` + stdout JSON for Vercel drain. Must route through `src/lib/logger.ts` redaction. |
| **D-5** | Enforcing Content Security Policy with report collection | Accepted | T-021, T-022 | Once nonces were threaded (T-082), flip the policy from report-only to enforcing (`reportOnly: false`) and keep `/api/csp-report` live via `reportTo`, so blocked scripts are still reported. |
| **D-6** | Retention Policy Scope & Guarantees | Accepted | T-024 | Align documentation with live system behaviour; avoid advertising unbuilt automatic sweeps. |
| **D-7** | In-Memory & Concurrency Rate-Limit Ceiling | Accepted | T-057, T-058 | Three-dimensional rate limiting (scope, user, IP) in PostgreSQL/memory; accept provider limits without Redis overhead. |
| **D-8** | Cross-Origin-Opener-Policy (COOP) Scope | **Accepted** | **T-038** | `same-origin` globally. Authentication is full-redirect, so no `window.opener` dependency exists to trade isolation away for. |
| **D-9** | GitHub Remotes: HTTPS-Only | Accepted | T-041 | Enforce HTTPS remote URLs; document rejection of SSH/Enterprise remotes for MVP. |
| **D-10** | Account Deletion Window | Draft | T-063, T-064 | Hard cascade on user deletion; evaluate soft-delete window for enterprise compliance in V2. |
| **D-11** | Stateless `neon-http` Driver & Compensating Writes | Accepted | T-018, T-045 | Stay on `neon-http` for serverless scale; multi-step operations use explicit compensation latches instead of `db.transaction()`. |
| **D-12** | Database Backup Destination & Retention | Accepted | T-001 | Off-peak daily cron backup script in CI with 14-day retention artifact; S3/R2 long-term durable store queued. |
| **D-13** | Monolithic App Structure & Route Colocation | Accepted | — | Colocate API route handlers, tRPC procedures, and server components within Next.js App Router. |
| **D-14** | `isProUser` Tier Column | Decided (Drop) | T-085 / V-09 | Drop the write-only `users.isProUser` boolean; migration `0007`. Tier gating is V-09's problem. |

---

## Detailed Decision Records

### D-1: Handling Email-less Clerk Users

- **Status:** Accepted
- **Date:** 2026-09-30
- **Unblocks:** **T-005**
- **Impacted Files:** `db/schema.ts`, migration `0005`, `app/api/webhooks/clerk/route.ts`

#### Context
Clerk allows authentication through OAuth identity providers (e.g., GitHub, Google, Apple) or phone numbers where a verified email address may not be present or shared in the OAuth scope. 

In `db/schema.ts`, the `users.email` column is declared as:
```typescript
email: text("email").notNull().unique().default("example@gmail.com")
```

This configuration introduces two critical flaws:
1. When a user authenticates without an email, the database inserts the default string `"example@gmail.com"`.
2. Because `email` has a `UNIQUE` constraint, the second user who authenticates without an email triggers a PostgreSQL unique constraint violation (`23505 unique_violation`). The Clerk webhook fails with a 500 error, credit initialization is aborted, and the user is left in an empty, un-synced product state.

#### Options Considered

1. **Option A — Synthesize a unique placeholder email:**
   Generate a synthetic placeholder (e.g., `user_<clerkId>@users.invalid`).
   - *Pros:* Satisfies `notNull()` without altering existing column nullability.
   - *Cons:* Injects synthetic junk data into the primary user table. Collides with data honesty principles, risks sending transactional notifications to non-existent domains, and pollutes future user exports. **Rejected.**

2. **Option B — Reject account creation (Return 422 / Error):**
   Refuse to provision users who lack an email, requiring them to add an email address in Clerk.
   - *Pros:* Requires zero database schema changes.
   - *Cons:* Creates a user-facing dead end for valid OAuth users who prefer not to expose public emails or use SMS authentication. Degrades onboarding conversion. **Rejected.**

3. **Option C — Make `users.email` nullable and drop the default string in migration `0005` (Chosen):**
   Alter `users.email` to allow `NULL` values and remove the `"example@gmail.com"` default string.
   - *Pros:* Accurately reflects real-world auth data. In PostgreSQL, unique constraints permit multiple `NULL` values (or a partial unique index where email is not null), completely resolving the collision bug.
   - *Cons:* Requires migration `0005` and auditing downstream consumers that assume `user.email` is an invariant string. **Accepted.**

#### Decision
Make `users.email` nullable in migration `0005` and drop the `example@gmail.com` default. Update `db/schema.ts` to `text("email").unique()`. Any downstream readers or UI components that display user emails must gracefully handle `null` (e.g. falling back to username or Clerk ID).

---

### D-2: AI Issue-Triage Columns

| Field | Value |
|---|---|
| **Status** | Decided (Drop) |
| **Date** | 2026-09-30 |
| **Blocks / Relates To** | T-028 / F-13 |
| **Impacted Files** | `db/schema.ts`, `src/features/dashboard/server/router/services/projectService.ts`, `src/lib/github/services/issues.ts` |

**Context.** The `issues` table has carried three nullable AI-triage columns
since the original schema — `ai_summary`, `ai_complexity`, `ai_tags` — with a
comment declaring them the output of a deferred Gemini background job
(`db/schema.ts:311`). That job was never built. What did ship was the
*affordance*: both issue selects and the issue insert read and wrote those
columns, so every dashboard payload carried three fields that were always
`null`, and `needs-attention.tsx` looked like it was rendering triage output it
never received. The affordance was advertised by comments and by the payload,
never by the markup — `AttentionItem` in `dashboard.types.ts` never declared an
AI field.

**Options.**

- **Option A — finish the feature.** Build the background job to populate the
  columns, making the existing schema honest. REJECTED: it is a Gemini
  inference dependency, an Inngest function, and a per-issue cost model, none of
  which Phase 1 funded. It would also have made T-025/T-026/T-027 (the triage
  render path) mandatory rather than optional.
- **Option B — drop the affordance, keep the columns.** REJECTED as originally
  written: deleting three nullable columns costs a migration plus a `.notes.md`
  and buys nothing user-visible, since nothing reads them.
- **Option C — drop the affordance, keep the columns, stop claiming them.**
  **CHOSEN.** The columns stay (they are nullable, cost nothing, and a future
  triage job can adopt them without a migration), but no query selects them, no
  insert writes them, and the schema comment no longer promises a job that
  doesn't exist.

**Decision.** Option C. T-028 removed the three fields from both issue selects
and from the insert, and rewrote the `db/schema.ts:311` comment to say "populated
by a deferred Gemini background job" — present tense about a deferred job, not a
claim that one is running. `db/schema.ts` itself needed no edit: the columns were
already nullable. The tRPC output narrowed because `project.ts` declares no
hand-written output types for `getNeedsAttention` / `getIssues`, so removing the
fields from the service selects is what removes them from the wire.

**Consequences.** The payload no longer carries three always-null fields, and
`project-issues-shape.test.ts` (161 lines, `b0fcb1b`) pins the narrowed shape.
F-13 may revive the columns *without* a migration, which is the only reason they
were kept. T-025/T-026/T-027 are cancelled outright — they built the render path
for an affordance this decision removed, so they are mutually exclusive with
Option C rather than merely deferred.

**Note.** The unrelated `ai_summary` in `src/lib/github/services/commits.ts` is
the commit-summary LLM write against a *different* table and is out of scope for
this record.

---

### D-3: Decision Ledger Reconciliation — Indexing Truncation & Repository Caps

- **Status:** Resolved / Reconciled
- **Date:** 2026-09-30
- **Relates To:** T-012, T-013, `GITHUB_CONFIG.MAX_FILES_PER_REPO`

#### Context
In historical project roadmaps and audit ledgers, D-3 was designated to address repository indexing truncation (whether to hard-fail on large repositories, partially index, or raise the file cap). In several lane status ledgers (`status/p0-B.md`, `status/p1-c.md`, `status/p0-t001.md`), D-3 was marked as decided without a complete formal record, leaving an empty entry in the decision ledger.

Meanwhile, the indexing truncation implementation was shipped in tasks T-012 and T-013:
- The repository enforces `GITHUB_CONFIG.MAX_FILES_PER_REPO = 500` to bound vector embedding costs and prevent serverless execution timeouts.
- Files are sorted and ingested in ascending order of code length (`asc(length(code))`) so that dense implementation files are prioritized over monolithic bundles.
- When file count exceeds 500, ingestion sets `indexingStatus: "partial"` and the UI displays an explicit partial-index badge informing the user.

#### Options Considered

1. **Option A — Hard failure for repositories > 500 files:**
   Refuse indexing entirely if a repository contains more than 500 files.
   - *Pros:* Strict guarantee that indexed content is complete.
   - *Cons:* Unacceptable drop-off for standard open-source codebases. **Rejected.**

2. **Option B — Remove or substantially increase the file cap:**
   Permit indexing thousands of files per repository.
   - *Pros:* Comprehensive coverage of large enterprise repositories.
   - *Cons:* Neon PostgreSQL storage and OpenRouter embedding token costs scale uncontrollably for a free/demo tier. **Rejected.**

3. **Option C — Formalize partial indexing with transparent UI attribution (Chosen):**
   Retain the 500-file cap, prioritize shortest files, persist the `partial` status, and render a clear indicator in the UI. Reconcile the blank ledger entries to clear technical debt.
   - *Pros:* Balances cost control, processing time, and user utility while maintaining complete honesty. **Accepted.**

#### Decision
Formally record D-3 as resolved and reconciled with the MVP architecture: GitVision enforces a 500-file cap via `GITHUB_CONFIG.MAX_FILES_PER_REPO`, prioritizes shortest files via `asc(length(code))`, and displays the partial-index badge implemented in T-013. The lingering blank entry in historical status files is formally closed.

---

### D-4: Production Error Tracking & Logging Transport

- **Status:** Accepted
- **Date:** 2026-09-30
- **Unblocks:** **T-020** (F-24)
- **Impacted Files:** `src/lib/logger.ts`, `instrumentation.ts` (to be created in F-24), `next.config.ts`

#### Context
GitVision currently logs to standard `console` via `src/lib/logger.ts`. While the logger implements robust PII and secret redaction (T-019), console logging in production serverless environments (Vercel) provides no centralized exception aggregation, stack trace symbolication, release correlation, or real-time alerting.

At the same time, naive log shipping risks exposing sensitive tokens, database connection strings, or user prompts if objects passed to logging transports bypass sanitization.

#### Options Considered

1. **Option A — OpenTelemetry (OTel) Collector:**
   Export traces and errors to an OpenTelemetry collector.
   - *Pros:* Vendor-neutral standard.
   - *Cons:* Requires deploying and maintaining a collector agent and an observability backend (Jaeger, Signoz, Grafana Loki). Severe operational overkill for current MVP scale. **Rejected.**

2. **Option B — Console-only logging with generic log draining:**
   Rely solely on standard output and drain logs to a generic aggregator.
   - *Pros:* Minimal setup, zero external dependencies.
   - *Cons:* Lacks client/server exception grouping, source map symbolication, Next.js route metadata, and error rate alerting. **Rejected.**

3. **Option C — Sentry (`@sentry/nextjs`) + Structured JSON stdout (Chosen):**
   Use `@sentry/nextjs` initialized via Next.js standard `instrumentation.ts` for exceptions, paired with structured JSON written to `stdout` for Vercel's native log drain.
   - *Pros:* Industry-standard error grouping and source map support on Vercel; free tier (5,000 events/month) fits MVP volume. Structured stdout JSON satisfies standard serverless log ingestion. **Accepted.**

#### Decision
Adopt `@sentry/nextjs` for exception tracking via `instrumentation.ts` and output structured JSON to `stdout` for Vercel log draining.

#### Mandatory Invariants
1. **Redaction Invariant:** Every event, context payload, and error metadata object sent to Sentry or stdout **must** pass through `serialize` and `redact` from `src/lib/logger.ts`. The 9-key redaction list (`authorization`, `cookie`, `token`, `password`, `secret`, `key`, `apiKey`, `githubToken`, `databaseUrl`) and truncation rules must never be bypassed by raw external transport calls.
2. **Environment Gating:** External error reporting must be env-flagged off in local development and CI runs (`NODE_ENV === "production"` with `SENTRY_DSN` configured). Development environments must continue outputting readable console formats without external network calls.
3. **OTel Rejection:** The OTel collector approach is explicitly rejected as unnecessary complexity at this stage.

---

### D-8: Cross-Origin-Opener-Policy (COOP) Scope

- **Status:** Accepted
- **Date:** 2026-09-30
- **Unblocks:** **T-038**
- **Impacted Files:** `next.config.ts`, `src/__tests__/integration/security-headers.test.ts`

#### Context
`Cross-Origin-Opener-Policy` (COOP) lets a document disassociate its top-level browsing context group from other browsing contexts. `same-origin` isolates the window, defending against cross-origin window hijacking and Spectre-like opener leaks.

The tradeoff is `window.opener`: under strict `same-origin` a cross-origin document opened by this one gets no back-reference. That only matters if some flow *relies* on the opener. An earlier draft of this record claimed GitVision's Clerk/GitHub OAuth "opens secondary popup windows" and therefore required `same-origin-allow-popups`. **That premise is false for this codebase.** Google OAuth is a full-redirect handshake — `handleGoogleSignIn` calls `signIn.authenticateWithRedirect({ strategy: "oauth_google", redirectUrl: "/sso-callback", redirectUrlComplete: "/dashboard" })` at `src/features/auth/components/sign-in/use-signIn.ts:63-67`, the sign-up equivalent uses the same redirect form at `use-signUp.ts:73-74`, and email/password sign-in is `signIn.create({ identifier, password })` at `use-signIn.ts:33-36`. No `window.open` exists in `src/` or `app/`. A redirect handshake never reads `window.opener`, so `same-origin` costs this app nothing.

The same draft also claimed `same-origin` "unlocks `SharedArrayBuffer`." It does not, alone. `SharedArrayBuffer` requires COOP `same-origin` **and** `Cross-Origin-Embedder-Policy: require-corp`; this repo sets no COEP, so the header is currently worth isolation and nothing more.

#### Options Considered

1. **Option A — `Cross-Origin-Opener-Policy: same-origin` (Chosen):**
   Enforce strict same-origin isolation globally.
   - *Pros:* Maximum opener isolation. No auth flow in this repo reads `window.opener`, so the cons previously listed against this option do not apply. Also the only value that can ever satisfy half of the cross-origin-isolation pair, so it is not a dead end if COEP is added later.
   - *Cons:* Irreversible for a genuinely popup-based flow — if one is ever introduced, this header must change. **Accepted.**

2. **Option B — Omit COOP (`unsafe-none`):**
   Do not set any COOP header.
   - *Pros:* Maximum backwards compatibility.
   - *Cons:* Zero opener protection against cross-origin window hijacking or side-channel snooping, and it forfeits the option above. **Rejected.**

3. **Option C — `Cross-Origin-Opener-Policy: same-origin-allow-popups`:**
   Isolate the top-level document from cross-origin openers, but permit opened popups to retain their relationship with the opener.
   - *Pros:* Preserves `window.opener` for a popup flow.
   - *Cons:* The only flow it would serve does not exist here, so it trades real isolation for hypothetical compatibility. It is also strictly weaker than Option A with no compensating benefit. **Rejected** — previously *chosen* on the false popup premise this record corrects.

#### Decision
Set `Cross-Origin-Opener-Policy: same-origin` on `/:path*` in `next.config.ts` (the single global `headers()` rule), so every route carries it.

#### Mandatory Invariants
1. **No silent downgrade.** Changing this value to `same-origin-allow-popups` or removing it requires a new decision record. The exact value is pinned by `src/__tests__/integration/security-headers.test.ts`, which fails on any drift.
2. **Popup flows are not free.** Introducing a `window.open`-based auth or payment flow invalidates this decision; that flow must either avoid the opener or reopen the decision first.
3. **COEP is a separate decision.** `SharedArrayBuffer` is not available today. Enabling it requires adding `Cross-Origin-Embedder-Policy: require-corp`, which will break every third-party subresource until they are corrected or proxied — and must not be bundled into a COOP change.

---

### D-11: Stateless `neon-http` Driver & Compensating Writes

- **Status:** Accepted
- **Date:** 2026-09-30
- **Relates To:** **T-018** (credit charge order), **T-045** (compensation latches), **T-096** (`openCharge` handle; amends Consequences)
- **Impacted Files:** `src/lib/db` driver construction, `src/features/dashboard/server/router/services/projectService.ts`, `src/lib/credits.ts`, `app/api/chat/route.ts`

#### Context
Creating a project is a multi-step operation: validate the repo URL, `INSERT` the
project row, deduct credits, and enqueue an Inngest ingestion job. On the
`neon-http` driver there is no `db.transaction()` available — the HTTP protocol
used for Neon serverless does not expose interactive transactions — so any pair
of these steps that must both happen has to be reconciled by hand if the second
one fails.

The driver choice is deliberate. `neon-http` over WebSockets is what lets the
app scale to zero on Vercel and avoid paying for a warm connection per serverless
instance; the cost is that a `db.transaction()` call would pin a connection for
the life of the transaction, which is exactly the thing the driver is chosen to
avoid.

#### Options Considered

1. **Option A — `db.transaction()` around create:**
   Wrap insert, charge, and enqueue in one transaction.
   - *Pros:* The textbook answer. One round trip, automatic rollback, no
     compensation code to get wrong.
   - *Cons:* Requires the WebSockets driver. Rejected — it forfeits scale-to-zero
     and reintroduces a connection cost per cold instance.

2. **Option B — charge first, then insert:**
   Deduct credits before creating the row, refund on insert failure.
   - *Pros:* A user is never handed a project they cannot pay for, because the
     charge is the gate.
   - *Cons:* Still needs a refund path, and an unconditional charge-then-refund
     burns a credit refund latch on a request that never needed one.

3. **Option C — insert, then charge, with explicit compensation in every failure
   branch (Chosen):**
   Order the operations so the cheapest-to-undo step happens last, and write a
   compensating action into each branch that can fail after the row exists.
   - *Pros:* Stays on `neon-http`. The compensation is only exercised on genuine
     failures, not on the happy path.
   - *Cons:* Requires discipline — every new `await` after the `INSERT` needs a
     compensating branch, and a reviewer has to know that rule.

#### Decision
Stay on `neon-http` and pay for Option C. In
`projectService.ts`, `createNewProject`'s ordering is:

1. `INSERT` the project row.
2. `spendCredits(userId, PROJECT_CREATION_COST)` — a guarded
   `UPDATE … WHERE credits >= ?` with `RETURNING`, so two concurrent requests
   can never drive a balance negative. If it throws, delete the row and rethrow.
   If it returns `null` (the guard rejected the deduction), delete the row and
   fail `FORBIDDEN` — the read above it is only a fast-fail for the common case,
   not the authority.
3. `inngest.send(...)`. If it throws, delete the row **and** refund the credits.

Step 3 compensating in both directions is the case that makes the ordering
worth stating explicitly: by then both the row and the charge exist, so either
one alone would strand the other.

A duplicate `(owner_id, github_url)` is not this ADR's problem. The unique
constraint raises `23505`, which `createNewProject` re-throws as
`PROJECT_ALREADY_EXISTS`; because the `INSERT` precedes the charge, a conflict
costs the user nothing — it fails before any credit is deducted, and the router
maps it to `CONFLICT`.

#### Consequences
Every `await` after the `INSERT` is a place a compensation branch is now
required. The comments in `projectService.ts` state this at the charge site so
the rule is visible at the point of risk rather than only in this record.

`db.transaction()` is not available on this driver, so no future change may
introduce one under the assumption that it will work. If a transaction ever
becomes genuinely necessary, that decision is a driver decision, not a local
refactor — and it supersedes this record.

The same reasoning applies elsewhere: a chat turn spends its credit before the
model is called, so every failure after that point needs a compensating refund,
and the refund has to happen at most once. The AI SDK reports a single aborted
stream through both `onError` and `onFinish`, so "once" is not implied by the
signal arriving — it has to be owned.

**Amended by T-096.** The chat route previously enforced that with a per-request
`let refunded` flag inside the handler, and `projectService.createProject` left
its refund uncaught. A flag is a memory of the current process, and a serverless
instance can be reclaimed between the charge and the refund; a refund the flag
guarded could therefore be lost entirely. `src/lib/credits.ts` now exposes
`openCharge(userId, cost, reason)`, which spends, mints one idempotency key for
the refund leg, and returns a handle whose `refund()` is once-only both in
process and across processes. This is a *stronger* guarantee than the flag on the
same Option C footing — still a compensating write, still no transaction — so it
amends this record rather than superseding it. The handle also gained a
`settle()`, because a turn that completed must not be refundable by an abort
reported afterwards; the flag could not express that distinction.

---

### D-14: `isProUser` Tier Column

| Field | Value |
|---|---|
| **Status** | Decided (Drop) |
| **Date** | 2026-09-30 |
| **Blocks / Relates To** | T-085 / V-09 |
| **Impacted Files** | `db/schema.ts`, `src/features/dashboard/server/router/services/projectService.ts`, `app/api/webhooks/clerk/route.ts`, `db/migrations/0007_true_leech.sql` |

**Context.** `users.isProUser` was a non-null boolean with a `false` default,
declared in `db/schema.ts` and written in exactly two places: the Clerk-user
lazy-provisioning insert in `projectService.ts` and the Clerk webhook insert in
`app/api/webhooks/clerk/route.ts`. Both wrote the literal `false`. No select,
filter, or guard anywhere in the codebase read it. The column was therefore
write-only: it claimed a tier that nothing consumed, and it lied twice — once
per insert path — about the state of that tier.

**Options.**

- **Option A — wire the tier.** Gate credit perks on `isProUser` and add the read
  checks the column was presumably declared for. REJECTED: gating requires a
  source of truth to read. There is no Stripe integration, no subscription
  table, no webhook that could ever write `true`. Wiring the reads would build a
  gate that is permanently shut, behind a code path that has to be edited again
  when V-09 introduces billing.
- **Option B — keep the column, stop writing it.** REJECTED: a column with no
  writer and no reader is strictly worse than one with a writer — it becomes
  `NOT NULL DEFAULT false` that can never be updated, so the next reader has no
  way to tell whether `false` means "not pro" or "nobody ever set it".
- **Option C — drop the column.** **CHOSEN.** Remove the declaration, drop the
  column, and remove both writes.

**Decision.** Option C, commit `8174b42`. `db/schema.ts` no longer declares
`isProUser`; `projectService.ts` and `app/api/webhooks/clerk/route.ts` no longer
write it; migration `0007_true_leech.sql` drops the column with
`ALTER TABLE "users" DROP COLUMN "is_pro_user";`.

**Consequences.** `users` has six columns, not seven — the same reason
`0008_clever_taskmaster.notes.md` §7 cites when reading the table's shape. Both
insert paths still write the other five columns; removing one key from each
insert object was the whole of the write-site change. `src/lib/inngest/functions.ts`
notes that there is no `is_pro_user` left to filter on. Any future tier is V-09's
to add, with a real writer behind it; this record exists so that the next person
who reaches for `isProUser` finds the reasoning instead of the column.

**Note.** Historical snapshots under `db/migrations/meta/` through `0006` still
contain the column, which is correct — they are the immutable record of the
schema as it was, and `0007` is the statement of change.
