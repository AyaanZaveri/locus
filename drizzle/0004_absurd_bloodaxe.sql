CREATE TABLE "job_locations" (
	"job_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"location_id" uuid,
	"relation" text NOT NULL,
	"qualifier" text,
	"source_label" text NOT NULL,
	"label" text NOT NULL,
	CONSTRAINT "job_locations_job_id_position_pk" PRIMARY KEY("job_id","position"),
	CONSTRAINT "job_locations_relation_check" CHECK ("job_locations"."relation" IN ('office', 'eligibility', 'unspecified')),
	CONSTRAINT "job_locations_position_check" CHECK ("job_locations"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "location_aliases" (
	"alias" text PRIMARY KEY NOT NULL,
	"location_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"identity_key" text NOT NULL,
	"name" text NOT NULL,
	"display_label" text NOT NULL,
	"kind" text NOT NULL,
	"country_code" text,
	"subdivision_code" text,
	CONSTRAINT "locations_identity_key_unique" UNIQUE("identity_key"),
	CONSTRAINT "locations_kind_check" CHECK ("locations"."kind" IN ('city', 'country', 'subdivision', 'region'))
);
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "headquarters_location_id" uuid;--> statement-breakpoint
ALTER TABLE "job_locations" ADD CONSTRAINT "job_locations_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_locations" ADD CONSTRAINT "job_locations_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_aliases" ADD CONSTRAINT "location_aliases_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_locations_location_idx" ON "job_locations" USING btree ("location_id","job_id");--> statement-breakpoint
CREATE INDEX "location_aliases_location_idx" ON "location_aliases" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "locations_country_idx" ON "locations" USING btree ("country_code");--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_headquarters_location_id_locations_id_fk" FOREIGN KEY ("headquarters_location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;