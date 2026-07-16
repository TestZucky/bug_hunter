CREATE TABLE "challenges" (
	"id" text PRIMARY KEY NOT NULL,
	"language" text NOT NULL,
	"difficulty" text NOT NULL,
	"category" text NOT NULL,
	"bug_type" text NOT NULL,
	"status" text DEFAULT 'published' NOT NULL,
	"payload" jsonb NOT NULL,
	"source" text DEFAULT 'seed' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "challenges_language_idx" ON "challenges" USING btree ("language");--> statement-breakpoint
CREATE INDEX "challenges_status_idx" ON "challenges" USING btree ("status");