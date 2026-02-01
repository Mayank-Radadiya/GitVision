-- Migration: Add embedding status tracking to projects table
-- Generated: 2026-02-01

-- Add embedding status tracking fields
ALTER TABLE "projects" ADD COLUMN "embedding_status" varchar(20) DEFAULT 'pending' NOT NULL;
ALTER TABLE "projects" ADD COLUMN "embedding_error" text;
ALTER TABLE "projects" ADD COLUMN "embedding_progress" integer DEFAULT 0 NOT NULL;
ALTER TABLE "projects" ADD COLUMN "last_embedding_attempt" timestamp;

-- Create index on embedding_status for faster queries
CREATE INDEX IF NOT EXISTS "projects_embedding_status_idx" ON "projects" ("embedding_status");

-- Backfill existing projects
-- Set status to 'completed' if they have embeddings, otherwise 'pending'
UPDATE "projects" p
SET "embedding_status" = CASE
  WHEN EXISTS (
    SELECT 1 FROM "code_embeddings" ce WHERE ce."project_id" = p."id" LIMIT 1
  ) THEN 'completed'
  ELSE 'pending'
END
WHERE "embedding_status" = 'pending';
