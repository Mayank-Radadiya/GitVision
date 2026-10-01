-- Constrain `projects.embedding_status` to the five states the pipeline knows.
--
-- Migration 0015. Added with `indexing-state.ts`, which is where the same list is
-- declared for TypeScript.

-- 1. Pre-flight: every row must already be legal, or the ALTER below fails.
--    Run this on its own before applying the constraint.
--
-- SELECT embedding_status, count(*)
--   FROM projects
--  WHERE embedding_status NOT IN ('pending','processing','completed','partial','failed')
--  GROUP BY 1;
-- expect: zero rows. Any row returned here is a value the code has never
-- written deliberately — inspect it before forcing it to 'failed'.

-- 2. The constraint. NOT VALID first so the check is enforced on new writes
--    without an ACCESS EXCLUSIVE table scan on a large projects table, then
--    validated to confirm existing rows comply.
ALTER TABLE "projects"
  DROP CONSTRAINT IF EXISTS "projects_embedding_status_check";

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_embedding_status_check"
  CHECK ("embedding_status" IN ('pending', 'processing', 'completed', 'partial', 'failed'))
  NOT VALID;

ALTER TABLE "projects"
  VALIDATE CONSTRAINT "projects_embedding_status_check";