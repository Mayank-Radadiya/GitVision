-- Migration: Add type column and make projectId nullable for general chats

-- Add type column to project_chats table
ALTER TABLE "project_chats" ADD COLUMN IF NOT EXISTS "type" varchar(20) DEFAULT 'project' NOT NULL;

-- Make projectId nullable (remove NOT NULL constraint)
ALTER TABLE "project_chats" ALTER COLUMN "project_id" DROP NOT NULL;

-- Create index on type column
CREATE INDEX IF NOT EXISTS "chats_type_idx" ON "project_chats" USING btree ("type");

-- Update existing chats to have type 'project'
UPDATE "project_chats" SET "type" = 'project' WHERE "type" IS NULL;
