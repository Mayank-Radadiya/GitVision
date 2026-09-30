# Security

GitVision handles attacker-controlled input on every request: a tarball from a
third-party git host, an arbitrary `projectId` in a URL, a stream from an
external model. This document is the map of what stops that input, and — more
importantly — the test that pins each defence so it cannot be quietly removed.

Every claim below names the suite that fails if the behaviour regresses. If you
change one of these defences, the named test is what tells you the change was
deliberate.

## Archive ingestion: a hostile tarball

`src/lib/github/services/files.ts` streams the tarball from GitHub straight into
the embedding pipeline. An attacker who controls a repository controls every
tar entry name inside it.

The obvious attack is `../../.env` in an entry name. It is dropped: the entry name
is split into segments and any segment equal to `..` is rejected outright
(`files.ts:150-165`). The check is segment-wise, not a `normalize()` call,
because the thing being defended is not a filesystem write — nothing here ever
writes a path to disk. It is that a `..`-looking string is attacker-controlled
text which gets persisted, rendered in the file tree, and re-emitted later as a
RAG citation. Dropping it at the door is cheaper and stricter than sanitising it
downstream in three places.

Symlinks are dropped by the same pass: only entries whose `type` is `file` are
ingested (`files.ts:159-166`), so a symlink pointing at `/etc/passwd` or at the
parent directory never becomes a stored document.

Volume is bounded too. `GITHUB_CONFIG.MAX_FILES_PER_REPO` caps the entry count
and `GITHUB_CONFIG.MAX_FILE_BYTES` caps each file — checked once against the tar
header (`files.ts:169`, `:173`) and again as bytes stream past the limit
(`files.ts:185`, logged at `files.ts:236`) — so a small header with an endless
body cannot exhaust memory.

Pinned by `src/__tests__/unit/github-tarball-stream.test.ts:197-257` —
"drops an entry that climbs out of the repo with `..`", "drops a `..` that is
buried mid-path, not just at the front", "never stores a fileName containing a
`..` segment", and "does not store a symlink entry even when its path is clean".
The malformed-stream cases are covered separately in the same file at
`github-tarball-stream.test.ts:117-195`.

## Ownership: 404, not 403

