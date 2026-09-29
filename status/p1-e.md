# Lane P1-E — e2e

Branch: `lane/p1-e` (off `main` @ `c9ffe92`). Lane E owns `e2e/**`, `playwright.config.ts` and `.github/workflows/ci.yml`.

| Task | Status | Reason | Commit |
|---|---|---|---|
| T-032 | done | The suite now boots its own server; `bun run test:e2e` passes from a cold start | `9746a25` |
| T-033 | blocked | This machine's Next.js server 404s every `/_next/static` asset, so Clerk's client JS never loads and no browser session can be created. Evidence and unblock path below | |
| T-034 | blocked | Depends on T-033 | |
| T-035 | blocked | Depends on T-033 | |
| T-036 | blocked | Depends on T-034 + T-035 | |

## Notes

- **T-032 depends on T-010 in practice, not on paper.** `TASKS.md` lists T-032's `Depends on` as `none`, but the task text and its notes both say the app must boot without a real GitHub token, and attribute that to T-010. T-010 is still `Status: todo` and `src/lib/github/client.ts:18-20` still throws at module load when `GITHUB_TOKEN` is unset. Worked around with a placeholder in the `webServer` env; T-010 removes the need. The workaround is conditional on the absence of a `.env` so it cannot shadow a developer's real token.
- **T-033/T-034/T-035 must not add an auth bypass.** The tasks say so explicitly and so does the lane brief: no `NODE_ENV=test` escape hatch in `proxy.ts`, no bypass header. If Clerk cannot run in CI the answer is a dedicated test instance.
- **T-003 has not landed**, which is a second, independent blocker on T-034. Its acceptance criterion is "reverting T-003 makes this test fail", and there is nothing to revert: `TASKS.md:77` still reads `Status: todo`, `projectService.ts:664` and `:680` still emit the dead `/projects/...` hrefs, and `src/__tests__/unit/dashboard-pickup-links.test.ts` does not exist.
- Known-flaky test not caused by this lane: `src/__tests__/integration/clerk-webhook.test.ts` can time out at 5s under full-suite parallel load; it passes alone and on re-runs.

## Environment blocker for T-033 onward

Next.js cannot serve a single `/_next/static` asset on this machine, in dev or in
production. The app therefore renders server HTML correctly (which is why the
T-032 smoke test passes — it only asserts the SSR title) but executes no
client-side JavaScript, and Clerk's `window.Clerk.loaded` never becomes true.

Evidence, in order of how it was established:

1. `bun run dev` (`next dev --turbopack`, Next 15.5.26) logs a 404 for every
   chunk, including `[turbopack]_browser_dev_hmr-client_*.js`. The page loads
   its CSS as `text/html` because the stylesheet request 404s too.
2. Deleting `.next` and restarting changes nothing, so it is not a stale build
   directory.
3. Plain `next dev` without `--turbopack` fails the same way, so it is not a
   Turbopack bug.
4. `bun run build` succeeds (365 files in `.next/static/chunks`) and
   `next start` serves HTML that references two of those real, hashed chunks —
   and both return 404 `text/html`.
5. The files are present and readable
   (`.next/static/chunks/1150.af7ddbd88effe3ea.js`, 147,498 bytes, mode
   `-rw-r--r--`) and `python3 -m http.server` serving the same directory
   returns `200 text/javascript` for the identical path. So the bytes are
   there and reachable by another process; Next's own static handler is what
   fails.
6. No proxy environment variables are set, and the failure reproduces over
   `127.0.0.1` with `curl --noproxy '*'`.

### Unblock path

This is a local environment problem, not a repository problem — the same code
is expected to work on the Linux CI runner, where Next's static handler is
normally fine. Two ways forward:

- Run the suite somewhere Next can serve its own assets (a container, the CI
  image, or a machine without whatever is interfering with the static handler
  here) and land T-033 as designed.
- Or have someone investigate the handler on this host; the build output and
  the file permissions are both provably fine, so the cause is in Next's
  request handling, not the workspace.

### What T-033 was going to be

The design was completed and is recorded here so it does not have to be
re-derived. **None of it was committed** — it could not be verified, and the
rules say a task whose checks do not pass is `blocked`, not `done`.

- `bun add -d @clerk/testing` (2.2.39). The Clerk keys in `.env` are
  `pk_test_…` / `sk_test_…`, so the instance is a Clerk *development* instance
  and the Backend API answers (`GET /v1/users` → 200). `@clerk/testing` is
  Clerk's own Playwright helper: `clerkSetup()` fetches a testing token and
  `clerk.signIn({ page, emailAddress })` looks the user up, mints a sign-in
  token through the Backend API and completes a ticket sign-in in the browser.
  Hand-rolling that is roughly fifty lines of undocumented cookie and endpoint
  shape, which is why the dependency is the smaller change.
- `e2e/global-setup.ts` as the `globalSetup`. It refuses a non-`sk_test_` key so
  a production Clerk instance can never be written to, `POST`s
  `https://api.clerk.com/v1/users` once to create the test user (422 means
  "already exists", which is every run after the first), then launches
  Chromium, navigates to a page that loads Clerk, calls `clerk.signIn`, and
  writes `page.context().storageState()` to `e2e/.auth/user.json`. When the
  Clerk env is absent it writes `{ cookies: [], origins: [] }` and throws, so
  `use.storageState` always resolves and the unauthenticated specs still run —
  an authenticated suite that quietly passes without a session is the exact
  failure mode T-033 exists to prevent.
- `playwright.config.ts` gains `globalSetup: "./e2e/global-setup.ts"` and
  `use.storageState: "e2e/.auth/user.json"`.
- `e2e/auth.spec.ts` with two tests: `/dashboard` returns 200 and stays on
  `/dashboard` for a signed-in user, and the same URL redirects to `/sign-in`
  when the spec forces `{ cookies: [], origins: [] }`. The second is the
  negative control — if it ever stops redirecting, something opened a hole in
  `proxy.ts`.
- `.gitignore` gains `e2e/.auth/`: the file is a live credential for a real
  user.
- The README env list documents that `CLERK_SECRET_KEY` and
  `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` must point at a development instance, and
  `CLERK_E2E_USER_EMAIL` (default `gitvision-e2e@clerk.test`) is the test
  user's address. The email is deliberate: the app reads `email` off the Clerk
  user, and T-035 needs a user that survives an email-bearing code path.
- The test user is not in `usersTable` — auto-provisioning lives in
  `createProject`, not in the dashboard read path — so `/dashboard` renders
  empty for it. That is fine for T-033's assertions, which are about reaching
  the page, and it is why the Clerk user and the `users` row are separate
  concerns.
