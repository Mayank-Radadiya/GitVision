ALTER TABLE "issues" ADD COLUMN "ai_summary" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "ai_complexity" varchar(10);--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "ai_tags" jsonb;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "languages" jsonb DEFAULT '[]'::jsonb;