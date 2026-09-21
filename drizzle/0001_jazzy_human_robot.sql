CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"image" text,
	"linkedin" text,
	"x" text,
	"source_url" text,
	"is_founder" boolean DEFAULT false NOT NULL,
	"search_text" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "people_company_idx" ON "people" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "people_name_idx" ON "people" USING btree ("name");
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE INDEX "companies_search_trgm_idx" ON "companies" USING gin ((name || ' ' || industry || ' ' || location) gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX "jobs_search_trgm_idx" ON "jobs" USING gin ("search_text" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX "people_search_trgm_idx" ON "people" USING gin ("search_text" gin_trgm_ops);
