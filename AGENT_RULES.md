# AGENT RULES (all lanes, all phases)

## Isolation
- You are one of several agents running in parallel, each in its own git worktree.
- Work ONLY on the tasks listed for your LANE, in the listed order.
- You own the files those tasks touch. If a task forces an edit to a file outside your lane, make the smallest possible edit and record it in your status file.
- Do NOT edit TASKS.md (it would conflict across agents). Record progress in `status/<phase>-<lane>.md` instead (create it; one line per task: id, done|blocked|skipped, reason, commit sha).

## Per-task loop
1. Confirm dependencies: every `Depends on` task is `done` in TASKS.md or merged on main; every D-* decision is in "Decisions made". Otherwise mark the task `blocked` in your status file and move to the next task in your lane.
2. Re-open each file in **Files** and confirm the problem still exists at current HEAD. If already fixed, mark `skipped: already resolved`.
3. Write or update the required test first and confirm it fails for the right reason.
4. Implement ONLY what "What to do" says. No drive-by refactors, no reformatting.
5. Run the task's **How to verify** commands plus `bun run typecheck && bun run lint && bun run test`. All must pass.
6. Commit: `[T-XXX] <title>` with the audit ref in the body. One commit per task.
7. Continue to the next task.

## Hard rules
- No auth bypasses, no `continue-on-error`, no skipped/disabled tests, no `as any` to silence errors.
- Never widen a public route beyond what the task states.
- If a check fails twice, stop that task, mark it `blocked` with the reason, move on.
- Migrations: before generating one, run `git fetch && git rebase origin/main` and check `db/migrations/` for new files. If a migration from another lane has appeared, rebase onto it and regenerate yours (delete yours first). Always include the `.notes.md`.
- Before finishing: `git fetch && git rebase origin/main`, rerun all checks.

## Finish
Push your lane branch and reply with only: lane, tasks done/blocked/skipped (with reasons), files touched outside your lane, and anything surprising.
