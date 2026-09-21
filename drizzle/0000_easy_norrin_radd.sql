CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"industry" text NOT NULL,
	"stage" text NOT NULL,
	"location" text NOT NULL,
	"country_code" text NOT NULL,
	"employee_count" text NOT NULL,
	"profile" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"title" text NOT NULL,
	"location" text NOT NULL,
	"focus" text NOT NULL,
	"url" text,
	"description" text,
	"status" text DEFAULT 'unknown' NOT NULL,
	"workplace_type" text,
	"employment_type" text,
	"department" text,
	"skills" text[] DEFAULT '{}' NOT NULL,
	"minimum_experience_years" numeric,
	"maximum_experience_years" numeric,
	"experience_level" text,
	"accepts_new_grads" boolean,
	"salary_minimum" numeric,
	"salary_maximum" numeric,
	"salary_currency" text,
	"salary_period" text,
	"equity_minimum_percent" numeric,
	"equity_maximum_percent" numeric,
	"requires_us_work_authorization" boolean,
	"visa_sponsorship" text,
	"citizenship_required" boolean,
	"interview_process_available" boolean,
	"interview_process_summary" text,
	"interview_process_url" text,
	"posted_at" text,
	"last_seen_at" text,
	"search_text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "companies_industry_idx" ON "companies" USING btree ("industry");--> statement-breakpoint
CREATE INDEX "companies_stage_idx" ON "companies" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "jobs_company_idx" ON "jobs" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "jobs_filters_idx" ON "jobs" USING btree ("status","workplace_type","employment_type");--> statement-breakpoint
CREATE INDEX "jobs_department_idx" ON "jobs" USING btree ("department");