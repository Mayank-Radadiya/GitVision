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
	"github_closed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "issue_comments" ADD CONSTRAINT "issue_comments_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issue_comments_issue_id_idx" ON "issue_comments" USING btree ("issue_id");--> statement-breakpoint
CREATE INDEX "issues_project_id_idx" ON "issues" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "issues_issue_number_idx" ON "issues" USING btree ("issue_number");