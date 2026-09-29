# Batch 4 — agent notes (branch `batch4-fixes`)

NOT `plan.md`. `plan.md` is gitignored and owned by the Batch 3 agent.
Branch point: `93d3165` (main tip at worktree creation).

---

## STEP 0 — Reconciliation (evidence complete, nothing coded yet)

### Baseline gates on `batch4-fixes` @ `93d3165`

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | **FAIL** — 1 pre-existing error: `src/shared/components/ui/select.tsx(4,34) TS2307 Cannot find module '@radix-ui/react-select'` |
| `npx eslint .` | **PASS** (exit 0, zero output) |
| `npx vitest run` (no DB) | **PASS** — 32 files (30 pass / 2 skip), **167 pass / 11 skip (178)**, 10.54s |
| `npx vitest run` (throwaway local DB) | **PASS 178/178** — `TEST_DATABASE_URL="postgres://$(whoami)@localhost:5432/gitvision_batch4_test"` (local pg18, `pgvector` present; no local `postgres` role, so CI's `postgres:postgres` URL does not work locally) |
| `bun run build` | **FAIL** — pre-existing on main. `Module not found: Can't resolve '@radix-ui/react-select'`, import trace `chat-landing.tsx` |

⇒ **main does not build.** `typescript.ignoreBuildErrors` hides the tsc error; webpack
resolution is a hard failure. **STOP CONDITION — needs a dependency change the plan
does not list.**

### Reconciliation table

| # | Audit | Premise | Verdict | Evidence | Decision |
|---|---|---|---|---|---|
| 4.1 | D7 | No CSP/COOP; delete both `X-XSS-Protection` | **CONFIRMED** | `next.config.ts:45-77` = one `/:path*` rule, 6 headers, no CSP/COOP. `X-XSS-Protection` at `next.config.ts:59` + `app/api/trpc/[trpc]/route.ts:23` (+ a test assertion at `security-headers.test.ts:17`) | proceed — but CONFLICT-RISK (3.13) |
| 4.2 | D8 | Header test asserts keys only | **CONFIRMED** | `src/__tests__/integration/security-headers.test.ts:14-20` maps `h.key` and `toContain`s 6 keys; no value asserted | proceed after 4.1 |
| 4.3 | D1 | ~900–1300 dead lines: 21 orphan components, 2 orphan modules, 6 dead constants, 4 dead tRPC procedures, 13 dead RAG exports, 1 dead REST route | **MOSTLY FALSE** | Re-derived with the TS compiler API + raw-specifier scan (282 files, 327 specifiers). **Real dead = 5 files / 364 lines:** orphans `ui/dialog.tsx` (135), `ui/tabs.tsx` (66), `sidebar/index.ts` (17); dead REST routes `app/api/project/getProjectCommits/route.ts` (90), `.../getProjectDetails/route.ts` (56). Plus **15 dead exports in live files**. "13 dead RAG exports" **FALSE** (all 27 have consumers). "4 dead tRPC procedures" **MISLEADING** — 6 unused *endpoints*, 0 unused logic | proceed, re-scoped to the verified 5 files + 15 exports. Not ~1300 lines |
| 4.4 | D3 | Delete `ai-insights-widget.tsx` + `ai-triage-widget.tsx` (~554 lines) | **FALSE — FILES DO NOT EXIST** | `find . -name 'ai-*widget*'` empty; `rg` for 6 name variants → 0 hits | **skip — nothing to delete** |
| 4.5 | D4 | Correct 6 false README claims | **LARGELY FALSE** | 1 of 6 already fixed by Batch 2 `29ea55b` (open-source + non-existent LICENSE, `README.md:237-238`). "Six scripts that no longer exist" **FALSE** — all 9 listed scripts exist in `package.json`; README merely **omits** 8 real ones. Real finding: `README.md:117` recommends `yarn install` in a bun-only repo | **re-scope** to: drop the yarn line, add the missing scripts. Ask user |
| 4.6 | D5 | Rewrite `docs/operations/backup-retention.md` | **ALREADY DONE** | 53 lines, already rewritten by Batch 2 `29ea55b`: PITR caveat (":12-15"), "SQL Dumps — MANUAL ONLY" (":17"), "*nobody runs this automatically*" (":25-27") | **skip** |
| 4.7 | D6 | No `.env.example`; `.gitignore:34` = `.env*` | **CONFIRMED** | `ls .env.example` → missing | proceed |
| 4.8 | D13 | `.vscode/` tracked despite `.gitignore:44`; `backups/` unignored | **HALF CONFIRMED** | `git ls-files .vscode` → `mcp.json`, `settings.json` tracked. `backups/` **already ignored** (`.gitignore:56`) | proceed, re-scoped to `git rm --cached -r .vscode` only |
| 4.9 | D12 | staleTime 30s vs 60s; zero HTTP caching | **HALF CONFIRMED** | `use-dashboard.ts:3` `DASHBOARD_STALE_TIME = 60_000` vs `query-client.ts:13` `staleTime: 30 * 1000` — same stated intent, different value ⇒ real duplication. **Cache-Control half: the only read-mostly route is `app/api/health/route.ts`, which deliberately sets `dynamic = "force-dynamic"` with a comment saying a cached health check is worse than none (`:8-10`)** ⇒ premise falsified for that route | staleTime half: proceed. Cache-Control half: **ask user which 2 routes** |
| 4.10 | D14 | Advisories for `sharp`, `nanoid`, `js-yaml` | **FALSE** | `sharp` is `0.35.4` (readable; plan's `ERR_PACKAGE_PATH_NOT_EXPORTED` was wrong). `bun audit` → **1 finding, `moderate`: `esbuild@0.18.20`**, transitive via `drizzle-kit` + `tsx`, dev-server only. **No advisory for the three named packages** | **skip — no action** |
| 4.11 | (a11y) | Colour-only file-type encoding; contrast failures | **CONFIRMED (colour) / PARTIAL (contrast)** | `file-tree.tsx:40-70` `getFileIcon`: 8 code langs → one identical `FileCode`/`text-blue-400` glyph; only hue separates css/scss, html/xml. `project-card.tsx:121` `text-muted-foreground/60` = clearest contrast suspect; exact ratios not computed (tailwind v4 oklch). `needs-attention.tsx:42,88` — amber is the only signal (badge + icon, no text) | proceed — but CONFLICT-RISK (3.12 on `project-card.tsx:87`) |
| 4.12 | (a11y) | 3 `prefers-reduced-motion` bypasses | **1 OF 3 CONFIRMED** | `stat-card.tsx:9,22-33` imperative framer `animate()` in a `useEffect` — JS-driven, so the `app/globals.css:454` CSS rule cannot suppress it. **FALSIFIED:** `spotlight-card.tsx:90-108` is a **pointer-driven 3D tilt** (also at `src/shared/components/effects/`, not `src/features/`) — reduced-motion arguably not the right control. **WEAKENED:** `hero-section.tsx:19-20` is scroll parallax (`useTransform`), not a keyframe; plan's cited line 21 is blank | proceed with `stat-card` only; ask user on the other two |

### No ordered 4.x task exists for these summary-table rows

| Audit | Verdict |
|---|---|
| D2 `getRecentTriageIssues` / `getNeedsAttention` return `[]` | **ENTIRELY FALSE.** `getRecentTriageIssues` does not exist repo-wide (fabricated name). `getNeedsAttention` (`projectService.ts:746`) runs two real `Promise.all` queries and returns `{openIssuesCount, openPRsCount, items}`; it is also a live tRPC endpoint. **skip** |
| D9 `clean` script | **CONFIRMED** (`~/.bun/cache` + every lockfile's cache in the `rm -rf`) but **no ordered task** and **low value**. Fixing it is a one-line `package.json` edit = shared-file conflict risk for near-zero gain. **Recommend skip** |
| D10 unbounded small-project dump | Partial fix already committed `db14078`. The rest is on the user's explicit **out-of-scope** list. **skip** |
| D11 `/chat/[chatId]` waterfall | Real (`app/(main)/chat/[chatId]/page.tsx:21,29`) but **no ordered task** and **CONFLICT-RISK with Batch 3 task 3.17** (same file, same query). **Recommend skip** |

### Decisions needed before coding

1. **BUILD BLOCKER (stop condition).** `bun run build` fails on main for an undeclared
   package. Options: **(a) `bun add @radix-ui/react-select`** — declares an
   already-imported dep, smallest diff, touches `package.json` + `bun.lock`
   (conflict risk vs Batch 3 task 3.14's `package.json:44-47`; different region);
   **(b) rewrite `select.tsx` on a native `<select>`** — no dep change, much bigger
   diff, UI behaviour change. **Recommend (a).** Until this is decided the
   "run build after each task" gate is unrunnable for every task.
2. **4.1 vs Batch 3 task 3.13** — both edit `next.config.ts` (mine `:45-77`, theirs
   `:34-44` + `console.*` in ~8 files). Different regions, so a textual conflict is
   unlikely, but I want go-ahead before touching a shared file.
3. **4.11 vs Batch 3 task 3.12** — both edit `project-card.tsx` (mine `:121`, theirs
   `:87`). Same file, distant lines.
4. **4.9's Cache-Control half** — which two "read-mostly REST routes"? The only
   surviving candidate (`/api/health`) deliberately forbids caching. Recommend
   dropping this half and doing the staleTime reconciliation only.
5. **4.5 re-scope** — drop the yarn line + add the 8 missing scripts, or skip?
6. **4.12 re-scope** — `stat-card.tsx` only, or also narrow `hero-section.tsx`?

### Self-correction logged

I earlier told the user `chat-landing.tsx` was an orphan and proposed deleting it
plus `ui/select.tsx` to fix the build. **Both wrong** — I had grepped only `src/`
and `e2e/`, missing the root `app/` directory. `app/(main)/chat/page.tsx:4`
imports it and `:16` renders `<ChatLanding>`; it is 438 live lines. The build break
is therefore **not** fixable by deleting dead code. Same `.tsx`/scope blind spot
the plan warns about in §2.1.

I also wrote a contrast script that blended alpha in linear-light space; CSS
composites in gamma space, so its light-mode figures were wrong by a factor of
two. Corrected and re-measured.

---

## Execution log (all 9 commits, branch `batch4-fixes`)

| # | Task | Outcome |
|---|---|---|
| — | build blocker | `@radix-ui/react-select` was imported by a live chain and absent from package.json — main did not build. Declared it (`15c3ea2`). |
| 4.1+4.2 | D7/D8 | CSP is **report-only**, not enforcing. Enforcing blocked Clerk's script and hydration. `55f63ad` |
| 4.3 | D1 | 5 files + 15 exports + 1 extra type. 501 lines, not ~1300. `f930c04` |
| 4.7 | D6 | `.env.example` from the real `process.env` references. `50bd038` |
| 4.8 | D13 | `.vscode` untracked. `c2bd7a8` |
| 4.9 | D12 | Named the hydration window; the 60s was a deliberate override, not a conflict. `0b12bb5` |
| 4.11 | a11y | Icons made decorative; two contrast failures lifted. `39940af` |
| 4.12 | a11y | `stat-card` only; the other two sites were falsified. `d024d20` |
| 4.5 | D4 | yarn line dropped, 8 missing scripts added, all 17 verified against package.json. `2e325d4` |

### Premise falsifications found during execution (beyond STEP 0)

- **CSP enforcement is not safe here.** Two script tags still carry no nonce.
  Shipping the plan as written breaks authentication. Report-only until fixed.
- **`text-muted-foreground/60` appears 31 times repo-wide**, not the 2 the plan
  names. Fixed 2; the other 29 are listed under Proposed cleanup.
- **Full-opacity `text-muted-foreground` is 4.83:1 in light mode** — below the
  4.5:1 requirement is met but with almost no margin. Any future token change to
  a lighter foreground fails it.
- **The `readme` scripts claim was inverted**: all 9 listed scripts exist; 8 real
  ones were missing. The false claim was the yarn line.

