ALTER TABLE "credit_transactions" ADD COLUMN "ref_id" varchar(255);--> statement-breakpoint
CREATE UNIQUE INDEX "credit_transactions_ref_id_idx" ON "credit_transactions" USING btree ("ref_id");