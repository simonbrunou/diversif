-- Cast existing text values to jsonb. The column was always written via
-- JSON.stringify(transports[]), so every existing row holds a parseable
-- JSON array; the USING clause makes the cast explicit because Postgres
-- requires it whenever a column type changes.
ALTER TABLE "passkeys"
  ALTER COLUMN "transports" SET DATA TYPE jsonb USING "transports"::jsonb;--> statement-breakpoint
ALTER TABLE "passkeys" ALTER COLUMN "transports" SET DEFAULT '[]'::jsonb;