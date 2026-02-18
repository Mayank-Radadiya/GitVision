-- Add estimated_tokens column to projects table
-- Used as a fast project-size gate: if total tokens < 150k, dump all files
-- directly into LLM context instead of going through RAG.
-- NULL means unknown (project not yet embedded) — treated as large.
ALTER TABLE "projects" ADD COLUMN "estimated_tokens" integer;