`assertProjectOwnership(projectId, userId)` in `src/lib/guards.ts` answers one
question — may this caller touch this project — and the answer is a single query
whose `WHERE` clause carries both `id` and `ownerId`
((`and(eq(projectTables.id, projectId), eq(projectTables.ownerId, userId))`,
`src/lib/guards.ts:44-64`). Tenant isolation is inside the query, not a
comparison the caller might forget after the fetch.

When the query returns nothing, the guard throws `ProjectAccessError`, a
`TRPCError` with `code: "NOT_FOUND"` and the message `"Project not found"`
(`src/lib/guards.ts:25-30`). The message is byte-identical whether the project
does not exist or exists and belongs to someone else. A caller cannot use the
error to enumerate other tenants' project ids, because a `403` would confirm the
id is real and a distinct `404` message would confirm it too.

`ProjectAccessError` extends `TRPCError` rather than `Error` for a second
reason: a plain `Error` thrown inside a tRPC handler surfaces as a 500, which
tells an attacker their probe hit a code path rather than a wall. The type stays
catchable by name in the Next.js route handlers that map it to their own 404.

Pinned by `src/__tests__/unit/guards.test.ts:81-138`, including "scopes the
query by ownerId, not by a post-fetch comparison", "throws the same error when
the project belongs to someone else", and "does not leak the project id or owner
id in the error"; and by `guards.test.ts:140-156` for the 404-not-500 mapping.

## Credits: atomic spend, DB-enforced floor, latched refund

Credits are the metering primitive. `spendCredits(userId, cost)` in
`src/lib/credits.ts:33-46` never reads the balance and then writes it back. It
issues one statement — `SET credits = credits - cost WHERE id = ? AND credits >=
?` (`src/lib/credits.ts:40-44`) — and returns the new balance from `RETURNING`.
Two concurrent chat requests
therefore cannot both pass a `credits >= cost` check taken against a stale read;
the second one's predicate is evaluated against the balance the first one
already committed. `null` from `spendCredits` means denied, and the caller does no
further work.

The arithmetic also has a floor in the database, not only in the predicate.
`db/schema.ts:52` adds `check("users_credits_non_negative", credits >= 0)` as
defence in depth. If a future caller forgets the `gte`, the constraint refuses
the write instead of minting negative credit.

Refunds run the other way — `SET credits = credits + cost` with `RETURNING`
(`refundCredits`, `src/lib/credits.ts:58-71`) — and
are latched at the call site. The AI SDK can report a single aborted stream
through more than one channel (`onError` and the stream-settling path of
`onFinish`), so `app/api/chat/route.ts:486-489` wraps the refund in a
`refundOnce` closure guarded by a `let refunded = false` flag. Without the latch a
failed turn refunds twice and the meter leaks credits. The latch is invoked from
`onError` (`route.ts:498`) and from `onFinish`
(`route.ts:640`), and a failed refund is logged rather than swallowed
(`route.ts:490`).

Pinned by `src/__tests__/integration/credits-check-and-indexes.test.ts:24-32`
for the constraint itself — a negative balance is rejected, zero is allowed, a
top-up above the starting balance is allowed — and by
`src/__tests__/integration/chat-credit-refund.test.ts:242-287`, whose central
case is "refunds exactly once even if the failure is reported twice"
(`chat-credit-refund.test.ts:256`), asserting the refund log is `[1]`.

## Rate limiting: three dimensions, not one

A single per-user counter does not bound spend. A user with many accounts gets
one budget; a botnet behind one address gets one budget for all of them.
`enforceLimits` in `src/lib/rate-limit.ts` therefore counts along three axes:

| Dimension | Question it answers |
| --- | --- |
| `user` (`src/lib/rate-limit.ts:64`) | Is this account being fair to other accounts? |
| `ip` | Is this address costing us too much? |
| `daily` | Are we solvent today, across everyone? |

Each metered scope carries a per-user and a per-IP limit in the table at
`src/lib/rate-limit.ts:79-82`; the user limit is the tighter one and the IP limit
is the cost ceiling. The IP limit is deliberately looser because offices,
universities, and carrier NATs share a single address — a strict IP limit would
lock out an entire building. The user limit is never the looser of the pair,
which the test suite asserts structurally rather than by eyeballing numbers.

The daily axis is not per-scope. It is a single global counter at the fixed key
`metered:daily` (`src/lib/rate-limit.ts:119`), so a caller cannot burn their
whole allowance on one endpoint and then spend another allowance on the next.

The IP is read from `x-vercel-forwarded-for` and `cf-connecting-ip`
(`src/lib/rate-limit.ts:139`), headers the hosting platform overwrites on every
request, in preference to a client-supplied `X-Forwarded-For`, whose last hop is
also parsed for the server-side callers that only get the legacy header. Values
that do not look like an IP are refused rather than trusted. Counters live in
Postgres (`src/lib/rate-limit.ts:1-8`) — one row per route-and-subject key with
an atomic upsert, so the limits hold across serverless instances that share no
memory and no in-memory counter can drift.

Pinned by `src/__tests__/unit/rate-limit-dimensions.test.ts` — `clientIp`
header precedence and parsing at `rate-limit-dimensions.test.ts:48-103`, the
three-axis interaction in `enforceLimits` at `rate-limit-dimensions.test.ts:105-188`
(user counted first, a user rejection not burning an IP or daily write, rejection
on a shared address, the daily ceiling, distinct keys per dimension), and the
shape of the limit table at `rate-limit-dimensions.test.ts:190-215`. End-to-end
behaviour at the router is covered by
`src/__tests__/integration/project-router-rate-limits.test.ts:112-152`.

## Logging: nine keys never reach disk

Logs outlive the request that produced them and are read by people the request
never met, so the logger is the last place a secret should still be intact.
`src/lib/logger.ts:27-40` keeps a nine-key denylist — `token`, `secret`,
`password`, `passwd`, `authorization`, `cookie`, `api_key`, `email`,
`credential` — and any value stored under one of those keys is replaced with
`[redacted]` (`src/lib/logger.ts:41`) before serialisation.

Matching is case-folded and separator-insensitive
(`src/lib/logger.ts:52`), so a hand-written `apiKey` and an HTTP `Authorization`
header both match. Matching is on whole keys, not substrings, so a legitimate
`emailCount` metric is not silently swallowed by the `email` rule.

Redaction recurses: arrays, nested objects, and the `error` argument are all
walked (`src/lib/logger.ts:73`), and over-long `message` and `stack` strings are
truncated at 2000 characters with a `[truncated N chars]` marker
(`src/lib/logger.ts:49`, `src/lib/logger.ts:55-59`) so a dumped response body
cannot flood a log sink.

Pinned by `src/__tests__/unit/logger.test.ts:87-178` — masking at every nesting
level, the nested-context case, the `error` argument, truncation of message and
stack, and a check that ordinary content is left untouched — plus
`logger.test.ts:180-193`, which asserts every call site in the codebase goes
through this logger rather than calling `console.*` directly.

## Response headers: one rule, every route

Every header below is declared once, in the single `headers()` rule of
`next.config.ts:45-77`, scoped to `source: "/:path*"`. There is no second
declaration site — not in `src/lib/csp.ts`, not in `proxy.ts` — so there is no
route that can be served without them and no per-route drift to reconcile.

| Header | Value |
| --- | --- |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |

`Cross-Origin-Opener-Policy: same-origin` severs the `window.opener` link to any
document this page opens. That is safe here because no flow in the app reads the
opener: Google OAuth is a full-redirect handshake
(`signIn.authenticateWithRedirect({ strategy: "oauth_google", redirectUrl:
"/sso-callback" })` at
`src/features/auth/components/sign-in/use-signIn.ts:63-67`), email/password
sign-in is `signIn.create({ identifier, password })` at `use-signIn.ts:33-36`,
and no `window.open` call exists in `src/` or `app/`. A redirect never consults
the opener, so the header costs this app nothing while denying a hostile page
the reference it would need to navigate this one. The rationale, the rejected
alternatives, and the invariants are recorded as D-8 in `docs/DECISIONS.md`.

What the header does **not** do today is enable `SharedArrayBuffer`. That
requires the pair — COOP `same-origin` *and* `Cross-Origin-Embedder-Policy:
require-corp` — and no COEP header is set. Adding one is a separate decision,
not a COOP change: `require-corp` will break every third-party subresource
(ui-avatars, camo, Clerk's own assets) until they are proxied or corrected.

Pinned by `src/__tests__/integration/security-headers.test.ts` — "serves every
security header for all routes (/:path*) with its exact value" reads
`nextConfig.headers()` back, finds the `/:path*` rule, and asserts each key/value
pair in `EXPECTED_STATIC_HEADERS` (`:6-16`), where COOP is pinned at `:16`. The
same suite asserts `X-XSS-Protection` is absent and checks the `CSP_DIRECTIVES`
values separately.

## What is not defended here

Stated plainly so nobody assumes otherwise:

- **No row-level security.** Tenant isolation is application-level only
  (`src/lib/guards.ts`). A query that forgets the guard is a cross-tenant read.
- **No transactions.** Ingestion and metered work commit in separate statements;
  there is no rollback if a later step fails.
- **The refund latch is per-request and in-memory.** `refundOnce` protects
  against double-reporting inside one stream, not against a process restart
  between the charge and the refund.
- **The rate-limit deny list is not a WAF.** It bounds rate and cost on the
  metered scopes; it does not inspect payloads.