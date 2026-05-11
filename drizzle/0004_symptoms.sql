CREATE TABLE IF NOT EXISTS "symptoms" (
	"id" serial PRIMARY KEY NOT NULL,
	"food_entry_id" integer NOT NULL,
	"child_id" integer NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"label" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "symptoms" ADD CONSTRAINT "symptoms_food_entry_id_food_entries_id_fk" FOREIGN KEY ("food_entry_id") REFERENCES "public"."food_entries"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "symptoms" ADD CONSTRAINT "symptoms_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "symptoms" ADD CONSTRAINT "symptoms_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "symptoms_food_entry_id_idx" ON "symptoms" USING btree ("food_entry_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "symptoms_child_id_observed_at_idx" ON "symptoms" USING btree ("child_id","observed_at");