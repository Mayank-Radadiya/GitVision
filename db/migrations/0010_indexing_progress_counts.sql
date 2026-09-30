ALTER TABLE "projects" ADD COLUMN "indexed_file_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "total_file_count" integer DEFAULT 0 NOT NULL;