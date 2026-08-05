# Design: Fix migration/data-integrity issues and remove dead/duplicate systems

**Date:** 2026-08-05
**Branch:** main
**Status:** Approved by user (2026-08-05)

## Context

A code review surfaced 13 issues (numbered 13–25 in the review) spanning the database
migration journal, schema data integrity, dead code, and duplicate pipelines. This
spec resolves all of them to reach a clean, professional codebase.

### Key findings from exploration

- The app applies schema changes with **`drizzle-kit push`** (schema diff). There is **no
  `migrate()` call** in the codebase — `db/migrations/` is a generated artifact, not
  applied at deploy. Squashing the migration history is therefore safe.
- `db/migrations/` contains **two lineages**:
  - Journal set (`meta/_journal.json`): `0000_loud_ted_forrester` → `0001_spotty_frank_castle`
    → `0002_clumsy_invisible_woman` → `0003_stormy_morph` (drops all 10 tables) →
    `0004_pink_mariko_yashida` (recreates them) → `0005_tense_rumiko_fujikawa` →
    `0006_tiresome_makkari`.
  - Orphan set (not in journal): `0000_violet_legion`, `0001_rag_support`,
    `0002_good_dracula`, `0003_chat_types`, `0004_add_embedding_status`,
    `0005_add_estimated_tokens`.
- `CREATE EXTENSION IF NOT EXISTS vector` is only in `scripts/db-init.ts`, never in the
  migration journal.
- `chat_history` table exists in `db/schema.ts` (marked deprecated) but is unreferenced
  by application code.
- Two embedding pipelines run in parallel: the Inngest `embeddings/generate` function
  (live, durable; triggered by `project/created` and by the frontend) and the legacy
  in-process `processProjectForRag` called by `POST /api/embeddings`.
- Dead files: `src/features/chat/actions/chat-ai.ts`, `src/features/chat/actions/create-chat.ts`,
  `src/lib/openai.ts` (hardcodes the literal `"GEMINI_API_KEY"`), `src/lib/inngest/actions.ts`
  (`sendTestInngestEvent`, `test/hello.world`). The `test-inngest.ts` file is no longer in the repo.

## A. Database schema & migrations

1. Edit `db/schema.ts`:
   - Remove `chatHistoryTable` (issue 22).
   - Add composite unique `commits(commit_hash, project_id)` (issue 15).
   - Add composite unique `project_files(project_id, file_name)` (issue 16).
   - Keep the existing `project_files(project_id)` index (issue 17) — it is included in
     the regenerated baseline.
2. Delete the entire `db/migrations/` folder (issues 13, 25).
3. Regenerate a single clean baseline `0000_*.sql` from the updated schema.
4. Prepend `CREATE EXTENSION IF NOT EXISTS vector;` to the baseline (issue 14). Keep
   `scripts/db-init.ts` (idempotent; `db:push` runs it first).

### Migration strategy decision

**Squash to a single baseline** was chosen over fix-in-place because:

- The current journal chain is destructive (0003 drops all 10 tables, 0004 recreates them).
- The orphan lineage adds noise and confusion.
- The app never runs `migrate()`, so a fresh baseline has no effect on existing databases;
  it only makes the journal correct for future fresh deploys / anyone running migrations.

## B. Dead code removal

5. Delete `src/features/chat/actions/chat-ai.ts` (issues 18, 24).
6. Delete `src/features/chat/actions/create-chat.ts` (issue 19).
7. Delete `src/lib/openai.ts` (issue 20); remove the now-unused `openai` dependency from
   `package.json`.
8. Delete `src/lib/inngest/actions.ts`; remove `"test/hello.world"` from
   `src/lib/inngest/client.ts` `Events` type (issue 21).

## C. Embedding pipeline consolidation

9. Make Inngest the single embedding pipeline (issue 23):
   - `POST /api/embeddings` dispatches the `embeddings/generate` event instead of calling
     `processProjectForRag` in-process. Keep auth, ownership, rate-limit, and dedupe
     guards; response contract unchanged (`{status: "started"}`, frontend polls `GET`).
   - `DELETE /api/embeddings` sends the `embeddings/cancel` event and resets status.
     `generateEmbeddings` already declares `cancelOn` for that event.
   - Delete `processProjectForRag` from `src/features/rag/services/rag-ingestion.ts`.
     Keep `processFileForRag` (shared per-file worker used by the Inngest function).

## Verification

- `bun run build` (type-check + production build) passes.
- `bun run lint` passes.
- No references remain to any deleted file or the removed table/function.

## Non-goals

- No data migration for existing rows (unique constraints are additive; existing
  duplicates, if any, would fail on push — out of scope).
- No change to the tRPC chat router or `app/api/chat` streaming route (they are the live
  chat path; only the dead `chat-ai.ts` is removed).
- No change to the Inngest project-creation flow (`project/created`).
