CREATE TABLE IF NOT EXISTS "ClinicalTrial" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"raw_criteria_input" text NOT NULL,
	"eligibility_criteria" json NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Patient" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255),
	"age" integer,
	"gender" varchar(50),
	"bmi" numeric(5, 2),
	"conditions" json NOT NULL,
	"location" text,
	"campaign_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "TrialSearchResult" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"patient_name" varchar(255),
	"organizer_name" varchar(255),
	"patient_age" integer,
	"patient_gender" varchar(50),
	"patient_conditions" json NOT NULL,
	"patient_location" text,
	"campaign_url" text NOT NULL,
	"match_score" integer NOT NULL,
	"criteria_breakdown" json NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "TrialSearchSession" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"search_query" text NOT NULL,
	"parsed_criteria" json NOT NULL,
	"search_queries" json NOT NULL,
	"total_results" integer DEFAULT 0 NOT NULL,
	"match_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ClinicalTrial" ADD CONSTRAINT "ClinicalTrial_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TrialSearchResult" ADD CONSTRAINT "TrialSearchResult_session_id_TrialSearchSession_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."TrialSearchSession"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TrialSearchSession" ADD CONSTRAINT "TrialSearchSession_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
