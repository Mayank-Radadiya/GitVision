---
name: close-task
description: Record a shipped commit in task.md's DONE ledger and flip its Defect Coverage row. Use after implementing any T-NNN task, F-NN workstream, or defect fix in GitVision — the house convention is that a code commit is incomplete until both bookkeeping edits land. Triggers on "close task", "record the commit", "mark F-NN done", "update task.md".
---

# Close a task in the GitVision ledger

Every fix in this repo closes in three steps: **implement → record the hash → flip the row.** Steps 2 and 3 are what this skill does. If the code is already committed and only the bookkeeping is missing, that is exactly the case this is for.

## Inputs

- The commit hash (7+ chars is fine).
- The task ID: `T-0NN`, `T-09N`, or `F-NN`.
- Optionally the lane (`p0-A`, `p2-a`, …) — infer it from the branch name or from where the task entry lives in `task.md`; ask only if genuinely ambiguous.

## Steps

1. **Read `task.md`.** It is ~100 KB, so grep rather than read it whole:
   ```bash
   rg -n "F-22" task.md
   ```
   You need three locations: the task entry (for the `## DONE` lane it belongs to), the `Defect Coverage` table row, and the existing `## DONE` lane block to append to.

2. **Add the `## DONE` entry** under the correct `Lane pN-x:` heading inside `## DONE`. Match the format of neighbouring entries — hash plus the non-obvious decisions that aren't visible in the diff. Append; don't reorder or reformat existing entries.

3. **Flip the `Defect Coverage` row** for that defect/task: `open` → `fixed`, or `partial` → `mitigated` as appropriate. Change only the status cell.

4. **Report the two edits** with the line numbers you touched.

## Rules

- **Never invent a status.** If the code doesn't actually close the defect, say so and stop — don't flip a row to make the ledger look tidy.
- **Don't reformat the rest of `task.md`.** It's a hand-maintained board with aligned tables and `§` citations; a stray reformat destroys reviewability.
- **If `task.md` doesn't mention the ID at all**, stop and tell the user. The referenced sources (`gitvisionStrategy2.md`, `TASKS.md`, `AGENT_RULES.md`) don't exist in this repo, so some IDs genuinely have no board entry.
- One task per invocation. Batching several ledger edits into one commit is fine and is often what you want — but say which IDs you closed.

## The paired commit

The repo convention is usually two commits: the code, then `[F-22] Move F-22 to DONE and record the commit hash`. Check `git log` for the recent pattern before assuming — if the user has been landing them as one commit, match that.
