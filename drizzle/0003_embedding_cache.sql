CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "company_embeddings" (
	"company_id" uuid PRIMARY KEY NOT NULL,
	"cache_key" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "embedding_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"model_id" text NOT NULL,
	"dimensions" integer NOT NULL,
	"recipe" text NOT NULL,
	"input_type" text NOT NULL,
	"content_text" text NOT NULL,
	"embedding" vector(1024) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "embedding_requests" (
	"key" text NOT NULL,
	"day" text NOT NULL,
	"slot" integer NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"receipt" jsonb,
	CONSTRAINT "embedding_requests_day_slot_pk" PRIMARY KEY("day","slot"),
	CONSTRAINT "embedding_requests_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "job_embeddings" (
	"job_id" uuid PRIMARY KEY NOT NULL,
	"cache_key" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company_embeddings" ADD CONSTRAINT "company_embeddings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_embeddings" ADD CONSTRAINT "company_embeddings_cache_key_embedding_cache_key_fk" FOREIGN KEY ("cache_key") REFERENCES "public"."embedding_cache"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_embeddings" ADD CONSTRAINT "job_embeddings_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_embeddings" ADD CONSTRAINT "job_embeddings_cache_key_embedding_cache_key_fk" FOREIGN KEY ("cache_key") REFERENCES "public"."embedding_cache"("key") ON DELETE no action ON UPDATE no action;
