# Lane B — status (security)

Branch: `lane/p1-b` (off `main` @ `c9ffe92`)

| Task | Status | Reason | Commit |
|------|--------|--------|--------|
| T-016 | done | secret-file patterns added to `IGNORED_FILE_PATTERNS`; 15 tests added | `c222a3a` |
| T-015 | done | entry names resolved with `posix.normalize`; escaping entries dropped; 5 tests added | `1d27991` |
| T-021 | done | report-only CSP + report collector route; 9 tests added | `bff7167` |
| T-022 | blocked | needs human review of violation report — no violations have been observed yet | |

## Notes

- **T-022 is blocked, not skipped.** Its first step is "review the T-021
  violation report and close every legitimate gap", and that report does not
  exist yet: the report-only header was committed minutes ago and nobody has
  exercised the running app against it. The task's own verify step
  (`curl -sI http://localhost:3000 | rg -i content-security-policy`, then "read
  the violation log") needs a dev server, a browser, Clerk credentials, a
  database and a GitHub token, so it cannot be self-certified in this session.
  Promoting the header now would be the exact "documentation, not a control"
  outcome the task warns about — with zero evidence that the policy is safe.
  To unblock: run the app against the report-only header, exercise chat
  streaming, the code viewer, sign-in and project creation, read the
  `logger.warn` lines in the collector, then set both headers
  (`Content-Security-Policy` enforcing + the relaxed `…-Report-Only` kept
  alongside) and flip the assertion in
  `src/__tests__/integration/security-headers.test.ts`. If the `'unsafe-inline'`
  /`'unsafe-eval'` allowances are to go too, that needs a per-request nonce
  threaded through `proxy.ts` — a separate change, not this task.
- Files touched outside the lane's declared ownership:
  - **T-021: `app/api/csp-report/route.ts`** (new) and **`proxy.ts`**. The
    collector route is the task's own requirement ("add a minimal
    report-collector route so violations are observable"). The `proxy.ts` edit
    is one list entry: `clerkMiddleware` protects every route that is not
    named in `isPublicRoute`, so a browser posting a violation with no session
    would have been redirected and the report silently lost. The route cannot
    be authenticated — that is the nature of the endpoint.
- T-021 dropped `X-XSS-Protection` in the same change, which the task allows
  ("may be dropped in the same PR", and it is T-052's job to do so). The
  pre-existing header test was updated to assert its absence.
- T-021's policy allows `'unsafe-inline'`/`'unsafe-eval'` in `script-src` and
  `'unsafe-inline'` in `style-src` **on purpose** and this is documented in the
  config: Next.js ships inline bootstrap scripts and Shiki injects inline
  `<style>`, so the origins list — not inline/eval — is what the report-only
  phase is measuring. T-022 is where the nonce work belongs.
- T-015 needed no edit to the symlink guard: `header.type !== "file"`
  already excluded `symlink` and `link` entries, which a node script against
  the real `tar-stream` confirmed (both surface `type: "symlink"` /
  `type: "link"`). The test pins that behaviour rather than changing it.
- T-004 has not landed, so `src/__tests__/unit/github-tarball-stream.test.ts`
  was created by T-015, as the task's Notes allow. It mocks `axios` to return a
  real gzipped `tar-stream` pack, so the test exercises the actual gunzip +
  extract path rather than a stubbed parser.
- **Flaky, not lane B:** `src/__tests__/integration/clerk-webhook.test.ts`
  ("upserts on the primary key…") times out at the 5s default under full-suite
  parallel load. It passes when the file is run on its own and passes on re-runs
  of the full suite. Not caused by anything in this lane.
