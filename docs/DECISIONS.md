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
| **D-5** | Report-Only Content Security Policy | Accepted | T-021, T-022 | Serve CSP in report-only mode with `/api/csp-report` collector until nonce support is wired. |
| **D-6** | Retention Policy Scope & Guarantees | Accepted | T-024 | Align documentation with live system behaviour; avoid advertising unbuilt automatic sweeps. |
| **D-7** | In-Memory & Concurrency Rate-Limit Ceiling | Accepted | T-057, T-058 | Three-dimensional rate limiting (scope, user, IP) in PostgreSQL/memory; accept provider limits without Redis overhead. |
| **D-8** | Cross-Origin-Opener-Policy (COOP) Scope | **Accepted** | **T-038** | `same-origin-allow-popups` to preserve Clerk OAuth popup flows while isolating browsing context. |
| **D-9** | GitHub Remotes: HTTPS-Only | Accepted | T-041 | Enforce HTTPS remote URLs; document rejection of SSH/Enterprise remotes for MVP. |
| **D-10** | Account Deletion Window | Draft | T-063, T-064 | Hard cascade on user deletion; evaluate soft-delete window for enterprise compliance in V2. |
| **D-11** | Stateless `neon-http` Driver & Compensating Writes | Accepted | T-018, T-045 | Stay on `neon-http` for serverless scale; multi-step operations use explicit compensation latches instead of `db.transaction()`. |
| **D-12** | Database Backup Destination & Retention | Accepted | T-001 | Off-peak daily cron backup script in CI with 14-day retention artifact; S3/R2 long-term durable store queued. |
| **D-13** | Monolithic App Structure & Route Colocation | Accepted | — | Colocate API route handlers, tRPC procedures, and server components within Next.js App Router. |

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
- **Impacted Files:** `src/lib/csp.ts`, `proxy.ts`, `next.config.ts`

#### Context
`Cross-Origin-Opener-Policy` (COOP) allows a document to disassociate its top-level browsing context group from other browsing contexts. Setting `Cross-Origin-Opener-Policy: same-origin` isolates the window, providing defence against Spectre-like cross-origin information leaks and unlocking features like `SharedArrayBuffer` (which could be utilized for high-performance in-browser client-side vector search or WASM processing).

However, strict `same-origin` isolation severs `window.opener` references. In GitVision, user authentication leverages Clerk and GitHub OAuth flows, which open secondary popup windows or redirects to complete the OAuth handshake. When `same-origin` is enforced globally, popup windows cannot communicate back to the originating window, breaking the authentication flow and trapping users.

#### Options Considered

1. **Option A — `Cross-Origin-Opener-Policy: same-origin`:**
   Enforce strict same-origin isolation globally.
   - *Pros:* Maximum side-channel isolation; unlocks `SharedArrayBuffer`.
   - *Cons:* Breaches OAuth authentication popups (Clerk/GitHub), breaking login. **Rejected.**

2. **Option B — Omit COOP (`unsafe-none`):**
   Do not set any COOP header.
   - *Pros:* Maximum backwards compatibility.
   - *Cons:* Offers zero opener protection against cross-origin window hijacking or side-channel snooping. **Rejected.**

3. **Option C — `Cross-Origin-Opener-Policy: same-origin-allow-popups` (Chosen):**
   Isolate the top-level document from cross-origin openers, but permit opened popups to retain their relationship with the opener.
   - *Pros:* Protects the application browsing context while preserving Clerk OAuth popup authentication workflows.
   - *Cons:* Does not enable cross-origin isolation (`SharedArrayBuffer`), which requires `same-origin`. **Accepted.**

#### Decision
Set `Cross-Origin-Opener-Policy: same-origin-allow-popups` across application routes. This maintains isolation against hostile cross-origin contexts while fully supporting Clerk popup-based OAuth login flows. 

If client-side processing requiring `SharedArrayBuffer` is introduced in the future, it must be contained in dedicated isolated Web Workers or scoped to specific sub-routes rather than degrading the global authentication boundary.
