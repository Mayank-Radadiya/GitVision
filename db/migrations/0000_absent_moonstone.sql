CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" uuid NOT NULL,
	"role" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"related_files" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "code_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"file_path" varchar(255) NOT NULL,
	"chunk_index" integer NOT NULL,
	"chunk_content" text NOT NULL,
	"embedding" vector(768) NOT NULL,
	"token_count" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"commit_hash" varchar(255) NOT NULL,
	"commit_message" text NOT NULL,
	"ai_summary" text,
	"author_name" varchar(255) NOT NULL,
	"author_email" varchar(255) NOT NULL,
	"author_avatar" varchar(255),
	"author_date" timestamp NOT NULL,
	"committer_name" varchar(255) NOT NULL,
	"committer_email" varchar(255) NOT NULL,
	"committer_date" timestamp NOT NULL,
	"project_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "commits_commit_hash_project_id_unique" UNIQUE("commit_hash","project_id")
);
--> statement-breakpoint
CREATE TABLE "issue_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issue_id" uuid NOT NULL,
	"body" text NOT NULL,
	"author_login" varchar(255) NOT NULL,
	"author_avatar" varchar(255),
	"github_created_at" timestamp NOT NULL,
	"github_updated_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issue_number" integer NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"state" varchar(20) NOT NULL,
	"is_pull_request" boolean DEFAULT false NOT NULL,
	"author_login" varchar(255) NOT NULL,
	"author_avatar" varchar(255),
	"project_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"github_created_at" timestamp NOT NULL,
	"github_updated_at" timestamp NOT NULL,
	"github_closed_at" timestamp,
	"ai_summary" text,
	"ai_complexity" varchar(10),
	"ai_tags" jsonb
);
--> statement-breakpoint
CREATE TABLE "project_chats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"user_id" varchar NOT NULL,
	"type" varchar(20) DEFAULT 'project' NOT NULL,
	"title" varchar(255) DEFAULT 'New Chat' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"code" text NOT NULL,
	"language" varchar(50),
	"hash" varchar(64),
	"project_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_files_project_id_file_name_unique" UNIQUE("project_id","file_name")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) DEFAULT 'project' NOT NULL,
	"github_url" varchar(255) NOT NULL,
	"owner_id" varchar(255) NOT NULL,
	"star" integer DEFAULT 0 NOT NULL,
	"forks" integer DEFAULT 0 NOT NULL,
	"total_commits" integer DEFAULT 0 NOT NULL,
	"total_branches" integer DEFAULT 0 NOT NULL,
	"total_contributors" integer DEFAULT 0 NOT NULL,
	"total_files" integer DEFAULT 0 NOT NULL,
	"languages" jsonb DEFAULT '[]'::jsonb,
	"embedding_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"embedding_error" text,
	"embedding_progress" integer DEFAULT 0 NOT NULL,
	"last_embedding_attempt" timestamp,
	"estimated_tokens" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"limit_key" varchar(255) PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255) DEFAULT 'unknown' NOT NULL,
	"email" varchar(255) DEFAULT 'example@gmail.com' NOT NULL,
	"credits" integer DEFAULT 100 NOT NULL,
	"is_pro_user" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_chat_id_project_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."project_chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code_embeddings" ADD CONSTRAINT "code_embeddings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code_embeddings" ADD CONSTRAINT "code_embeddings_file_id_project_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."project_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commits" ADD CONSTRAINT "commits_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_comments" ADD CONSTRAINT "issue_comments_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_chats" ADD CONSTRAINT "project_chats_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_chats" ADD CONSTRAINT "project_chats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_files" ADD CONSTRAINT "project_files_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "messages_chat_id_idx" ON "chat_messages" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "messages_created_at_idx" ON "chat_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "embeddings_project_id_idx" ON "code_embeddings" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "embeddings_file_id_idx" ON "code_embeddings" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "embeddings_vector_idx" ON "code_embeddings" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "commits_project_id_idx" ON "commits" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "commits_commit_hash_idx" ON "commits" USING btree ("commit_hash");--> statement-breakpoint
CREATE INDEX "commits_author_date_idx" ON "commits" USING btree ("author_date");--> statement-breakpoint
CREATE INDEX "issue_comments_issue_id_idx" ON "issue_comments" USING btree ("issue_id");--> statement-breakpoint
CREATE INDEX "issues_project_id_idx" ON "issues" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "issues_issue_number_idx" ON "issues" USING btree ("issue_number");--> statement-breakpoint
CREATE INDEX "chats_project_id_idx" ON "project_chats" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "chats_user_id_idx" ON "project_chats" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chats_type_idx" ON "project_chats" USING btree ("type");--> statement-breakpoint
CREATE INDEX "project_files_project_id_idx" ON "project_files" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_files_hash_idx" ON "project_files" USING btree ("hash");--> statement-breakpoint
CREATE INDEX "owner_id_idx" ON "projects" USING btree ("owner_id");