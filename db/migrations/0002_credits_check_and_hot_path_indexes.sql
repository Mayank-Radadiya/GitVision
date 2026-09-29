CREATE INDEX "code_embeddings_project_id_file_path_idx" ON "code_embeddings" USING btree ("project_id","file_path");--> statement-breakpoint
CREATE INDEX "issues_state_idx" ON "issues" USING btree ("state");--> statement-breakpoint
CREATE INDEX "issues_github_updated_at_idx" ON "issues" USING btree ("github_updated_at");--> statement-breakpoint
CREATE INDEX "issues_project_id_is_pull_request_github_updated_at_idx" ON "issues" USING btree ("project_id","is_pull_request","github_updated_at");--> statement-breakpoint
CREATE INDEX "rate_limits_window_start_idx" ON "rate_limits" USING btree ("window_start");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_credits_non_negative" CHECK ("users"."credits" >= 0);